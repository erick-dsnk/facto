# Part B prospective labels

Eight NEW OPEN development inputs: four true, four false; four science and four technology. Each input is entirely public and has one exact accepted span equal to its whole text. These are prospective world-truth labels, not provider answers or blind evaluation. No historical sealed/held-out bodies were read; no Jev/Exa call occurred. Known prior OR and NEW24 topics were excluded. No production source was changed.

## Inspection method and resource accounting

Agent direct public GET inspection, 2026-11-14 UTC. Maximum 15 seconds and 1,048,576 response bytes per request; at most four concurrent requests; no automated retries or redirects. Fourteen direct GET attempts were made: eight initial URLs, five alternative URLs, then one alternative electron article to avoid reliance on generated FAQ text. Failed or non-substantive first URLs are preserved below. A source's institutional status was not treated as proof: the quoted body content was inspected. No campaign citation is pre-approved by these ground-truth notes; every selected live citation requires its own verification.

HTML text excerpts below were extracted by removing script/style/tag markup, decoding entities and normalizing whitespace. SHA-256 values hash the actual fetched response bytes, not extracted text. Raw page bodies are not separately retained; hashes and observed excerpts support this time-bounded agent inspection but cannot reconstruct omitted page material. Britannica pages include generated FAQ content; quotes selected below come from the main article passages rather than those generated FAQ answers.

## Prospective expected facts

| Case | Expected | Ground truth and inspected body passage |
| --- | --- | --- |
| CB01 | supported | Modern byte has eight bits. Britannica: “A byte consists of 8 adjacent binary digits (bits)” and historical qualification “eventually the standard settled on eight bits.” Modern-computing wording deliberately excludes historical variable-sized bytes. |
| CB02 | supported | Tim Berners-Lee invented/developed the Web, with CERN colleagues. Main Britannica article: “The development of the World Wide Web was begun in 1989 by Tim Berners-Lee and his colleagues at CERN”. Input does not assert he worked alone. |
| CB03 | supported | NASA Mercury facts: “Mercury is the smallest planet in our solar system and nearest to the Sun.” This is orbital order, not a claim that Mercury is always the spatially nearest planet to Earth. |
| CB04 | supported | Main Britannica sound article: “sound, a mechanical disturbance from a state of equilibrium that propagates through an elastic material medium.” This establishes material-medium requirement; no claim about sound speed is made. |
| CB05 | contradicted | Main Britannica Sputnik article: “Sputnik, any of a series of three artificial Earth satellites, the first of whose launch by the Soviet Union on October 4, 1957, inaugurated the space age.” First satellite's launch was 1957, not 1967. |
| CB06 | contradicted | Python FAQ's “Why was Python created in the first place?” section introduces “a very brief summary of what started it all, written by Guido van Rossum”; its naming section says “When he began implementing Python, Guido van Rossum was also reading” Monty Python scripts. Guido van Rossum created Python, not Dennis Ritchie. The initial foreword did not clearly establish creator role and is not used alone. |
| CB07 | contradicted | Main Britannica subatomic-particle article: “Subatomic particles include electrons, the negatively charged, almost massless particles that nevertheless account for most of the size of the atom”. Electron charge is negative, not positive; this is not a positron claim. |
| CB08 | contradicted | NASA Jupiter facts: “As a gas giant, Jupiter doesn’t have a true surface. The planet is mostly swirling gases and liquids” and “With no solid surface to slow them down, Jupiter's spots can persist for many years.” Possible interior/core material is not a solid Earth-like surface. |

## Used source receipts

| Case | URL | Inspected UTC | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| CB01 | https://www.britannica.com/technology/byte | 2026-11-14T10:24:08.466193+00:00 | 82559 | `853a948081c711db3ad63bf1619e892dd6741b9945e0f47e0ab03b052eed59f5` |
| CB02 | https://www.britannica.com/topic/World-Wide-Web | 2026-11-14T10:24:40.780761+00:00 | 143068 | `5f9e961c73f34da6ce03da1a0e45944177f24ac0fa1a64e3cd5dbc599e96ef41` |
| CB03 | https://science.nasa.gov/mercury/facts/ | 2026-11-14T10:24:08.406745+00:00 | 276595 | `139d554d9140a57b0926d9d6d07c9ad2e9e12f82474e9bd3e181f473531ca245` |
| CB04 | https://www.britannica.com/science/sound-physics | 2026-11-14T10:24:40.855725+00:00 | 181908 | `6be911783ea5f460e8c40c0d4019bd9b9b69af9f85747e1dba03d97e02a7be3b` |
| CB05 | https://www.britannica.com/technology/Sputnik | 2026-11-14T10:24:40.833053+00:00 | 105684 | `57ff27a36c3adce3e24cd5f4c5978e0996ce583b5598694cc9427e6721263f9b` |
| CB06 | https://docs.python.org/3/faq/general.html | 2026-11-14T10:24:40.949410+00:00 | 49671 | `f91fe28084508d4de20a35caf67859640a0449d67b1677fb0429f5e065e350ed` |
| CB07 | https://www.britannica.com/science/subatomic-particle | 2026-11-14T10:24:51.540184+00:00 | 187617 | `2ab9efe91850988ecea995b29ebeb5ed87dced2545bc0b95c01bc4e14c5ac4a0` |
| CB08 | https://science.nasa.gov/jupiter/jupiter-facts/ | 2026-11-14T10:24:40.921465+00:00 | 285807 | `9e93427160827c309695924ddec8e59948ca09a641994384097ddd87502e4492` |

All used receipts were HTTP 200 and below the individual cap.

## Preserved first-source limitations

- CB02 `https://home.cern/science/computing/birth-web`: HTTP 404 during first group near 10:24:08 UTC; no response-body hash captured by the error handler. No retry of that URL.
- CB04 `https://www.grc.nasa.gov/www/k-12/airplane/sound.html`: HTTP 200 at 10:24:08.646571 UTC, 1229 bytes, SHA-256 `6276d6ec1e469ade0b58163a9e5cc043bc2c448b42005257f5309d773bf3cf1f`; no substantive medium/vacuum passage. Excluded as evidence.
- CB05 `https://www.nasa.gov/history/sputnik/`: HTTP 200 at 10:24:09.049330 UTC, 2468 bytes, SHA-256 `5955ce55430e1444e96f0a82c3aabe2fb40dac6abda253c707be86eece985622`; no launch-year passage. Excluded as evidence.
- CB06 `https://www.python.org/doc/essays/foreword/`: HTTP 200 at 10:24:08.613583 UTC, 39762 bytes, SHA-256 `4dcdc61138640d56b1e52f0b0fddc089ed395f9a7c958a242f61228ec4e0836a`; Guido's signature alone did not establish creator attribution, so FAQ used instead.
- CB07 `https://www.britannica.com/science/electron`: HTTP 200 at 10:24:08.832779 UTC, 159191 bytes, SHA-256 `9a8a1db569287f8af2a71a2bc9443da8aebffbc18cbdd6294d2d131ff57b5317`; first extracted directional-charge answers included generated FAQ material. Independent main article on subatomic particles used for label support instead.
- CB08 `https://science.nasa.gov/jupiter/facts/`: HTTP 301 during first group near 10:24:08 UTC; automatic redirect disabled and no response-body hash captured. A separate explicit GET used the known alternate path `https://science.nasa.gov/jupiter/jupiter-facts/`; this is not a hidden redirect or failed-request retry.

No source-access failure was converted to factual evidence. This small ordinary corpus excludes health/safety claims and does not establish production accuracy, risk-domain performance, or independence of future retrieved references.
