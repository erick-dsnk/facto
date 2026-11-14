# Baseline content-basis clarification: retained without promotion

**Retain the existing production question.** The minimal clarification produced
no fixed-threshold gain: both arms accepted all 12 independently labelled
substantive units and rejected all 12 negative units. Numerical confidence
changes are not evidence of useful factual coverage or calibrated reliability.

| Public partition / arm | Substantive recall | Negative false accepts | Missing/failed |
|---|---:|---:|---:|
| Development / baseline | 6/6 | 0/6 | 0 |
| Development / candidate | 6/6 | 0/6 | 0 |
| Validation / baseline | 6/6 | 0/6 | 0 |
| Validation / candidate | 6/6 | 0/6 | 0 |

Each of six source families has two opposed propositions about one identical
positive passage and two hard negatives. In every family, both arms accept 2/2
positives and reject 2/2 negatives. The positive source passages are not twelve
independent observations. The twelve negatives comprise four non-substantive and
eight insufficient units, including actual headings/citations without operative
contents, metadata overclaims, attribution and promotional assertions. Two AI
agents agreed on all 24 content-basis labels before output; no exclusions or
post-output revisions occurred. Development/validation are fresh public
partitions with source families kept separate, not the original project heldout.

Same-passage support/refutation quality confidence (support first):

| Family | Baseline pair | Candidate pair | Both pass in both arms |
|---|---|---|---|
| CBF01 legal operative rule | .96 / .87 | .98 / .97 | yes |
| CBF02 formal enactment date | 1.00 / .97 | 1.00 / .98 | yes |
| CBF03 catalogue fields | .92 / .87 | .98 / .97 | yes |
| CBF04 award register | .91 / .90 | .96 / .97 | yes |
| CBF05 experimental null finding | .92 / .94 | .93 / .98 | yes |
| CBF06 experimental preference | .94 / .91 | .95 / .96 | yes |

Pass/fail invariance is already 6/6 pairs for the baseline and remains 6/6 for the
candidate. Confidence gaps narrow for some families and widen for CBF05; these
single-pass score differences do not justify promotion. The baseline failure on
the public UNESCO retained passage was not reproduced by these fresh single-source
units. That gap motivates investigation of the actual failure context, rather
than another wording change or threshold adjustment.

Only `content_basis.instructions` changed. All seven criteria and class names,
selected accepted-class check, summed accepted-class confidence, .85 threshold,
state, retained bytes and every other question were identical. The candidate
distinguished a separate metadata title from an actual quoted heading accompanied
by record/operative contents, limited catalogue evidence to its own recorded
fields, and clarified stance-independent basis assessment. The earlier failed
ternary assessment was not used. No production source was edited.

Joint-output spillovers are important despite unchanged quality decisions:

- One rejected category changes from `bare_assertion` to `unclear` (CB11); it
  remains rejected. No substantive-class acceptance threshold crosses.
- Stance probabilities change on 14 units, scope probabilities on 17, and risk
  confidence on 12. Stance choices and risk levels remain unchanged.
- CB20's scope score falls from .85 to .77, changing its scope flag to false.
  CB13's relevance rises from .79 to .85, changing its relevance flag to true.
- CB07 ordinary-risk confidence rises from .83 to .86, crossing the ordinary-risk
  confidence gate. CB10's selected supported-verdict probability rises from .83
  to .85, crossing that probability gate; its content basis still fails.
- Two abstention reason codes change, but all 48 policy decisions remain
  `insufficient_evidence`. No policy verdict or factual-coverage result improves.

These diagnostic changes do not establish their correctness: only content basis
and the separate stance diagnostic were independently labelled for this study.
They demonstrate why another question's scores cannot be assumed stable when a
joint request's wording changes. Raw paired rows, family metrics, all confidence
values, gate crossings and reason changes are retained in `comparison.json`.

The one authorized pass completed 48 consumed Jev attempts / 48 actual started
fetches, 0 Exa, 106,862 measured input tokens, all 48 calls reporting usage,
423,586 request bytes, 66,290 response bytes and 5,521 ms campaign duration.
No retry, failure, unknown usage or budget stop occurred. Exa cost is zero;
Jev USD and output-token cost remain unknown. Source/request/criteria guards
passed before every call; source hashes remained unchanged afterwards. No keys
or authorization headers were recorded.

Plan hash:
`cbea9a2b36cce0be4e1cd87f7c7061e706b357eac6df99dd17d358b313bbb23f`.
This evidence does not authorize replay, production promotion or tuning. Any
subsequent structural diagnostic must have a separate fixed plan and approval.
