# ClaimBuster admission sets

Human-labelled sentences from US presidential debates, used to test claim admission (is this sentence worth checking?) on real speech instead of generated phrases.

- Source: ClaimBuster groundtruth.csv, Zenodo record 3609356, https://zenodo.org/records/3609356
- License: CC-BY-4.0. Citation: Arslan, Hassan, Li, Tremayne, "A Benchmark Dataset of Check-worthy Factual Claims", ICWSM 2020.
- Seed: `20261114` (`build.py`). Duplicate sentences are dropped, then whole debates are shuffled into a dev half and a holdout half until each half has at least 50 CFS, 30 UFS and 40 NFS sentences. No debate appears in both. 50 CFS, 40 NFS and 30 UFS are then sampled per split.
- Mapping to harness labels: CFS (check-worthy factual sentence) to `cant_verify`, which counts as eligible: the classifier must admit it for checking. NFS (non-factual) to `not_a_claim`: it must be skipped. UFS (unimportant factual) to `cant_verify` as well, but kept in its own file and only reported as `ufsAdmitted`, because the label says "not important", not "not a claim".
- Cases carry no debate context (`context: []`), so sentences that depend on the preceding turn ("Yes, that is what I said") look like noise. Labels are crowd-sourced and noisy.
- Auditor-flagged ids: six NFS cases that read as checkable claims, reported separately as `cbCorrectExFlagged`: `cb-dev-nfs-7923`, `cb-dev-nfs-7871`, `cb-dev-nfs-23824`, `cb-dev-nfs-24794`, `cb-dev-nfs-15084`, `cb-holdout-nfs-10465`.

| File | Cases |
|---|---|
| `admission-cb-dev.json`, `admission-cb-holdout.json` | 90 each: 50 CFS + 40 NFS (scored) |
| `admission-cb-dev-ufs.json`, `admission-cb-holdout-ufs.json` | 30 each: UFS (reported) |
| `sidecar.json` | per-case ClaimBuster label, sentence id, debate, speaker; debates per split. Never sent to a model. |
| `build.py` | rebuilds all of the above from `groundtruth.csv` (`CB_GROUNDTRUTH`, default `./raw/groundtruth.csv`; `CB_DIR` for the output folder); it also writes `-all120.json` files. The CSV is not committed. |

Use: `npm run evaluate:providers -- --providers jev --modes admission --dataset dev --admission-cases fixtures/evaluation/provider-comparison/claimbuster/admission-cb-dev.json`. `apps/console/scripts/tune-eval.sh` runs all three sets.
