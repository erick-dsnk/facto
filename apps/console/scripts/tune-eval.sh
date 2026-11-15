#!/bin/bash
# One prompt-pack evaluation (3 harness runs) for a provider and split, then metrics.json via tune-combine.py.
# usage: tune-eval.sh <jev|laya> <pack.json> <outdir> <dev|holdout> [extra harness flags...]
# Run A = admission+pipeline+judge on the 59 admission cases and 24 cohort cases; B = ClaimBuster CFS+NFS (90); C = ClaimBuster UFS (30).
# Config (env): REPO (default: repo root), CB_DIR (ClaimBuster sets), DEV_ADMISSION (dev admission cases file; the 44 reference-app claims are
#   not in this repo, so build it with the harness loadSets, default $REPO/../admission-dev-59.json), LAYA_URL (default http://127.0.0.1:8766),
#   LAYA_ENSURE (script that starts the Laya server, optional), LAYA_LOCK (default /tmp/laya-eval.lock), MAX_LOAD (default 16).
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=${REPO:-$(cd "$HERE/../../.." && pwd)}
PC=$REPO/fixtures/evaluation/provider-comparison
CB=${CB_DIR:-$PC/claimbuster}
DEV_ADMISSION=${DEV_ADMISSION:-$REPO/../admission-dev-59.json}
[ $# -ge 4 ] || { echo "usage: $0 <jev|laya> <pack.json> <outdir> <dev|holdout> [extra flags...]" >&2; exit 2; }
P=$1; PACK=$(cd "$(dirname "$2")" && pwd)/$(basename "$2"); OUT=$3; SPLIT=$4; shift 4
case $P in jev|laya) ;; *) echo "bad provider" >&2; exit 2;; esac
case $SPLIT in dev|holdout) ;; *) echo "bad split" >&2; exit 2;; esac
mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
for i in $(seq 1 20); do
  l=$(sysctl -n vm.loadavg 2>/dev/null | awk '{print $2}'); l=${l:-0}
  awk "BEGIN{exit !($l>${MAX_LOAD:-16})}" || break
  echo "load $l too high, waiting ($i/20)" >&2; sleep 60
done
LAYAFLAGS=()
if [ "$P" = laya ]; then
  export LAYA_URL=${LAYA_URL:-http://127.0.0.1:8766}
  if [ -n "${LAYA_ENSURE:-}" ]; then "$LAYA_ENSURE" >> "$OUT/ensure.log" 2>&1 || { echo "laya ensure failed" >&2; exit 1; }; fi
  LAYAFLAGS=(--laya-deadline-ms 60000 --lock "${LAYA_LOCK:-/tmp/laya-eval.lock}")
fi
if [ "$SPLIT" = dev ]; then
  H=$PC
  AFLAGS=(--modes admission,pipeline,judge --dataset dev --admission-cases "$DEV_ADMISSION")
  BC=$CB/admission-cb-dev.json; CC=$CB/admission-cb-dev-ufs.json
else
  H=$PC/holdout
  AFLAGS=(--modes admission,pipeline,judge --dataset holdout --admission-cases "$H/admission-holdout.json" --cases "$H/cohort-holdout.json" --evidence "$H/frozen-evidence-holdout.json")
  BC=$CB/admission-cb-holdout.json; CC=$CB/admission-cb-holdout-ufs.json
fi
run() { # name, flags...
  n=$1; shift
  ( cd "$REPO" && npm run evaluate:providers -- --providers "$P" "${LAYAFLAGS[@]}" --prompt-pack "$P=$PACK" "$@" "${EXTRA[@]}" --output "$OUT/$n.json" --summary "$OUT/$n.summary.json" > "$OUT/$n.log" 2>&1 ); echo "run$n exit $?" >&2
}
EXTRA=("$@")
run A "${AFLAGS[@]}"
run B --modes admission --dataset "$SPLIT" --admission-cases "$BC"
run C --modes admission --dataset "$SPLIT" --admission-cases "$CC"
python3 -I "$HERE/tune-combine.py" "$OUT" "$SPLIT" "$P"
