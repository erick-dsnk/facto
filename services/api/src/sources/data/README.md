# Domain lists

The app reads these lists to filter and rank search results before the model judges a claim, and to name the sources it shows.

The three domain lists use one domain per line. Domains are lowercase, with no scheme and no `www.`. Lines starting with `#` are comments. A domain should also cover its subdomains.

| File | Use | Entries |
|---|---|---|
| `unreliable-domains.txt` | Drop these results. Never use them as evidence. | 1,726 |
| `low-signal-domains.txt` | Not fake news, but not evidence either. Drop or rank last. | 97 |
| `trusted-domains.txt` | Rank these first. Lines ending in `  # query` are the 8 domains for a site-restricted second search. | 40 |
| `cities.txt` | The 5 most populous places per country, for weather claims about a whole country. Not a domain list. | 975 |

## unreliable-domains.txt

**Source:** CRED-1 by Alexander Loth, https://github.com/aloth/cred-1. File `data/cred1_current.json`, commit `54b8865`, dataset release of 2026-11-10. Retrieved 2026-11-13. DOI: https://doi.org/10.5281/zenodo.18769459

**License:** CC BY 4.0. You must keep the attribution below with the file.

> "CRED-1" by Alexander Loth, https://github.com/aloth/cred-1, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Built from OpenSources.co (Melissa Zimdars et al., CC BY 4.0) and the Iffy.news Index (CC BY 4.0). This list is a filtered subset: see the inclusion rule.

**How CRED-1 labels domains.** It merges two lists. OpenSources.co was written by media researchers and last updated around 2017. The Iffy.news Index lists sites that Media Bias/Fact Check rates low in factual reporting, and flags sites named in Wikipedia's fake news lists. CRED-1 maps those labels to categories: fake, conspiracy, unreliable, mixed and satire. Each category has a base score, which is blended with Iffy.news scores, Google Fact Check claim counts, Tranco rank and domain age into a `credibility_score` from 0 to 1. CRED-1 calls a score of 0.20 or less "low".

**Inclusion rule.** A domain is included when `category` is `fake`, `conspiracy` or `unreliable` AND `credibility_score <= 0.20`. That leaves out the `mixed` and `satire` categories entirely.

Also removed:

- 10 entries that name a path rather than a whole domain, such as `cato.org/blog` and `westernjournal.com/commentary`. Blocking the whole domain would go further than the source does. One malformed entry, `silver-coin-investor. com`, was removed too.
- 4 domains that meet the rule but are large national outlets: `breitbart.com`, `gbnews.com`, `newsmax.com`, `oann.com`. They are held back for the owner to decide.

**Sanity check.** None of the major references, news outlets, fact-checkers or platforms listed in the task brief appears in the file. The only one of them in CRED-1 at all is `foxnews.com`, rated `mixed` (0.482), and the rule excludes it.

**Why CRED-1.** CRED-1 states its license, documents its scoring, and is rebuilt every week. The alternative, Jana Lasser's `misinformation_domains`, was last updated in 2022, and most of the lists it merges have no license. Wikipedia's "List of fake news websites" has no scores, and CRED-1 already includes it through the Iffy.news Wiki Fake flag.

**Known limits.** About 740 entries are templated local "pink slime" sites from one network (Brian Timpone). OpenSources.co labels date from 2016 to 2017. Coverage is mostly English-language. A domain missing from the list is unknown, not trusted.

**Refresh.**

1. Clone `https://github.com/aloth/cred-1` into an empty directory. Treat it as data only and do not run its code.
2. Load `data/cred1_current.json` and apply the inclusion rule.
3. Drop keys that contain `/`, `#`, `?` or a space. Strip `www.`.
4. Keep the four held-back domains out unless the owner decides otherwise.
5. Check that no domain from the sanity list appears. Sort, remove duplicates, and update the header: commit, release date and retrieval date.

## low-signal-domains.txt

Hand-written on 2026-11-13. The groups are:

- social networks and user posts
- video, streaming and audio services
- document uploads and dumps
- satire
- AI-written encyclopedias
- Q&A and homework-answer farms

CRED-1 rates 13 of the 16 satire domains `satire`. The other three, `babylonbee.com`, `duffelblog.com` and `legorafi.fr`, are well-known satire sites, and each one resolved when checked.

The owner's rule for the video, streaming and audio group: these services are never evidence. The group covers video sites (YouTube, Vimeo, Dailymotion, Rumble, BitChute, Odysee, Bilibili and others), live streaming (Twitch, Kick), paid streaming (Netflix, Hulu, Disney+, Prime Video, Max, Peacock, Paramount+, Apple TV) and audio and podcasts (Spotify, SoundCloud, Apple Music and Podcasts, Amazon Music, Audible, Deezer, Tidal and others). An entry covers its subdomains, so `youtube.com` also blocks `m.youtube.com` and `music.youtube.com`. Entries such as `podcasts.apple.com` and `music.amazon.com` block only that service, not the rest of `apple.com` or `amazon.com`.

To refresh, edit the file by hand and keep it under about 120 entries.

## trusted-domains.txt

Hand-written on 2026-11-13. The groups are reference works, fact-checkers, news agencies, public health and science bodies, and broadcasters and papers of record from several countries.

Fact-checker status:

- `politifact.com` and `factcheck.org` hold IFCN profiles. The latest badges found were issued in early 2024, and current renewal was not confirmed.
- `fullfact.org`, `factcheck.afp.com`, `leadstories.com`, `science.feedback.org`, `correctiv.org` and `maldita.es` are verified members of the European Fact-Checking Standards Network (EFCSN).
- `snopes.com` has run since 1994. It is not confirmed as a current IFCN signatory.
- Science Feedback moved to `science.feedback.org`. The old domain, `sciencefeedback.co`, redirects there.

The 8 `# query` domains are `wikipedia.org`, `britannica.com`, `snopes.com`, `politifact.com`, `factcheck.org`, `fullfact.org`, `factcheck.afp.com` and `leadstories.com`. They were picked because they answer the widest range of claims.

To refresh, check that each domain still loads and still belongs to the same organization. Check fact-checker status on the IFCN signatories page (https://ifcncodeofprinciples.poynter.org/signatories) and the EFCSN members page (https://members.efcsn.com/signatories).

`wikidata.org` was added on 2026-11-13 with the Wikidata source, so it stands where Wikipedia does. It is not a `# query` domain.

## cities.txt

**Source:** GeoNames, `cities15000.zip` (all places with a population over 15,000), https://download.geonames.org/export/dump/. Retrieved 2026-11-13.

**License:** CC BY 4.0. Keep this attribution with the file:

> Contains data from GeoNames (https://www.geonames.org/), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). This file is a filtered subset: see the inclusion rule.

**Inclusion rule.** Feature class `P` (populated places), leaving out sections and historical or abandoned places (`PPLX`, `PPLH`, `PPLQ`, `PPLW`, `PPLCH`). For each ISO country code, the 5 places with the largest population, ties broken by name. Columns, tab-separated: name as GeoNames writes it, country code, latitude and longitude to 4 decimals. 244 countries, 975 places.

**Known limits.** GeoNames counts some boroughs as places, so the United States list holds Brooklyn and Queens next to New York City. A region is not sampled from this list; the app looks it up by name instead.

**Refresh.** Download `cities15000.zip` into an empty directory, unzip it, apply the rule above with a short script run with `python3 -I`, and keep the two header lines.

## publisher-names.txt

Hand-written on 2026-11-13. Display names for source sites, so a verdict can say "according to NASA" instead of `nasa.gov`. Each line holds a site, two or more spaces, and the name. A site covers its subdomains. The file covers every domain in `trusted-domains.txt` and about 40 other well-known outlets and public bodies. A site not listed shows its bare host. It names no site from the held-back four (`breitbart.com`, `gbnews.com`, `newsmax.com`, `oann.com`).

To refresh, add or fix lines by hand and keep every trusted domain covered; a unit test checks that.

## test/claims.json

44 labeled claims for measuring accuracy:

- 8 myths (`false`)
- 8 true claims that sound false
- 4 plain true facts
- 4 non-claims (`not_a_claim`)
- 8 context-dependent claims (4 true, 4 false)
- 6 facts about named things that Wikidata holds (`data-`, 3 true, 3 false)
- 6 calculations (`calc-`, 4 true, 2 false)

Weather and news claims are left out on purpose: their right answer changes within days. Tests with recorded responses in `test/recorded/` cover them.

Each claim has a `source` URL that was checked against its label. Non-claims have `source: null`, because no source can settle an opinion, a prediction, code or a greeting. For context-dependent claims, `context.title` and `context.before` name the subject that the claim's pronoun refers to.
