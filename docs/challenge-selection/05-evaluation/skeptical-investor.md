# Evaluation lens: sceptical investor (real-world usefulness and repeat value)

**Summary**
- My question for each candidate: is the problem real, who cares enough to use it, **what brings them back after the first demo (the recurring trigger)**, and what is the believable next step. This is the Kia / Otto / Umar / Timo half of the overall jury (00-rules-and-jury.md §5, rubric rows 1 and 6).
- **Top three:** `did-i` (72): a daily trigger, and a crowd of phone "proof of checking" apps shows people already want this. `panel-reader` (68): a well-documented blind-user problem, used every time an appliance is used. `glance-log` (60), tied with `basket` (60): a job that repeats by definition, with a clear buyer, and a weekly shop with a parent who cares.
- **Weakest:** `which-way-now` (28), `heads-up-sounds` (30), `cross-contact` (34) and `show-me-once` (35). Their triggers are occasional, existing tools already cover the need, or the setting will not tolerate the device for long enough.
- There are no hard rejects on this lens. `heads-up-sounds` and `which-way-now` come close to "an existing product": iPhone Sound Recognition already names doorbell and baby-cry sounds, and journey apps already give the platform.
- One caveat applies to every candidate. The repeat trigger only works if the user **is wearing Meta glasses at that moment**. None of our sources measure how many hours a day owners wear them (unknown). So any candidate whose trigger happens at home, indoors or all day carries an unverified assumption about wear time.

---

## 1. Criteria and scale

All scores are my **estimates** on one shared scale. They measure usefulness and repeat value only, not novelty, technical risk or demo wow, which other evaluators cover.

| Weight (estimate) | Question |
|---|---|
| 30% | **Recurring trigger:** does the need come back on its own, daily or weekly, at a moment when the user is plausibly wearing the glasses? |
| 25% | **Severity and who cares:** how badly does a named user suffer without it (consequence, frequency, emotion), and how many such users are there? |
| 20% | **Beats the incumbent:** is it clearly better than what the user does today (phone app, smart device, a person, a habit), or is it only "nice on glasses"? |
| 15% | **Believable next step:** a named pilot type, a buyer, and a deployment that does not depend on facts we cannot verify |
| 10% | **Trust that survives use:** will one wrong answer end the habit (safety-critical false negatives), or can the user tolerate errors? |

Scale anchors: 80+ means I would fund a pilot on this evidence. 60-79 means a real need and a real trigger with one major doubt. 40-59 means a plausible but occasional or niche need. Below 40 means use is a one-off, or the incumbent already wins.

The hard_reject rule from the brief (essentially an existing product, inaccessible data and so on) is applied from this lens only. Device and SDK feasibility belong to other evaluators, but where a beta dependency weakens the *next step* I say so.

## 2. Ranked table

| Rank | id | Score | Recurring trigger | Strongest objection (short) |
|---|---|---|---|---|
| 1 | did-i | 72 | Every time you leave home (daily) | For checking-OCD users, a reassurance tool can feed the compulsion, and phone apps already exist |
| 2 | panel-reader | 68 | Every use of a flat-panel appliance | At home, blind users learn their own panel or add bump dots once. Repeat value is in unfamiliar panels, which need registration each time |
| 3 | glance-log | 60 | Monthly or weekly rounds (the job) | Remote-reading meters may remove the job. The buyer and the scale are unverified |
| 3 | basket | 60 | Weekly shop | Parents of allergic children already know their staple products. A missed allergen is a liability |
| 5 | step-check | 56 | Daily for lab technicians; rare for LEGO or flat-pack | The consumer story has no repeat. The lab story is unvalidated and needs a fiducial mat per bench |
| 6 | beacon | 54 | Several times a day for blind users, in unfamiliar places | At home blind people organise by memory. In shops, helper apps and staff already cover it |
| 7 | nod | 52 | Many times a day, if it works | A tiny, fragmented population. Carer-dependent setup, and eye-gaze AAC is entrenched |
| 8 | teardown-memory | 50 | Each repair (monthly at best for a hobbyist) | Too infrequent for a consumer habit. Pros who do it daily already know the device |
| 9 | coverage-inspector | 46 | Each inspection (B2B, many per day) | Sticker zones do not deploy, and rental firms already have phone and photo workflows |
| 10 | sana | 45 | Each time a known object is handled | Language learners churn whatever the cue. Requires wearing glasses at home |
| 11 | table-talk | 42 | Every loud group meal | Every companion must scan a QR code and keep their phone talking at every dinner |
| 12 | still-head | 40 | Each practice session | A golf niche, outside "everyone, everyday", and needs glasses on the green |
| 13 | private-hand | 38 | Each card night (occasional) | Occasional, a single game, and braille UNO exists |
| 14 | show-me-once | 35 | Once per task handover (rare) | Needs two glasses wearers, and the handover moment is rare |
| 15 | cross-contact | 34 | Every service shift | About 1 h of streaming against an 8 h shift, and kitchens will not tag every utensil |
| 16 | heads-up-sounds | 30 | Every doorbell or kettle | iPhone and Apple Watch Sound Recognition already name the sound, and this needs glasses worn all day at home |
| 17 | which-way-now | 28 | Occasional trips | Journey apps already give the platform before you reach the board. Locals don't need it |

## 3. Evidence per candidate

### did-i (72)
The trigger is the strongest in the set: it fires daily, every time you leave home, and the doubt arrives later ("on the tram", _candidates.md L94). Demand is visible. Several phone apps exist only to give "proof of checking" (photo or time-stamped confirmation of locks and stoves): Pruvd ([App Store](https://apps.apple.com/us/app/id6757632735)), OCD Rescuer ([App Store](https://apps.apple.com/us/app/-/id6751641770)), CalmCheck ([site](https://calmcheck.vercel.app)) and Did I Do? ([App Store](https://apps.apple.com/app/id6737065031)). That shows people want this badly enough to build and download apps for it, though I found no usage figures (unknown). The glasses' real edge over those apps is the one the candidate names: no deliberate photo at the autopilot moment (_candidates.md L97). That is a genuine 10x on the step people forget. Next step: an ADHD or brain-injury support organisation pilot (none contacted, per the candidate). **Strongest objection:** for checking-OCD users, a photo record can become the ritual itself, and clinicians advise checking once and not re-checking (search summary of [ocd.app](https://ocd.app/?p=2675)). The pitch must target ADHD and autopilot forgetfulness, not OCD. Two more doubts: smart plugs and locks cover the stove and door for people who buy them, and one false "off" ends trust permanently, which is why the "not sure" rule (L96) is essential. Wearing glasses at the front door is plausible but unmeasured.

### panel-reader (68)
The problem has a published research history. VizLens (UIST 2016) was built because flat touch panels removed the tactile buttons blind users relied on, and blind participants' own photos failed quality checks 56.7% of the time (secondary summary of the [UIST'16 paper](https://cdn.hackaday.io/files/15531664478304/uist16-VizLens.pdf); [AFB AccessWorld](https://afb.org/aw/18/1/15282)). It is a daily-life need (washer, hob, coffee machine), and hands-free aiming is a real improvement over phone-based approaches (_candidates.md L143-145). The next step is concrete: a pilot with the Finnish Federation of the Visually Impaired (not contacted). **Strongest objection:** for your *own* appliances, many blind users solve this once with tactile bump dots or by memorising the layout, so daily repeat use for a familiar panel may fade after a week. Lasting repeat value lives in unfamiliar panels (hotel, office, laundry room), which are infrequent and need a fresh registration each time. Secondary summaries say VizLens v2 already supported a head-mounted camera, so research prior art exists (unverified against the paper). On true capacitive touchscreens, sliding a finger to explore may itself trigger a press. That limits the addressable panels to ones that need a firm press (unknown share).

### glance-log (60)
Repeat use is built in because it is someone's job: rounds happen monthly or weekly, around 30 readings each (_candidates.md L106). The buyer is identifiable (housing maintenance companies), and the pain (retyping, errors, skipped meters) is credible but unquantified. A B2B tool needs no consumer habit, which an investor likes. **Strongest objection:** the trend toward remote-reading meters may erode the job. Whether Finnish housing-company water and heat meters are already remote-read is unknown, and I did not verify it. The candidate also names no partner (L113). Analog gauge accuracy is unknown, and a technician will drop the tool after a few silent misreads.

### basket (60)
The trigger is weekly and dependable, and the user (a parent of a child with an allergy) cares intensely. A missed allergen is a real-world consequence. The phone-scanner category shows demand but also weak retention. Fig claims "1M+ members" but third-party estimates put it at about 65k monthly active users ([AppGoblin](https://appgoblin.info/apps/1564434726), estimate data). Scanning *per item* does not stick, which is exactly the friction Basket removes. **Strongest objection:** allergy parents already know which staple products are safe, so the guard fires on new products and recipe changes, which may be rare enough that the habit lapses. Then a VLM reading tiny Finnish/Swedish print at 360-504p (L51) becomes a liability the first time it misses. The list-ticking half is "nice", not a need.

### step-check (56)
There are two very different users. Gloved lab technicians run protocols daily, and a skipped well is costly, so that is a real recurring B2B trigger (L190). A LEGO or flat-pack build is a once-per-purchase event with low stakes, so it gives no repeat value. **Strongest objection:** the pitch will be told through the consumer demo (Duplo) while the repeat-value story depends on a lab pilot that is "plausible but unconfirmed" (L197). Labs also need a fiducial mat per bench, plus liquids rather than tokens. Meta already funds trade coaching (competitive.md), so the "procedural help" slot is not empty.

### beacon (54)
The user is real and the need recurs (finding one specific item several times a day). Meta AI's one-shot directions and Be My Eyes' voice-only guidance are genuine gaps (L59). Be My Eyes has about 1M blind and low-vision users ([Double Tap](https://doubletaponair.com/be-my-eyes-surpasses-1-million-users-and-launches-foundation-to-keep-ai-tools-free/)), which shows this audience adopts assistive apps. **Strongest objection:** at home, blind users rely on organisation and memory, so repeat value concentrates in shops and unfamiliar spaces. There, staff, Be My Eyes volunteers and Seeing AI already help, and it needs a reliable target name or a helper. The core depends on beta Motion with a nullable orientation field (L63), so the next step (shipping) depends on a capability Meta may not release.

### nod (52)
When it works, it would be used many times a day by people with severe need (ALS/MND, CP, high SCI), whose alternatives cost about $11-20k (indicative, L131). That is very strong severity. **Strongest objection:** the population is small and fragmented, and every deployment needs carer setup and per-user calibration. Clinical AAC channels move slowly, and eye-gaze devices are entrenched. Many ALS users progressively lose head control, so the "last reliable movement" claim does not hold for everyone (my estimate, not sourced). False accepts from ordinary head motion (L135) would end trust quickly.

### teardown-memory (50)
The pain is real and vivid: 11 screws and a forgotten order (L226). Repair cafés are a believable first venue. **Strongest objection:** frequency. A home repairer takes something apart a few times a year, which is far too rare to form a habit or justify setup with a mat and a tray. The people who disassemble daily (phone and laptop repair shops) already know the devices or follow iFixit guides. Repeat value is weak on both ends.

### coverage-inspector (46)
B2B repeat is guaranteed (an inspector does many per day), and disputes cost money (L70). **Strongest objection:** per-zone stickers on every rental item do not deploy in the real world, and without them it does not work (L75). Rental and move-out firms already use phone photo workflows. Whether automated vehicle-inspection products serve the high end is something I did not verify (unknown). Meta already funds documentation-style workflows (United Spinal, Onsite; competitive.md).

### sana (45)
In concept this has the best designed recurring trigger: the review fires when you handle the object again (L168). **Strongest objection:** language-learning motivation churns whatever the cue. It requires wearing glasses at home while handling mugs, which is an unmeasured behaviour. Retention cannot be shown in 40 h (L171), and Meta funds Immerse in this space (competitive.md). A household with about 20 objects exhausts the vocabulary quickly.

### table-talk (42)
Hard-of-hearing users at loud group meals have a frequent, emotionally painful problem. **Strongest objection:** the trigger fails at the second use. Every companion has to scan a QR code and keep their phone recording at every dinner, a social cost the HoH user must ask for each time. Meta's own Display captions may already cover the face-to-face case (L215, to be confirmed), and it needs a Display unit.

### still-head (40)
Golfers practise repeatedly and spend money, and head stability while putting is a long-standing coaching concern (several patents for head-movement putting aids, e.g. [US 8702529](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8702529)). **Strongest objection:** this is a hobby niche outside "everyone, everyday", with no accessibility angle (L206). A golfer would wear Meta glasses on the putting green only if they already do. Head-movement trainers have been patented for decades without a mass product I could find, which suggests weak demand.

### private-hand (38)
The inclusion story is warm and the peer demo is fun. **Strongest objection:** card nights are occasional, the build covers one game, and UNO Braille already exists for the most common case (L155). This is a delight feature, not a product people return to weekly, and there is no buyer.

### show-me-once (35)
**Strongest objection:** both the expert and the learner need glasses at different times, and passing on household know-how happens a handful of times a year. After the first guided run the learner knows the task and never returns. The recurring version is professional training, which Meta already funds (opportunity.md §4).

### cross-contact (34)
The consequence of cross-contact is serious. **Strongest objection:** about 1 h of streaming battery against an 8 h shift (L87, estimate), tape or fiducials on every utensil, and a cook wearing a camera through service. A kitchen will not adopt it as a daily tool. As a "training only" tool its repeat use collapses, and safety-critical false negatives make it a liability rather than an asset.

### heads-up-sounds (30)
The Deaf parent's trigger (a doorbell, the kettle or a child) is daily. **Strongest objection:** the candidate's premise that phone alerts "cannot say which thing made the sound" is wrong. iPhone Sound Recognition already classifies doorbell, door knock, baby crying and appliance sounds, with alerts that can go to Apple Watch ([How-To Geek](https://www.howtogeek.com/693029/how-to-use-sound-recognition-on-iphone/); [AppleInsider](https://appleinsider.com/articles/20/09/22/how-to-set-up-sound-recognition-alerts-in-ios-14-and-why-you-want-to)). Flashing doorbells and vibrating alerts are cheap incumbents. What remains is in-sight display plus visual confirmation, which requires a Display worn all day at home. That is close to an existing product, and I stopped short of a hard reject only because visual confirmation is a real, if small, difference.

### which-way-now (28)
**Strongest objection:** the only user who reaches the board without knowing the platform is a first-time visitor, which is an occasional, one-off use. Locals use journey apps that already show the platform and delay before arrival. Meta's translation covers "what does it say" (L239). The live-data dependency is unknown (L240). There is no recurring trigger and no buyer beyond a speculative VR or HSL pilot (not contacted). Near an existing-product reject.

## 4. For the three objectives (this lens only)

- **Meta challenge:** real-world value is 25% of Meta's score (CHALLENGES.md:L936), and "focused, plausible path to adoption or a pilot" is required (L900). On that axis, `did-i`, `panel-reader` and `glance-log` give the most credible pilot stories.
- **Overall:** Otto's question, "why will anyone use this again", favours `did-i` (daily) and `basket` (weekly) over accessibility candidates whose repeat use depends on unfamiliar settings.
- **Combined:** `did-i` (daily trigger, broad user, strong trust story) and `panel-reader` (severe need, clear pilot) carry this lens into both judging routes. Each should state its repeat objection in the deck rather than hide it: the OCD caveat for `did-i`, and familiar versus unfamiliar panels for `panel-reader`.

## Sources opened or searched for this report
- CHALLENGES.md:L878-946; 00-rules-and-jury.md; ai-glasses.md; competitive.md; opportunity.md; feasibility.md; 04-ideas/_candidates.md (cited as L<n>).
- Checking apps: [Pruvd](https://apps.apple.com/us/app/id6757632735), [OCD Rescuer](https://apps.apple.com/us/app/-/id6751641770), [CalmCheck](https://calmcheck.vercel.app), [Did I Do?](https://apps.apple.com/app/id6737065031), [ocd.app on checking rituals](https://ocd.app/?p=2675) (search-result summaries; listings not opened).
- [Fig on AppGoblin](https://appgoblin.info/apps/1564434726) (search summary).
- [VizLens UIST'16 PDF](https://cdn.hackaday.io/files/15531664478304/uist16-VizLens.pdf), [AFB AccessWorld](https://afb.org/aw/18/1/15282) (search summaries).
- [Be My Eyes 1M users](https://doubletaponair.com/be-my-eyes-surpasses-1-million-users-and-launches-foundation-to-keep-ai-tools-free/) (search summary).
- iPhone Sound Recognition: [How-To Geek](https://www.howtogeek.com/693029/how-to-use-sound-recognition-on-iphone/), [AppleInsider](https://appleinsider.com/articles/20/09/22/how-to-set-up-sound-recognition-alerts-in-ios-14-and-why-you-want-to) (search summaries; the exact sound list varies by iOS version).
- Putting head-movement patents: [US 8702529](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8702529) (search summary).

<!-- complete -->
