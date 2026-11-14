import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--originals", action="store_true")
args = parser.parse_args()
base = Path(__file__).resolve().parent
manifest = json.loads((base / "MANIFEST.json").read_text())
for name, expected in manifest["files"].items():
    assert hashlib.sha256((base / name).read_bytes()).hexdigest() == expected, name
index = json.loads((base / "copy-index.json").read_text())
for row in index:
    assert hashlib.sha256((base / row["copy"]).read_bytes()).hexdigest() == row["sha256"], row["copy"]
    if args.originals:
        assert hashlib.sha256(Path(row["original"]).read_bytes()).hexdigest() == row["sha256"], row["original"]
for subfolder in ["investigation", "validation"]:
    nested = json.loads((base / subfolder / "MANIFEST.json").read_text())
    for name, expected in nested["files"].items():
        matches = [row for row in index if row["copy"].startswith(subfolder + "/") and Path(row["original"]).name == name]
        assert len(matches) == 1, name
        assert hashlib.sha256((base / matches[0]["copy"]).read_bytes()).hexdigest() == expected, name
observations = json.loads((base / "investigation/observations.json").read_text())
assert len(observations["rows"]) == 21 and observations["connectionCount"] == 12
native = [row for row in observations["rows"] if row["group"] == "native-http"]
assert len(native) == 11 and all(row["closedPromptly"] and row["charges"] == 1 for row in native)
failure = [row for row in observations["rows"] if row["group"] == "native-http-with-delivery-barrier"]
assert len(failure) == 1 and failure[0]["result"]["code"] == "exa_unavailable" and failure[0]["expectedPrimary"] == "malformed_exa_response"
validation = json.loads((base / "validation/validation.json").read_text())
assert validation["before"] == {"tests": 16, "failed": 13, "passed": 3}
assert validation["lowerBranchFullCheck"] == {"lint": "pass", "typecheck": "pass", "tests": 242, "files": 13, "passed": 242}
assert validation["combinedSourceProjection"]["tests"] == validation["combinedSourceProjection"]["passed"] == 20
assert validation["providerCalls"] == 0
review = json.loads((base / "independent-review.json").read_text())
assert review["sourceSHA256"] == validation["sourceFiles"]["services/api/src/providers/exa/client.ts"]
assert review["testSHA256"] == validation["sourceFiles"]["services/api/src/providers/exa/client-cleanup.test.ts"]
print(f"Verified {len(index)} exact evidence copies and {len(manifest['files'])} package files; zero network calls.")
