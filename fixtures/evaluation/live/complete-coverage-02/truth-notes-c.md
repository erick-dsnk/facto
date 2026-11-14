# Prospective labels for CC01–CC08

Authored and independently labeled by the Jev worker before observing campaign output. Eight new ordinary descriptive claims: four true, four false, with one true and one false in each of arts, geography, history and sport. These are OPEN development cases, not blind evaluation. No historical OR/NEW24/sealed case bodies were consulted for authorship or labeling. Labels are not implementation exceptions.

Method: agent inspection of direct public HTTP GET responses using Python urllib, a 30-second per-request timeout and no automated retries. Fifteen GETs total: eight initial pages, four further bounded inspections, and three replacement-topic pages before freeze to remove script/style text and inspect visible lead content. All returned HTTP 200 at the URLs below, without redirects. No Jev or Exa request was made. The SHA-256 values below hash the full received HTML response bytes, not normalized text. Repeated inspections returned the same hashes. Times are UTC. Source excerpts below normalize HTML/whitespace for reading. These are agent inspections, not human review or verified independent primary origins. The labeling pages share one encyclopedia; runtime evidence and all selected citations must be assessed separately.

## CC01 — supported — arts

Claim: Pablo Picasso painted Guernica in 1937.

Scope and label: artist, named work and creation year. The lead explicitly describes Guernica as a 1937 painting by Pablo Picasso; no present ownership/location assertion is included.

- URL: https://en.wikipedia.org/wiki/Guernica_(Picasso)
- Retrieved: 2026-11-14T10:24:13.172221Z
- Body SHA-256: `17eeba7ae070ef468a07e1d8405b230a53c60aa30b98936e78a2614b6bf6c96c`
- Inspected passage: “Guernica is a large 1937 oil painting by Spanish artist Pablo Picasso.”

## CC02 — contradicted — arts

Claim: Verdi's opera Aida had its world premiere in Paris in 1871.

Scope and label: first performance city, not a later European/local premiere. The source identifies the original premiere in Cairo, 24 December 1871; therefore Paris is the false value.

- URL: https://en.wikipedia.org/wiki/Aida
- Retrieved: 2026-11-14T10:24:01.294700Z
- Body SHA-256: `26dae4210dc6586ce9814337d5d69d3d5ea1702d2418d90425d8282f312a113d`
- Inspected passage: “it was commissioned by Cairo's Khedivial Opera House and had its première there on 24 December 1871, in a performance conducted by Giovanni Bottesini.” The lead also identifies Giuseppe Verdi as composer.

## CC03 — contradicted — geography

Claim: Madagascar is an island country in the Atlantic Ocean.

Scope and label: the country Madagascar's ocean location. The source explicitly places it in the Indian Ocean; this contradicts Atlantic rather than describing a different island/country.

- URL: https://en.wikipedia.org/wiki/Madagascar
- Retrieved: 2026-11-14T10:24:01.473812Z
- Body SHA-256: `35d7c33a49e692740d414bec156bb4f7855765a93b1f038ee058aaa51c10cc5d`
- Inspected passage: “Madagascar, officially the Republic of Madagascar, is an island country in the Indian Ocean that includes the island of Madagascar and numerous smaller peripheral islands. Lying off the southeastern coast of Africa...”

## CC04 — supported — geography

Claim: Quito is the capital of Ecuador.

Scope and label: national capital relation between the named city and Ecuador. No population, founding date or superlative is asserted.

- URL: https://en.wikipedia.org/wiki/Quito
- Retrieved: 2026-11-14T10:25:59.879649Z
- HTTP status: 200
- Body SHA-256: `8fd445286ea081b0447cb9ae53559c3556192a72810d78e0a7bd630c878363c5`
- Inspected visible lead: “Capital city of Ecuador”; “This article is about the capital of Ecuador”; infobox names “Quito” and “Country Ecuador”.

## CC05 — supported — history

Claim: The Rosetta Stone was discovered in 1799.

Scope and label: the modern discovery year of the named ancient object, not the year of the decree or the ancient inscription. The source explicitly distinguishes creation in 196 BC from discovery in 1799.

- URL: https://en.wikipedia.org/wiki/Rosetta_Stone
- Retrieved: 2026-11-14T10:27:21.529778Z
- HTTP status: 200
- Body SHA-256: `2c738c68d230c54e0d96c77d68146aaf98e67d0a3ec0bc5a50e98fccd608d86e`
- Inspected visible infobox: “Created 196 BC”; “Discovered 1799 near Rosetta, Nile Delta, Egypt”. Narrative: “It was found there in July 1799 by French army officer Pierre-François Bouchard during France's invasion of Egypt.”

## CC06 — contradicted — history

Claim: The fall of the Berlin Wall occurred in 1991.

Scope and label: the named historical fall/opening event, not completion of physical removal or individual later demolitions. The source identifies 9 November 1989 as the event date. The year 1991 is false for this event.

- URL: https://en.wikipedia.org/wiki/Fall_of_the_Berlin_Wall
- Retrieved: 2026-11-14T10:24:13.173094Z
- Body SHA-256: `72bd69e538dad949b079892d427ac7003d36c76e7d74a6def312c5928a50806a`
- Inspected visible lead: “Fall of the Berlin Wall”; “Date 9 November 1989”. The narrative begins: “The Fall of the Berlin Wall and the fortified inner German border occurred after a Politburo press conference on 9 November 1989...”

## CC07 — supported — sport

Claim: Badminton debuted as an Olympic medal sport at the 1992 Summer Games.

Scope and label: official medal competition, explicitly excluding earlier demonstration/exhibition appearances. The source distinguishes these appearances from the official event debut in 1992.

- URL: https://en.wikipedia.org/wiki/Badminton_at_the_Summer_Olympics
- Retrieved: 2026-11-14T10:24:01.379993Z
- Body SHA-256: `a4d238d52533456112842445aa02fa1ab937c4dff06e88e5759cbd2ce20c005a`
- Inspected passages: “Note: demonstration or exhibition sport years indicated in italics”; “Badminton had its debut as an official event on the 1992 Summer Olympics”; “debuted in competition at the 1992 Games where 4 events were held, with singles and doubles events for both men and women. Four medals were awarded in each event, including two bronzes.”

## CC08 — contradicted — sport

Claim: Brazil hosted the first FIFA World Cup in 1930.

Scope and label: host country of the inaugural men's FIFA World Cup, not winner or a later tournament. The source explicitly identifies Uruguay as the 1930 host country and the first tournament.

- URL: https://en.wikipedia.org/wiki/1930_FIFA_World_Cup
- Retrieved: 2026-11-14T10:24:13.072663Z
- Body SHA-256: `dbf0f9087790348351d9a45342b9002f5d338bd2ceadf96fc2dd15f4445bc474`
- Inspected passage: “The 1930 FIFA World Cup was the first FIFA World Cup, the world championship for men's national football teams. It took place in Uruguay from 13 to 30 July 1930.” Infobox: “Host country Uruguay”.

The JSON contains only LiveCase inputs and prospective expected outcomes. The source notes are labeling evidence; these pages are not preloaded into retrieval and their host is not an authority shortcut. Any abstention, wrong verdict, incomplete source scope, operational failure or inaccessible selected citation remains a campaign failure/limitation under the campaign's frozen metrics.

Prospective revision before source/case freeze: root's independent review identified the drafted CC04 Strait of Gibraltar relation and CC05 original Magna Carta date as underlying-fact reuse from the separately observed aborted OR cohort. Neither draft was dispatched in this campaign. They were replaced by the separately grounded Quito-capital and Panama-opening facts above. The author did not inspect old cohort bodies to make the replacements; root supplied the overlap finding. The earlier draft labels were true but are not part of the final eight-case denominator. The replacement subjects do not duplicate part-a/part-b cases (checked prospectively). No changes are permitted after campaign freeze.

Final prospective freshness correction before dispatch: root's broader OPEN-subject review found that the intermediate CC05 Panama Canal opening topic also appeared in earlier OPEN documentation. That intermediate draft was not dispatched here. CC05 was replaced with the separately fetched and inspected Rosetta Stone discovery-year fact above. This is the final CC05; neither discarded history draft contributes a case to the campaign. No provider calls were made during these revisions.
