# Limited reviewed source capabilities

Reviewed and registered on **2026-11-14** after independently reading the primary
pages and their institutional provenance pages. These are bounded production
capabilities, not live accuracy results. Neither entry changes stance, relevance,
scope, conflict, content-quality or origin
requirements. A definitive high-risk result still needs a substantive retained
expert passage and an independently originating substantive corroborator whose
distinct underlying origins are positively established from retained text.

## NWS lightning recurrence

- Exact host: `weather.gov`; exact path: `/safety/lightning-myths`.
- Registered claim-family expression:
  `/^Lightning (?:(?:can|cannot|does not) strike|never strikes) (?:the )?same place (?:twice|more than once)\.?$/i`.
- Competence: whether lightning can strike one location more than once. Both
  affirmative and negative variants belong to the same reviewed factual family;
  evidence determines polarity. The regex is not a truth assignment.
- Exclusions: shelter advice, tree/vehicle safety, injury treatment, product
  efficacy, current local alerts and any additional proposition or qualifier.
- Rationale: the [NWS mission](https://www.weather.gov/about/nws) includes weather
  warnings and forecasts to protect life and property; its [lightning myths
  page](https://www.weather.gov/safety/lightning-myths) explicitly addresses
  repeated strikes. A detailed page-review governance process was not established
  by the provenance research; this is not a medical or universal weather authority.
- Executable tests: can/never variants eligible with all other gates; altered
  subdomain/path, appended safety recommendation and time/place-qualified local
  forecast ineligible. One anchor alone, same-origin echo or unknown origin still
  abstains. A qualifying opposing passage still vetoes a definitive label.

## NHS asthma symptom possibilities

- Exact host: `nhs.uk`; exact normalized path: `/conditions/asthma` (the source
  URL has a trailing slash, which the matcher strips).
- Registered claim-family expression:
  `/^Asthma (?:(?:can|cannot|does not) cause|never causes) (?:wheezing|coughing|shortness of breath|chest tightness)\.?$/i`.
- Competence: possible general symptoms described by UK patient guidance, not an
  individual diagnosis or an inference that a symptom uniquely proves asthma.
  Negative variants allow a contradictory judgment on that same factual family.
- Exclusions: always/only/guaranteed claims, infancy/pregnancy/other special
  populations, medication or dose instructions, prognosis, treatment comparisons,
  current emergencies and all appended clauses.
- Rationale: the [NHS content policy](https://www.nhs.uk/our-policies/content-policy/)
  describes evidence-based clinical information with qualified clinical approval
  and dated review. The [asthma page](https://www.nhs.uk/conditions/asthma/) is the
  exact source; its symptom section lists all four symptoms, describes variation
  in severity and frequency, and its diagnostic section cautions that breathing
  problems can have different causes. Its institutional review supports only this
  bounded patient-guidance capability. The page reports review on 2025-04-07 with
  the next review due on 2028-04-07. The separate content-policy page reports
  review on 2022-10-14 and a review due date of 2025-10-14: that policy page's
  displayed review is overdue as of this audit. Its description of the clinical
  sign-off process is provenance evidence, not proof that every current page has
  recently passed that process.
- Executable tests: each confirmed symptom and its negation eligible only with
  substantive independent corroboration; diagnosis, treatment, population and
  universal-certainty variants ineligible. Unknown or shared underlying origin
  still abstains. No injected synthetic registry entry enters production.

Page-level provenance review is insufficient to establish a live evidence pair.
In particular, a patient-guidance excerpt that does not disclose its underlying
origin cannot gain a `distinct_origins` relationship merely because another page
uses a different domain. Retain better origin-bearing passages within budget or
abstain. This provenance review has not fetched, inspected or validated a live
corroborator. Policy tests pair an institution's reviewed capability with explicitly
synthetic retained evidence and injected model assessments; they prove the gates
and citation behavior, not provider accuracy, clinical validity or independence of
any real fetched pair. The registration was not selected from a failed live case.
