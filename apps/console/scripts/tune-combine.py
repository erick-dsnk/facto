"""Combine the three runs of tune-eval.sh (A, B, C) into <outdir>/metrics.json.
usage: tune-combine.py <outdir> <dev|holdout> <jev|laya>
primary = adm59Correct + cbCorrect (ClaimBuster CFS+NFS) + pipelineCorrect + judgeCorrect. UFS is reported (ufsAdmitted), not scored."""
import json, sys, os
out, split, prov = sys.argv[1:4]
FLAG = {"cb-dev-nfs-7923","cb-dev-nfs-7871","cb-dev-nfs-23824","cb-holdout-nfs-10465","cb-dev-nfs-24794","cb-dev-nfs-15084"}
NOCLAIM = ("not_a_claim", "needs_confirmation")
def load(n):
    try:
        return json.load(open(os.path.join(out, n + ".json")))["observations"]
    except Exception:
        return None
def sm(n):
    try:
        return [s for s in json.load(open(os.path.join(out, n + ".summary.json"))) if s["provider"] == prov][0]
    except Exception:
        return None
A, B, C = load("A"), load("B"), load("C")
def ok(o): return not o.get("error") and ((o.get("admission") or {}).get("action") == "check") == (o["expected"] not in NOCLAIM)
def adm(o): return (o.get("admission") or {}).get("action") == "check"
def mode(rows, m): return [o for o in rows if o["mode"].startswith(m)]
res = {"provider": prov, "split": split, "complete": all(x is not None for x in (A, B, C))}
A, B, C = A or [], B or [], C or []
a = mode(A, "admission"); p = mode(A, "pipeline"); j = mode(A, "judge")
res["adm59Correct"] = sum(ok(o) for o in a)
res["adm59FP"] = sum(adm(o) for o in a if o["expected"] in NOCLAIM)
res["adm59Recalled"] = sum(adm(o) for o in a if o["expected"] not in NOCLAIM)
res["cbCorrect"] = sum(ok(o) for o in B)
res["cbFP"] = sum(adm(o) for o in B if o["expected"] in NOCLAIM)
res["cbRecalled"] = sum(adm(o) for o in B if o["expected"] not in NOCLAIM)
res["cbCorrectExFlagged"] = sum(ok(o) for o in B if o["id"] not in FLAG)
res["ufsAdmitted"] = sum(adm(o) for o in C)
res["pipelineCorrect"] = sum(o["expected"] == o["predicted"] for o in p)
res["judgeCorrect"] = sum(o["expected"] == o["predicted"] for o in j)
res["primary"] = res["adm59Correct"] + res["cbCorrect"] + res["pipelineCorrect"] + res["judgeCorrect"]
D = ("true", "false", "misleading")
res["wrongDefinitive"] = sum(o["predicted"] in D and o["predicted"] != o["expected"] for o in p + j)
allr = A + B + C
res["errors"] = sum(1 for o in allr if o.get("error"))
res["truncatedAsks"] = sum(1 for o in allr for k in o.get("asks", []) if k.get("truncated"))
s = sm("A") or {}
res["pipelineP95"] = (s.get("pipeline") or {}).get("p95")
res["judgeP95"] = (s.get("judge") or {}).get("p95")
res["counts"] = {"adm59": len(a), "cb": len(B), "ufs": len(C), "pipeline": len(p), "judge": len(j)}
json.dump(res, open(os.path.join(out, "metrics.json"), "w"), indent=1)
print(json.dumps(res))
