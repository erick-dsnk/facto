# Verdict policy fixtures

The executable cases in `services/api/src/policy/verdict.test.ts` use synthetic
passages and `.test`/example domains to exercise control flow. They are not live
retrieval results or measured fact-checking accuracy. The scoped NOAA fixture
tests the registry URL and proposition boundary, not a new provider fetch.

Each definitive fixture carries a retained excerpt, exact URL, validated evidence
ID and explicit server-only content/risk assessments. Positive ordinary fixtures
describe substantive synthetic records with distinct underlying origins. Negative
cases include unsupported repetition, promotional benefits, mere attribution,
unknown content, low confidence, disclosed shared studies/press releases and
transitive origin chains through a nonqualifying retained passage. The conflict
veto remains conservative even for poorly assessed opposing passages.

`policy/sources.ts` documents the small source registry. New single-source
exceptions require a proposition-specific source review; `sourceRole: primary`
alone never authorizes a definitive verdict. Ordinary claims need either an exact
reviewed fact-specific authority or at least two separate evidence families with
substantive model-assessed content. Reviewed authority also needs qualifying
retained content, relevance, scope and stance. Model assessment is not verified
publisher reliability; two fabricated substantive reports remain a limitation.

Health/safety, disputed and uncertain-risk claims require a reviewed expert anchor
competent for that exact fact plus a substantive corroborator with positively
disclosed distinct underlying origin. Unknown domains cannot become reviewed
experts through model output. The production registry has only two reviewed
high-risk capabilities: lightning recurrence on one NWS page and general asthma
symptom possibilities on one NHS page. The exact boundaries, primary references,
review date and limitations are recorded in `source-capability-proposal.md`.
The explicit synthetic expert rule used by policy unit tests is injected only
there; another assertion proves production rules do not include it. These tests
prove control flow, not measured medical accuracy or live source independence.
The same gates apply to support, contradiction and evidence for a misleading
context defect. The complete qualifying corroboration set is retained in selected
citation IDs, with the selected best passage first.

`policy/assessment.ts` defines the internal structural extension of `Judgment`;
the app's v1 schemas and result DTO are unchanged. Missing assessments fail closed;
malformed probabilities, assessment enums or retained IDs are operational errors.
The joint Jev request adds one risk question, one content-basis question per
retained passage and one origin question per unordered pair: at most 55 questions
for six passages, still one provider attempt. Actual token usage and latency need
live measurement; fixture question-count tests do not establish provider capacity.
