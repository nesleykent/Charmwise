# Charmwise

Charmwise is a data driven Tibia Charm optimisation platform.

Using Bestiary data, Hunt Analyser sessions, character statistics, and Charm mechanics, Charmwise calculates the expected value of every Major Charm and Minor Charm and recommends the most effective setup for your hunts.

**Smarter Charms. Better Hunts.**

The interface is available in British English and Brazilian Portuguese.

## Project overview

Charmwise combines four inputs to recommend the best Major Charm and Minor Charm for every creature in a hunt, and for the hunt as a whole:

1. **Bestiary data** - `src/data/bestiary.json`, hitpoints, experience, resistances, difficulty and Charm Points for hundreds of creatures.
2. **Character information** - level, hitpoints, mana, leech stats, account type, and which Charms you have unlocked and assigned.
3. **A pasted Hunt Analyser session** - the plain text block Tibia's "Analyse Hunt" window produces, listing kills, loot and session rates.
4. **Charm mechanics** - every Major and Minor Charm's real activation chances and Charm Point / Minor Charm Echo costs.

The app parses the Hunt Analyser text, joins each killed monster against the Bestiary, applies your character's stats, calculates the expected value of every Charm against every creature you fought, and ranks the results. Everything runs client-side - nothing you type is ever uploaded anywhere.

The Dashboard and Recommendations pages both have a **Full analysis / My charms** toggle. Full analysis (the default) shows the best Charm for each creature regardless of whether you've unlocked it yet - useful the moment you've pasted a hunt, before filling in anything under Character. My charms narrows that down to only what you've actually unlocked, for "what should I equip right now."

### App structure

Charmwise is five pages sharing one workspace (`src/lib/workspace.tsx`), not one long form - your character, pasted session, and optimisation mode persist to `localStorage` and follow you between pages and across reloads:

- **Dashboard** (`/`) - your current best Charm per creature, expected gains, and upgrade opportunities at a glance.
- **Character** (`/character`) - the three numbers that actually feed the formulas, with everything else (Leech, account type, unlocked/assigned Charms) behind an optional disclosure.
- **Hunt Analyser** (`/hunt`) - paste a session; parsing and validation happen instantly, client-side.
- **Recommendations** (`/recommendations`) - the full ranked breakdown per creature, with the optimisation-mode switch and a "why this, not that" explanation for every Charm.
- **Charm Library** (`/charms`) - mechanics and costs for all 25 Charms, plus a per-Charm best-against/worst-against creature ranking computed directly from the Bestiary (`src/lib/charmLibrary.ts`) - independent of any pasted hunt.

## Setup instructions

```bash
npm install
npm run dev     # http://localhost:3000
```

Other scripts:

```bash
npm run build      # static export to ./out (see "Deployment")
npm run start       # serve the production build (after `next build` without static export)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test              # Vitest unit tests (parser + scoring)
```

### Deployment (GitHub Pages)

The app is configured for Next.js static export (`output: 'export'` in `next.config.js`) and ships with [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds the app and publishes `out/` to GitHub Pages on every push to `main`.

To enable it on your fork: **Settings &rarr; Pages &rarr; Build and deployment &rarr; Source: GitHub Actions**. The workflow sets `NEXT_PUBLIC_BASE_PATH` to `/<repository name>` automatically so asset paths resolve correctly under `https://<user>.github.io/<repository>/`.

## Data sources

- **Bestiary** - [`bestiary-session-analyzer`](https://github.com/nesleykent/bestiary-session-analyzer/blob/main/src/data/bestiary.json), vendored into [`src/data/bestiary.json`](src/data/bestiary.json). It is a [tibiadraptor.com](https://tibiadraptor.com) bestiary export: 800+ creatures with hitpoints, experience, difficulty, resistances, damage types, negative conditions and Charm Point rewards.
- **Charm mechanics** - transcribed into [`src/data/charms.ts`](src/data/charms.ts) from the in-game Charm system (activation chances, tier costs, effect magnitudes). [`src/data/charms.json`](src/data/charms.json) is a vendored export of the same data in its original tier-cost/value shape; [`charmsData.test.ts`](src/lib/__tests__/charmsData.test.ts) loads it and asserts every tier in `charms.ts` matches exactly, so the two can never silently drift apart. The Winter Update 2024 level cap on elemental Charm damage, and the attack-opportunity weighting in `charmScoring.ts`, were corrected against the published methodology of [TibiaMaps' Charm Optimizer](https://tibiamaps.io/tools/charms) and [TibiaPal's Charm Calculator](https://tibiapal.com/charm_calculator).
- **Hunt Analyser** - whatever you paste into the Hunt Analyser page, parsed by [`src/lib/parseHuntAnalyser.ts`](src/lib/parseHuntAnalyser.ts).
- **Character** - whatever you enter into the Character form.

### A note on what the Bestiary source does *not* contain

`bestiary.json` has no loot value, Creature Product value, Skinning/Dusting data, or flee-health thresholds under any key we could find. [`normaliseMonster.ts`](src/lib/normaliseMonster.ts) is written as a defensive adapter: it checks several plausible alternate key names for these fields (in case the upstream source adds them later) and otherwise leaves them `null` rather than inventing a number. Every such gap is recorded in `MonsterProfile.missingFields` and surfaced in the **Missing data warnings** panel. Average loot value falls back to a per-creature estimate derived from your own pasted session's `Loot:` total, which is arguably more relevant than a static table since it reflects current market prices.

## How the optimiser works

1. **Parse** - [`parseHuntAnalyser.ts`](src/lib/parseHuntAnalyser.ts) turns the pasted text into session totals, a list of killed monsters (with kill share and a naive per-kill estimate), and looted items.
2. **Join** - [`normaliseMonster.ts`](src/lib/normaliseMonster.ts) matches each killed monster against `bestiary.json` (case/whitespace-insensitive, with a Levenshtein-distance fuzzy fallback for typos) and maps it to a normalised `MonsterProfile`.
3. **Refine** - `optimiseCharms.ts` refines the parser's naive, evenly-split per-kill estimates once Bestiary data is available: outgoing/incoming damage *and* attack opportunities are all allocated across creatures weighted by `kills x hitpoints` (a tougher, more-killed creature absorbs proportionally more of your attacks before it dies, the same weighting [TibiaMaps' Charm Optimizer](https://tibiamaps.io/tools/charms) uses), and per-kill XP uses the creature's real Bestiary experience value scaled by the session's own XP boost multiplier (`XP Gain / Raw XP Gain`).
4. **Score** - [`charmScoring.ts`](src/lib/charmScoring.ts) computes every Charm's expected value against every creature using the formulas below, then min-max normalises the results into six 0-100 scores (`damage`, `xp`, `profit`, `safety`, `supply_saving`, `utility`) so charms with wildly different natural units (gold/hour vs. a 0-1 utility magnitude) can be weighted together fairly.
5. **Recommend** - [`optimiseCharms.ts`](src/lib/optimiseCharms.ts) solves the actual assignment of unlocked Major and Minor Charms to creatures (see below), respects your account's active-Major-Charm slot limit, proposes the best use of unspent Charm Points / Minor Charm Echoes, suggests reassignments (with gold cost), and compares total removal cost against a full reset.

### Why "best charm per creature" isn't just an independent lookup

A specific unlocked Charm can only be actively assigned to one creature at a time - you don't get a second copy of Wound just because two creatures in your hunt would both benefit from it. Ranking Charms per creature independently (which `rankedMajorCharms`/`rankedMinorCharms` still do, and is the right view for "how does this Charm score here in isolation") can recommend the *same* Charm as the best pick for several different creatures at once - impossible to actually act on.

[`assignmentSolver.ts`](src/lib/assignmentSolver.ts) solves this properly: an exact bitmask-DP solution to the assignment problem (each creature gets at most one Charm, each Charm goes to at most one creature, Major Charms additionally capped at the account's slot limit), maximising total score across the whole hunt rather than greedily per creature. It's exact, not a heuristic - the Charm axis is always small (≤14 Major, ≤11 Minor), so brute-forcing every subset via DP is cheap (a worst-case 50-creature x 14-charm hunt solves in well under 20ms). `bestMajorCharm`/`bestMinorCharm` on each creature reflect this solved assignment; a creature that loses a Charm to one with a stronger claim on it shows a `charm_in_use_elsewhere` warning rather than no explanation. `bestMajorCharmOverall`/`bestMinorCharmOverall` (the Full Analysis view) deliberately stay independent per creature, since that view is "what's worth pursuing" regardless of what you've actually unlocked, not a real achievable assignment.

Because the same Charm legitimately scores differently per creature, it can show up more than once in a cross-creature list like "Ranked alternatives" - once per creature it's good for. Each row there names the creature it was scored against, so two entries for the same Charm read as "this Charm is great for both of these creatures" rather than looking like a duplicate-data bug.

### Target tier

Recommendations Center has a Bronze/Silver/Gold **target tier** selector (default Gold). It caps two things: the ceiling locked Charms are evaluated at in the full ranking (so "what's worth pursuing" reflects a tier you're actually aiming for, not always the absolute maximum), and how far purchase suggestions walk before stopping - Gold is rarely realistic on every Charm given how steeply its cost scales versus Bronze/Silver, so this exists for anyone whose Charm Point budget isn't going to stretch that far.

## Character input explanation

Only Level, Max. hitpoints and Max. mana are asked for up front - together with a pasted Hunt Analyser session, they're enough for a useful result. Everything else lives behind "Advanced settings".

A "look up by character name" disclosure above those three fields can fill them in automatically: it calls [TibiaData's character API](https://api.tibiadata.com/v4/character/) (client-side, no backend - the API sends `Access-Control-Allow-Origin: *`) for the character's real Level and Vocation, then estimates Max. hitpoints/mana from the vocation's official HP/Mana-per-level growth rate, anchored at the shared level-8 baseline every vocation starts from (185 HP / 90 Mana). That estimate intentionally does **not** account for the Wheel of Destiny's Dedication perks or Gem Basic Mods - both push real characters above the base curve - so the fields stay fully editable afterwards rather than locking to the estimate. (Promotion and Loyalty do *not* affect max HP/Mana - verified against TibiaWiki/TibiaQA - so they're correctly not listed as a source of variance here.) If the lookup fails (the character doesn't exist, a typo, or TibiaData's API being briefly unavailable - it does occasionally return a 502 even for valid names) the fields are simply left as they were, with a message to enter them manually.

| Field | Meaning |
| --- | --- |
| Level | Feeds the reset/removal gold formulas and the elemental Charm level cap (see below). There is no Vocation field for manual entry - Charm activation chances, costs, and (as far as we've verified) attack cadence are identical across all five vocations, so it would have had no effect on any calculation. Vocation is only used transiently by the character name lookup above, to pick which HP/Mana growth rate to estimate from. |
| Max. hitpoints / mana | Feed Overpower and Overflux's proc-damage caps. |
| Critical chance / damage bonus | Editable, under Advanced settings. Defaults to 5% / 10%, the intrinsic baseline every character has had since the Summer Update 2025 Weapon Proficiency System replaced the old gear-based crit bonuses with build-specific Augments (see CipSoft's [Summer Update 2025 notes](https://www.cipsoft.com/en/395-tibia-summer-update-2025-now-available)). Low Blow and Savage Blow's entire score depends on these two numbers - raise them if your build has invested Augment points into critical hits. |
| Life Leech % / Mana Leech % | Your *existing* leech - Vampiric Embrace and Void's Call only have an effect once this is above zero. Kept editable since leech varies a lot by equipment and isn't a flat baseline. |
| Available Charm Points / Minor Charm Echoes | Your unspent budget, used for purchase suggestions. |
| Account type, Charm Expansion | Free accounts may have 2 active Major Charms at once, Premium 6; Charm Expansion removes that limit and cuts removal cost by 25%. |
| Unlocked Major/Minor Charms | Which Charms you own and at which tier (Bronze/Silver/Gold) - everything else is scored at its Gold-tier ceiling, since that's the charm's true upside and what "worth pursuing" should be judged against. The "best charm" used for slot planning and reassignment suggestions still only considers what you've actually unlocked. |
| Currently assigned Major/Minor Charms | Which Charm is on which creature right now, used to compute reassignment suggestions and removal cost. |

## Hunt Analyser input explanation

Paste the text Tibia's Hunt Analyser window produces (see the "Load sample session" button on the Hunt Analyser page for a worked example). The parser extracts session totals (XP, loot, damage, healing and their per-hour rates), every line under `Killed Monsters:`, and every line under `Looted Items:`. Lines it cannot recognise are reported as parser warnings rather than silently dropped.

## Charm formula explanation

All percentages are stored as fractions internally. `resistance_multiplier` is the creature's Bestiary resistance value divided by 100 (so 100% = neutral = `1`, and a negative value - some creatures heal from certain elements - is clamped to zero damage with a warning rather than reported as healing).

Since the Winter Update 2024, elemental Charm damage is also capped by character level - `base_damage` is `min(5% of hitpoints, 2x character level)` for the seven elemental Charms, and `min(15% of hitpoints, 6x character level)` for Carnage (3x the elemental cap, matching its 3x higher percentage). Without this, a low-level character would be modelled as dealing unrealistically large Charm damage against very high-HP creatures. A warning is shown whenever the cap actually changes the result.

```
Elemental damage charms (Curse, Divine Wrath, Enflame, Freeze, Poison, Wound, Zap):
  base_damage = min(monster_hitpoints * 0.05, character_level * 2)
  expected_damage_per_attack = base_damage * activation_chance * resistance_multiplier

Carnage (on kill, not on attack):
  base_damage = min(monster_hitpoints * 0.15, character_level * 6)
  expected_damage_per_kill = base_damage * activation_chance * physical_resistance_multiplier

Overpower:
  proc_damage = min(character_max_hitpoints * 0.05, monster_hitpoints * 0.08)
  expected_damage_per_attack = proc_damage * activation_chance

Overflux:
  proc_damage = min(character_max_mana * 0.025, monster_hitpoints * 0.08)
  expected_damage_per_attack = proc_damage * activation_chance

Dodge:               expected_damage_prevented_per_hour = incoming_damage_per_hour * activation_chance
Parry:               expected_reflected_damage_per_hour  = incoming_damage_per_hour * activation_chance
Low Blow:            expected_damage_gain = base_damage_per_hour * added_critical_chance * critical_damage_bonus
Savage Blow:         expected_damage_gain = base_damage_per_hour * critical_chance * added_critical_damage
Gut:                 expected_profit_gain_per_hour = kills_per_hour * creature_product_value * gut_bonus_percent
Scavenge:            expected_profit_gain_per_hour = kills_per_hour * skinning_or_dusting_value * scavenge_bonus_percent
Vampiric Embrace:    expected_healing_gain_per_hour = damage_per_hour * added_life_leech_percent
Void's Call:         expected_mana_gain_per_hour = damage_per_hour * added_mana_leech_percent
Void Inversion:      expected_mana_saved_per_hour = mana_drain_received_per_hour * activation_chance
```

Every damage-dealing Charm also derives an incremental XP/profit contribution from the extra kills/hour its bonus damage enables (`extra_damage_per_hour / monster_hitpoints`), which is what feeds `xp_score` and `profit_score` for charms that the spec doesn't give a standalone XP/profit formula for. This treats extra damage as converting into extra kills at a constant, continuous rate - a reasonable approximation over a full session's worth of kills, but see **Limitations** for when it can overstate the real gain.

Cleanse, Cripple, Numb, Fatal Hold, Adrenaline Burst and Bless have no currency-denominated formula in the source material (they are crowd-control/defensive effects). Charmwise estimates a defensible value for each (paralysis uptime for Cripple/Numb, a difficulty-scaled risk factor for Bless, condition relevance for Cleanse) and documents every assumed constant at the top of [`charmScoring.ts`](src/lib/charmScoring.ts) - see **Limitations** below.

### Scoring

```
total_score = damage_score * 0.40 + profit_score * 0.25 + safety_score * 0.20
            + supply_saving_score * 0.10 + utility_score * 0.05   (Balanced mode)
```

`xp`, `profit`, `safety` and `low_supplies` optimisation modes use different weight sets (see `MODE_WEIGHTS` in `charmScoring.ts`); all weight sets sum to 1.

### Economics

```
removal_cost = character_level * 100 gold              (x0.75 with Charm Expansion)
reset_cost   = 0 if the free reset hasn't been used yet
             = 100,000 gold for level <= 100
             = 100,000 + (level - 100) * 11,000 gold for level > 100
```

## Limitations

- Exact optimisation depends on the quality of monster data, resistance data, player input, and how accurately the Hunt Analyser session represents your actual hunt.
- The pasted Hunt Analyser text has no per-monster attack count or "Damage Taken" figure, so **attack count and incoming damage per creature are estimated**, not reported:
  - The session has a total budget of `1800` attacks/hour (one attack/spell roughly every 2 seconds while actively fighting). That budget is split across species weighted by `kills * hitpoints`, not by kill count alone - a tankier creature takes more hits to kill, so it soaks up proportionally more attacks (and so more Charm proc opportunities) even at an identical kill share. This matches the weighting [TibiaMaps' Charm Optimizer](https://tibiamaps.io/tools/charms) uses.
  - Incoming damage/hour per species is approximated from the session's `Healing/h` figure (a sustainable hunt's healing received roughly tracks the damage it offsets), allocated across species the same `kills * hitpoints` way outgoing damage is.
  - Mana drained/hour is a fixed share (30%) of that same incoming-damage estimate, only for creatures flagged as having a Mana Drain attack.
- The incremental XP/profit derived from a damage-dealing Charm (`extra_damage_per_hour / monster_hitpoints` extra kills/hour) assumes every point of extra damage converts smoothly into extra completed kills within the same hour. In reality, if your kill rate is bottlenecked by something other than raw damage - travel time between spawns, looting, mana regeneration - a faster kill on an already-fast fight may not actually free up time for an additional kill. This isn't double-counting observed session data (the per-kill XP/loot values come from the session, but the *extra* kills are a forward projection of adding the Charm on top of it, not a recount of kills already in the session), but it is a linear idealisation that can overstate the real marginal gain, especially in already damage-saturated hunts.
- `bestiary.json` carries no loot value, Creature Product, Skinning/Dusting, or flee-threshold data (see "Data sources" above); Gut and Scavenge will show "no data" for most creatures until a richer data source is wired in.
- Carnage's AoE damages *other* nearby creatures, not the one that died, and is mitigated by that creature's *armour* (per TibiaWiki), not its resistance; Charmwise approximates this using the killed creature's own resistance as a stand-in (armour isn't in the Bestiary data), which is most accurate when hunting a single species in a pack.
- Cleanse, Cripple, Numb, Fatal Hold, Adrenaline Burst and Bless are scored from documented heuristic assumptions rather than the spec's explicit EV formulas, since none was given for them. Adrenaline Burst specifically is cancelled by the Haste spell and provides no benefit while Haste is active, which most characters keep running near-permanently - shown as a warning on the charm.
- Scavenge's tier value (60/90/120%) is a documented *relative* increase to your base Skinning/Dusting success chance, but Charmwise applies it as a direct multiplier on expected loot value instead, since the Bestiary data doesn't expose a base success chance to apply the relative increase to. Treat its score as an order-of-magnitude estimate, not a precise figure - shown as a warning on the charm.
- Bestiary "unlocked" status is treated as "this creature has a matching Bestiary entry at all", since per-account completion progress is not exposed by the data source.
- Critical chance/damage default to the universal 5%/10% baseline but are editable under Advanced settings. They're still a single flat number each, though - if your build has invested Augment points into critical hits (e.g. a Sorcerer's Master of Energy/Master of Death, which are tied to a specific spell element), your real crit rate may vary by which element you're hitting a creature with, which one field per stat can't capture.
- Savage Blow scores noticeably higher than Low Blow at the shared 5%/10% baseline (Gold tier: 44% added crit damage vs 9% added crit chance) - confirmed against multiple sources to be Tibia's own relative charm design (Savage Blow's tier values are simply larger numbers), not an asymmetry in how the two are scored. The two formulas are structurally identical, cross-multiplying each charm's own added stat by the *other* stat's current value.

## Future improvements

- A real loot/Creature Product/Skinning/Dusting value dataset, so Gut and Scavenge can be scored with reported data instead of session-derived fallbacks.
- A direct "Damage Taken" and per-monster hit-count parser path for Hunt Analyser exports that include them, removing the attack-rate and incoming-damage estimation heuristics entirely.
- A proper knapsack solver for "best use of available Charm Points" across the whole account (today's greedy, per-charm, best-creature suggestion is simple and deterministic but not globally optimal).
- Multiple saved characters/hunts (today's workspace holds exactly one of each), and a way to compare two optimisation modes side by side.
- A per-element critical chance/damage override, for builds (e.g. a Sorcerer's spell-specific Augments) where the single flat critical fields don't capture real per-element variation.

## Project structure

```
src/app                  Dashboard (/), /character, /hunt, /recommendations, /charms + /charms/[charmId]
src/components           CharacterForm, HuntAnalyserInput, OptimisationResults, CharmRankingTable, CharmDetailView,
                         MissingDataPanel, DataBadge, EmptyState, nav/AppShell, ...
src/data                 bestiary.json, charms.ts, sampleHuntAnalyser.ts
src/lib                  parseHuntAnalyser.ts, normaliseMonster.ts, charmScoring.ts, optimiseCharms.ts, charmLibrary.ts,
                         economy.ts, validation.ts, format.ts, i18n.tsx, workspace.tsx
src/locales              en-GB.ts, pt-BR.ts
src/types                character.ts, hunt.ts, monster.ts, charm.ts, optimisation.ts, i18n.ts
```
