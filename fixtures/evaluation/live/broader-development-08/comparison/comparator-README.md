# Offline public acquisition comparison

`compare.py` reads only explicitly supplied public report paths and uses Python's
standard library. It makes no network calls, loads no environment credentials,
and does not discover evaluation corpora. It writes only its requested output
directory.

Run its synthetic checks with:

```sh
python /workspace/task-evidence/public-broader-acquisition-comparison/compare.py --self-test
```

The current `baseline-inventory/` includes all four public broader baseline
reports, with candidate rows explicitly pending. Supply the four candidate paths
using `--candidate` when root supplies their frozen reports:

```sh
python /workspace/task-evidence/public-broader-acquisition-comparison/compare.py \
  --baseline /workspace/task-evidence/broader-baseline-01.json \
             /workspace/task-evidence/broader-baseline-02.json \
             /workspace/task-evidence/broader-baseline-03.json \
             /workspace/task-evidence/broader-baseline-04.json \
  --candidate CANDIDATE_REPORT_01 CANDIDATE_REPORT_02 CANDIDATE_REPORT_03 CANDIDATE_REPORT_04 \
  --output-dir /workspace/task-evidence/public-broader-acquisition-comparison/paired
```

The JSON retains each acquisition and judgment stage, exact excerpt hashes,
publisher/date/source/echo metadata, assessed directness/scope/stance and source
basis, recorded origin relationships, and query/cost/resource information.
Assessment transfer requires an identical fingerprint of URL, ID, title,
publisher, publication date, content basis and excerpt. Unassessed or dropped
acquisition records remain unknown. Different admitted spans block quantitative
acquisition deltas; missing alternate stages are not treated as empty searches.

“Source-qualified record” is an explicitly limited measurement: a record has
assessed directness and scope, stance confidence at least 0.8, and recorded
original-record/attributable-research/substantive-secondary confidence at least
0.8. This does not rerun the verdict policy, prove independence, determine
truth, or replace citation inspection. Source-group churn and recorded family
links do not claim independent origins.

Reports preserve exact query strings and known costs, but do not preserve full
wire request options. Missing options are `not_retained`, not reconstructed as
observed. Candidate objective/highlight hashes and contents URLs are reported
when present. Partial known costs remain separate from unknown-cost attempts.

The comparison is repeated OPEN development on the same public inputs. It is
neither a held-out accuracy estimate nor causal evidence that one code change
produced an observed difference. Model, index, cache, source and request timing
can vary. Earlier quoted-query diagnostic captures remain historical records;
this script does not recast them as observations of a later query variant.
