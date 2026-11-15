# Complete evaluation dataset

Index of every admission and cohort case used by the Jev vs Laya harness. Machine-readable twin: `dataset-complete.json` (every case with id, text, expected label, category, source, reference, file). Split `dev` is the original data (prompt tuning allowed); split `holdout` is generated, verified, and must not be tuned on. Never send references or rationales to models.

## Files

- devAdmission: `external: reference app test/claims.json (44) + fixtures/evaluation/device-phrases.json (15)`
- devCohort: `fixtures/evaluation/provider-comparison/cohort.json`
- devEvidence: `fixtures/evaluation/provider-comparison/frozen-evidence.json`
- holdoutAdmission: `fixtures/evaluation/provider-comparison/holdout/admission-holdout.json`
- holdoutAdmissionSidecar: `fixtures/evaluation/provider-comparison/holdout/admission-holdout-sidecar.json`
- holdoutCohort: `fixtures/evaluation/provider-comparison/holdout/cohort-holdout.json`
- claimbusterAdmission: `fixtures/evaluation/provider-comparison/claimbuster/` (see its README)
- holdoutEvidence: `fixtures/evaluation/provider-comparison/holdout/frozen-evidence-holdout.json`

## Counts per split and label

| Set | Split | Total | Labels |
|---|---|---:|---|
| admission | dev | 59 | false: 22, needs_confirmation: 1, not_a_claim: 7, speculation: 1, true: 28 |
| admission | holdout | 59 | false: 20, not_a_claim: 14, true: 25 |
| cohort | dev | 24 | cant_verify: 4, false: 8, misleading: 4, true: 8 |
| cohort | holdout | 24 | cant_verify: 3, false: 10, misleading: 1, true: 10 |

Generated vs original: original admission/dev 59, cohort/dev 24; generated admission/holdout 59, cohort/holdout 24.

Admission dev = 44 reference-app everyday claims + 15 device phrases = 59. Admission labels `speculation`, `not_a_claim` and `needs_confirmation` are negatives. Holdout round 1 (original 43 admission, 9 cohort) was topped up with `t1-*` admission cases (16) and cohort T104, T112-T125 (15), all marked `round: topup-r1` in the JSON.

## Holdout evidence acquisition

Round 1: live Exa, known cost $0.126, 0 errors, 23.5 s serial.
Top-up: live Exa for the 15 new cohort cases only, known cost $0.21, 0 errors, 23.7 s (summed call time). Total $0.336. Records were merged into `holdout/frozen-evidence-holdout.json` without altering existing records; the baseline `frozen-evidence.json` was not touched.

## Holdout cohort (24)

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
| T104 | misleading | evemissions | Electric cars produce no emissions. | https://afdc.energy.gov/vehicles/electric-emissions |
| T112 | false | natosweden | Sweden has been a NATO member since 2023. | https://www.nato.int/cps/en/natohq/topics_52044.htm |
| T113 | false | nato31 | NATO has 31 member countries. | https://www.nato.int/cps/en/natohq/topics_52044.htm |
| T114 | false | euro20 | The euro is the currency of 20 European Union member states. | https://www.ecb.europa.eu/euro/intro/html/index.en.html |
| T115 | false | china | China is the most populous country in the world. | https://www.un.org/en/global-issues/population |
| T116 | true | chevron | The US Supreme Court overruled Chevron deference in Loper Bright Enterprises v. Raimondo. | https://www.supremecourt.gov/opinions/23pdf/22-451_7m58.pdf |
| T117 | true | iss | The International Space Station has been continuously occupied since November 2000. | https://www.nasa.gov/international-space-station/ |
| T118 | false | iarccoffee | The IARC classifies drinking coffee as possibly carcinogenic to humans. | https://www.iarc.who.int/wp-content/uploads/2018/07/pr244_E.pdf |
| T119 | false | chromecookies | Google Chrome has phased out third-party cookies for all users. | https://privacysandbox.google.com/blog/privacy-sandbox-next-steps |
| T120 | true | win10eos | Windows 10 reached its end of support date on 14 October 2025. | https://support.microsoft.com/en-us/windows/windows-10-support-has-ended-on-october-14-2025-2ca8b313-1946-43d3-b55c-2b95b107f281 |
| T121 | true | smallpox | Smallpox is the only infectious disease that WHO has declared eradicated in humans. | https://www.who.int/health-topics/smallpox |
| T122 | true | pele | Pele is the only footballer to have won three men's World Cups. | https://inside.fifa.com/organisation/news/pele-immortal-forever-with-us |
| T123 | true | gotthard | The Gotthard Base Tunnel in Switzerland is the world's longest railway tunnel. | https://uic.org/com/enews/nr/502/article/the-world-s-longest-and-deepest-railway-tunnel-officially-inaugurated-in |
| T124 | true | dylan | Bob Dylan won the Nobel Prize in Literature in 2016. | https://www.nobelprize.org/prizes/literature/2016/dylan/facts |
| T125 | false | cofer | The US dollar accounts for less than half of global foreign exchange reserves. | https://data.imf.org/en/news/october-1-2025-cofer |

## Holdout admission (59)

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
| t1-implicit-flu-shot | false | implicit_conversational | Yeah, I skipped the flu shot this year because it can actually give you the flu. | https://www.cdc.gov/flu/prevention/misconceptions.html |
| t1-implicit-youtube | true | implicit_conversational | Remember when Google bought YouTube for like one point six five billion dollars back in 2006? | https://googlepress.blogspot.com/2006/10/google-to-acquire-youtube-for-165_09.html |
| t1-number-mariana | true | number | The Mariana Trench goes down nearly eleven thousand meters at its deepest point. | https://oceanservice.noaa.gov/facts/oceandepth.html |
| t1-comparative-jupiter | true | comparative | Jupiter is more than twice as massive as all the other planets in the solar system put together. | https://science.nasa.gov/jupiter/facts/ |
| t1-superlative-monaco | false | superlative | Monaco is the smallest country in the world. | https://www.cia.gov/the-world-factbook/countries/holy-see-vatican-city/ |
| t1-time-euro-cash | false | time_qualifier | Euro banknotes and coins went into everyday circulation back in 1999. | https://www.ecb.europa.eu/euro/changeover/html/index.en.html |
| t1-time-hongkong | true | time_qualifier | Back in the nineties Hong Kong was still under British rule until it was handed over to China in 1997. | https://www.gov.hk/en/about/abouthk/facts.htm |
| t1-time-hawaii-alaska | false | time_qualifier | Hawaii was admitted to the Union before Alaska was. | https://www.congress.gov/crs-product/R47747 |
| t1-rhetorical-toronto | false | rhetorical_question | Come on, everybody knows Toronto is the capital of Canada, right? | https://www.cia.gov/the-world-factbook/countries/canada/ |
| t1-hedged-rome | true | hedged_checkable | If I remember right, the Treaty of Rome was signed in 1957, creating the European Economic Community. | https://european-union.europa.eu/principles-countries-history/history-eu/1945-59_en |
| t1-context-tereshkova | true | device_context_fragment | She became the first woman in space in 1963. | https://airandspace.si.edu/stories/editorial/valentina-tereshkova |
| t1-context-voyager | true | device_context_fragment | It's now the most distant human-made object from Earth. | https://science.nasa.gov/mission/voyager/voyager-1/ |
| t1-neg-heat-opinion | not_a_claim | opinion_with_number | Honestly, forty degrees Celsius is way too hot for any city to be livable. |  |
| t1-neg-plan-flight | not_a_claim | plan | We're flying to Lisbon on the third of March and I booked the hotel for six nights. |  |
| t1-neg-hypothetical-moon | not_a_claim | hypothetical | If the Moon were twice as close, the tides would probably be absolutely insane. |  |
| t1-neg-joke-udp | not_a_claim | joke | I'd tell you a UDP joke, but you might not get it. |  |

## Dev cohort (24) and dev admission (59)

Listed in `dataset-complete.json` (`split: dev`). Cohort texts are in `cohort.json`; device phrases in `fixtures/evaluation/device-phrases.json`. The 44 everyday admission rows have text null in the committed index; the full text is outside the repo (scratchpad `data/dataset-complete-full.json` and `data/DATASET-full.md`, built from the harness `loadSets` over the reference app claims).

## ClaimBuster admission sets (240)

Real, human-labelled debate sentences from ClaimBuster (Zenodo 3609356, CC-BY-4.0, Arslan et al., ICWSM 2020), added for the per-provider prompt tuning (#69). Debates are split dev/holdout at the debate level (seed 20261114), so no debate appears in both. Rows are `set: admission-claimbuster` in `dataset-complete.json`; `category` is the ClaimBuster label.

| Split | CFS (check-worthy) | NFS (not a claim) | UFS (unimportant factual) | Files |
|---|---:|---:|---:|---|
| dev | 50 | 40 | 30 | `claimbuster/admission-cb-dev.json` (CFS+NFS, 90), `claimbuster/admission-cb-dev-ufs.json` (30) |
| holdout | 50 | 40 | 30 | `claimbuster/admission-cb-holdout.json` (CFS+NFS, 90), `claimbuster/admission-cb-holdout-ufs.json` (30) |

Mapping: CFS to `cant_verify` (eligible: must be admitted for checking), NFS to `not_a_claim`, UFS to `cant_verify` but kept apart and only reported as `ufsAdmitted` (the label is a judgement of importance, not of claim-hood). Six NFS ids were flagged by an auditor as probably mislabelled claims (`cb-dev-nfs-7923`, `-7871`, `-23824`, `-24794`, `-15084`, `cb-holdout-nfs-10465`) and are reported as `cbCorrectExFlagged`. See `claimbuster/README.md`.

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
| admission | t1-implicit-swiss-eu | Compound claim. Switzerland is not in the EU, but EU roam-like-at-home does not cover Switzerland, so the 'no roaming charges' clause is false. Label true is wrong or ambiguous. |
| admission | t1-time-bulgaria-euro | Relative-time claim ('this year') is true only in 2026 (Bulgaria adopted the euro on 1 Jan 2026), so the label expires. Perishable fixture. |
| admission | t1-hedged-liberty | Statue of Liberty was a gift from France, so the claim is false. But the strong hedge ('don't quote me') makes speculation or not_a_claim a reasonable alternative reading, so the false label is not unambiguous. |
| admission | t1-context-mona-lisa | Near-duplicate of cohort-holdout H13/H14 and dataset-complete (Mona Lisa painter). Same underlying fact. |
| admission | t1-neg-private-raise | Private reported promise about the future. Reasonable alternatives are needs_confirmation, speculation or not_a_claim, so the label is not unambiguous. |
| admission | t1-neg-speculation-referee | 'I bet the referee was paid off' could equally be opinion or not_a_claim, so speculation is not unambiguous. |
| admission | t1-reported-ibuprofen | Reported speech ('my doctor told me') is ambiguous. The reasonable labels are false (the embedded claim is wrong) and not_a_claim or attributed. The expected label is not unambiguous. |
| admission | t1-rhetorical-pluto | Near-duplicate of the existing live fixtures (Pluto reclassified as a dwarf planet in 2006, e.g. live-development-02/04/07 and the broader baseline-03 fact-or-fiction item). |
| admission | t1-neg-plan-marathon | Not selected by the verification pass for the holdout (no individual reason recorded). |
| admission | t1-neg-question-avocado | Not selected by the verification pass for the holdout (no individual reason recorded). |
| admission | t1-neg-device-command | Not selected by the verification pass for the holdout (no individual reason recorded). |
| admission | t1-neg-hypothetical-two-moons | Not selected by the verification pass for the holdout (no individual reason recorded). |
| admission | t1-neg-speculation-senator | Not selected by the verification pass for the holdout (no individual reason recorded). |
| cohort | T101 | Vague generalization; 'misleading' is not clearly the best primary label. A colloquial true reading (high LDL is bad) is plausible but only 'false' is predeclared as an alternative. |
| cohort | T102 | Near-duplicate of holdout admission case myth-11 'Taking vitamin C regularly prevents the common cold.' (same Cochrane fact, labelled false there); the labels also conflict (misleading vs false). |
| cohort | T103 | US minimum wage conventionally means the federal $7.25, so true is arguably the best label; misleading is not clearly best and the case is jurisdiction-dependent. |
| cohort | T105 | The case's own rationale says the plain reading is false (Bitcoin is pseudonymous, not anonymous), so 'misleading' is internally inconsistent; false is the better primary label. |
| cohort | T106 | IARC Group 2B with limited evidence: misleading, false and cant_verify are all defensible; 'causes cancer' is an unqualified causal claim that false covers better. Alternatives do not make misleading clearly best. |
| cohort | T107 | A literal reading of 'freed all enslaved people' is plainly false (the proclamation applied only to Confederate areas in rebellion), so false, not misleading, is the primary label. |
| cohort | T108 | WHO ended the PHEIC and did not declare the pandemic over, so the claim is factually false; media-shorthand true reading is not predeclared. Misleading is not clearly best. |
| cohort | T109 | The AI Act became applicable 2 Aug 2026 with high-risk rules postponed to Dec 2027 and Aug 2028; 'in full' is simply false. The claim is also fast-moving and time-sensitive. |
| cohort | T110 | Tomatoes are botanically fruit and culinarily or legally vegetables; true, misleading and false are all defensible. The Justia reference was also unconfirmed (403). |
| cohort | T111 | Microsoft confirms support ended 14 Oct 2025 (ESU to 12 Oct 2027 is a narrow exception); 'no longer supported' reads as true, so misleading is not clearly best. Overlaps T120 (same fact and source). |
