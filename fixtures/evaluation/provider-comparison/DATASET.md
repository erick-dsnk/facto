# Complete evaluation dataset

Index of every admission and cohort case used by the Jev vs Laya harness. Machine-readable twin: `dataset-complete.json` (every case with id, text, expected label, category, source, reference, file). Split `dev` is the original data (prompt tuning allowed); split `holdout` is generated, verified, and must not be tuned on. Never send references or rationales to models.

## Files

- devAdmission: `external: reference app test/claims.json (44) + fixtures/evaluation/device-phrases.json (15)`
- devCohort: `fixtures/evaluation/provider-comparison/cohort.json`
- devEvidence: `fixtures/evaluation/provider-comparison/frozen-evidence.json`
- holdoutAdmission: `fixtures/evaluation/provider-comparison/holdout/admission-holdout.json`
- holdoutAdmissionSidecar: `fixtures/evaluation/provider-comparison/holdout/admission-holdout-sidecar.json`
- holdoutCohort: `fixtures/evaluation/provider-comparison/holdout/cohort-holdout.json`
- holdoutEvidence: `fixtures/evaluation/provider-comparison/holdout/frozen-evidence-holdout.json`

## Counts per split and label

| Set | Split | Total | Labels |
|---|---|---:|---|
| admission | dev | 59 | false: 22, needs_confirmation: 1, not_a_claim: 7, speculation: 1, true: 28 |
| admission | holdout | 43 | false: 15, not_a_claim: 10, true: 18 |
| cohort | dev | 24 | cant_verify: 4, false: 8, misleading: 4, true: 8 |
| cohort | holdout | 9 | cant_verify: 3, false: 3, true: 3 |

Admission dev = 44 reference-app everyday claims (text only in the external checkout; ids and labels recovered from results) + 15 device phrases = 59. Admission labels `speculation` and `not_a_claim` are negatives, as are `needs_confirmation`.

## Holdout evidence acquisition

Live Exa, once: known cost $0.126, 0 errors, 23.5 s serial. File `fixtures/evaluation/provider-comparison/holdout/frozen-evidence-holdout.json`; the baseline `frozen-evidence.json` was not touched.

## Holdout cohort (9)

| id | label | category | text | reference |
|---|---|---|---|---|
| H05 | true | world-cup-2022 | The 2022 FIFA World Cup was hosted by Qatar. | https://www.fifa.com/en/tournaments/mens/worldcup/qatar2022 |
| H06 | false | world-cup-2022 | The 2022 FIFA World Cup was hosted by Saudi Arabia. | https://www.fifa.com/en/tournaments/mens/worldcup/qatar2022 |
| H09 | true | gdpr | The EU General Data Protection Regulation has applied since 25 May 2018. | https://eur-lex.europa.eu/eli/reg/2016/679/oj |
| H10 | false | gdpr | The EU General Data Protection Regulation has applied since 2012. | https://eur-lex.europa.eu/eli/reg/2016/679/oj |
| H13 | true | mona-lisa | The Mona Lisa was painted by Leonardo da Vinci. | https://collections.louvre.fr/en/ark:/53355/cl010062370 |
| H14 | false | mona-lisa | The Mona Lisa was painted by Michelangelo. | https://collections.louvre.fr/en/ark:/53355/cl010062370 |
| H21 | cant_verify | riemann | The Riemann hypothesis is true. | https://www.claymath.org/millennium/riemann-hypothesis/ |
| H22 | cant_verify | p-vs-np | P does not equal NP. | https://www.claymath.org/millennium/p-vs-np/ |
| H23 | cant_verify | voynich | The Voynich manuscript contains a message in a natural language. | https://beinecke.library.yale.edu/collections/highlights/voynich-manuscript |

## Holdout admission (43)

| id | label | category | text | reference |
|---|---|---|---|---|
| myth-10 | false | myth | The seasons happen because the Earth is closer to the Sun in summer. | https://spaceplace.nasa.gov/seasons/en/ |
| myth-11 | false | myth | Taking vitamin C regularly prevents the common cold. | https://www.cochrane.org/CD000980/ARI_vitamin-c-for-preventing-and-treating-the-common-cold |
| myth-12 | false | myth | Vikings wore helmets with horns in battle. | https://natmus.dk/ |
| surprise-10 | true | surprise | Octopuses have three hearts. | https://oceanservice.noaa.gov/facts/octopus-hearts.html |
| surprise-11 | true | surprise | Antarctica is the driest continent on Earth. | https://www.usgs.gov/faqs/what-largest-desert-world |
| plain-06 | true | plain | The Pacific Ocean is the largest ocean on Earth. | https://oceanservice.noaa.gov/facts/largestocean.html |
| context-09 | true | context | The crew splashed down in the Pacific Ocean on July 24, 1969. | https://www.nasa.gov/mission/apollo-11/ |
| context-10 | false | context | It was dedicated in 1950. | https://www.nps.gov/linc/learn/historyculture/index.htm |
| context-12 | false | context | It was launched in 1999. | https://science.nasa.gov/mission/hubble/ |
| data-07 | true | data | The Burj Khalifa is 828 meters tall. | https://www.skyscrapercenter.com/building/burj-khalifa/3 |
| data-08 | false | data | Mount Kilimanjaro is 6,895 meters above sea level. | https://whc.unesco.org/en/list/403 |
| data-09 | true | data | The Moon is about 384,000 kilometers from Earth on average. | https://science.nasa.gov/moon/facts/ |
| calc-07 | true | calculation | Fifteen percent of 120 is 18. |  |
| calc-08 | false | calculation | Three hours and twenty minutes is two hundred and fifty minutes. |  |
| calc-09 | true | calculation | A mile is about 1.6 kilometers, so a ten mile run is about 16 kilometers. | https://www.nist.gov/pml/special-publication-811 |
| nonclaim-05 | not_a_claim | nonclaim | I'm so tired of this Monday morning traffic. |  |
| nonclaim-06 | not_a_claim | nonclaim | Please send me the slides before the meeting starts. |  |
| nonclaim-07 | not_a_claim | nonclaim | My sister's birthday is next week. |  |
| sports-01 | true | sports | Spain won the men's FIFA World Cup in 2010. | https://www.fifa.com/en/tournaments/mens/worldcup/southafrica2010 |
| sports-02 | false | sports | A regulation NBA basketball hoop is eight feet above the floor. | https://official.nba.com/rule-no-1-court-dimensions-equipment/ |
| finance-01 | true | finance | The Federal Reserve is the central bank of the United States. | https://www.federalreserve.gov/aboutthefed.htm |
| finance-02 | false | finance | FDIC deposit insurance covers up to one million dollars per depositor per bank. | https://www.fdic.gov/deposit-insurance |
| finance-03 | true | finance | Croatia adopted the euro on January 1, 2023. | https://www.consilium.europa.eu/en/policies/enlargement-euro-area/ |
| history-04 | false | history | World War II ended in 1952. | https://www.nationalww2museum.org/ |
| local-01 | true | local news | The Oresund Bridge links Copenhagen in Denmark with Malmo in Sweden. | https://www.oresundsbron.com/en/ |
| local-02 | false | local news | The Golden Gate Bridge is in Los Angeles. | https://www.goldengate.org/bridge/history-research/ |
| civic-01 | true | civic | The United States Senate has 100 members. | https://www.senate.gov/about/origins-foundations/powers-and-procedures/two-per-state.htm |
| civic-02 | false | civic | A member of the US House of Representatives serves a four-year term. | https://constitution.congress.gov/browse/article-1/section-2/ |
| civic-03 | true | civic | The voting age in the United States was lowered to eighteen by the 26th Amendment. | https://constitution.congress.gov/constitution/amendment-26/ |
| food-01 | true | food | A tablespoon of olive oil contains about 120 calories. | https://fdc.nal.usda.gov/ |
| food-02 | false | food | It is safe to feed honey to babies under one year old. | https://www.cdc.gov/botulism/prevention/index.html |
| food-03 | true | food | The USDA says poultry should be cooked to an internal temperature of 165 degrees Fahrenheit. | https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-minimum-internal-temperature-chart |
| transport-01 | true | transport | The Channel Tunnel connects England and France. | https://www.eurotunnel.com/ |
| transport-02 | false | transport | Japan's Shinkansen bullet train began service in 1994. | https://global.jr-central.co.jp/en/company/about/history.html |
| filler-01 | not_a_claim | filler | Okay, so, um, anyway. |  |
| filler-02 | not_a_claim | filler | Right, let's get started then. |  |
| question-01 | not_a_claim | question | How many people live in Tokyo? |  |
| opinion-01 | not_a_claim | opinion | That was the best concert I have ever seen. |  |
| opinion-02 | not_a_claim | opinion | Nobody should ever put ketchup on a steak. |  |
| hedged-01 | not_a_claim | hedged | I think it might rain later, but I'm not really sure. |  |
| joke-01 | not_a_claim | joke | Why did the scarecrow win an award? Because he was outstanding in his field. |  |
| dev-cheetah | true | device-context | Cheetahs are the fastest land animal. | https://nationalzoo.si.edu/animals/cheetah |
| dev-wembley-context | false | device-context | It seats about sixty thousand people. | https://www.wembleystadium.com/ |

## Dev cohort (24) and dev admission (59)

Listed in full in `dataset-complete.json` (`split: dev`). Cohort texts are in `cohort.json`; device phrases in `fixtures/evaluation/device-phrases.json`.

## Dropped generated candidates

| set | id | reason |
|---|---|---|
| admission | myth-09 | Exact duplicate of existing dev cases E16/E17/E38/E42/E45/E46 and cohort P06 (lightning never strikes same place twice). |
| admission | surprise-09 | Ambiguous: sidereal rotation (243 d) exceeds the 224.7 d year, but NASA's fact sheet gives the solar day as about 117 Earth days, which is shorter than the year. Label depends on which 'day' is meant. |
| admission | plain-05 | Near-duplicate of cohort P13 and P17 (water boils at 100 C); pedantic since NIST boiling point is 99.97 C. |
| admission | context-11 | Near-duplicate of existing dev case 'The Panama Canal opened to world trade in 1914'. |
| admission | sports-03 | Near-duplicate of existing dev case 'first modern Olympic Games held in Paris in 1896' (same fact, city flipped). |
| admission | sports-04 | Near-duplicate of existing dev case 'Wimbledon Championships are played on grass courts' (label flipped). |
| admission | history-01 | Near-duplicate of existing dev case 'The fall of the Berlin Wall occurred in 1991'. |
| admission | history-02 | Near-duplicate of existing dev Magna Carta year cases (1216, 1315). |
| admission | history-03 | Near-duplicate of existing dev case 'Declaration of Independence adopted in 1776'; also July 2 vs July 4 nuance. |
| admission | tech-01 | Near-duplicate of dev case CB02 (World Wide Web invented by Tim Berners-Lee). |
| admission | tech-02 | Near-duplicate of existing dev iPhone cases (introduced 2001 / announced 9 Jan 2007). |
| admission | quote-01 | Ambiguous label: Armstrong's recorded words omitted 'a'; inserted 'a' is debated, so true vs misleading is not unambiguous. |
| admission | quote-02 | Weak label: evidence is a misattribution analysis, not a primary source; 'no source found' could be cant_verify or misleading rather than false. |
| admission | question-02 | Leading question implying a factual claim; ambiguous between not_a_claim and an eligible claim. |
| admission | hedged-02 | Near-duplicate of dev-affair; hedge makes the label ambiguous between not_a_claim and speculation. |
| admission | dev-misheard-central-bank | Near-duplicate of dev-misheard; label depends on how the pipeline treats 'Pannonian'. |
| cohort | H01 | Cited URL federalreservehistory.org/essays/federal-reserve-act returns Content Not Found (real page is /federal-reserve-act-signed); fix source before reuse. |
| cohort | H02 | Shares H01's broken Fed History reference; dropped as a pair. |
| cohort | H03 | Near-duplicate of dev Magna Carta cases; 'sealed' ambiguity noted in dev notes. |
| cohort | H04 | Dropped with H03 (same Magna Carta overlap). |
| cohort | H07 | Near-duplicate of dev case 'World Wide Web invented by Tim Berners-Lee'. |
| cohort | H08 | Same Web-origin near-duplicate as H07. |
| cohort | H11 | Only source is the eurotunnel.com homepage (301 to leshuttle.com); not a primary page supporting the claim. |
| cohort | H12 | Same weak homepage-only reference as H11. |
| cohort | H15 | CDC reference changed (Nov 2025) and now conflicts with the expected label; reference unstable and contested. |
| cohort | H16 | Dropped with H15 (same CDC reference instability). |
| cohort | H17 | Self-declared ambiguous label; strict 'misleading' gold contestable. |
| cohort | H18 | Olympics.com says Games are held every four years, so 'misleading' is weak; theme overlaps dev Olympic cases. |
| cohort | H19 | Self-declared ambiguous label; literal legal reading gives false. |
| cohort | H20 | Near-duplicate of dev-everest and heldout Everest cases; ambiguous label. |
| cohort | H24 | Cited TIGHAR page does not support the label; running out of fuel is a leading hypothesis so cant_verify is not safely unambiguous. |
