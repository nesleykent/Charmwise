# Charmwise

Charmwise is a data driven Tibia Charm optimisation platform.

Using Bestiary data, Hunt Analyser sessions, character statistics, and Charm mechanics, Charmwise calculates the expected value of every Major Charm and Minor Charm and recommends the most effective setup for your hunts.

**Smarter Charms. Better Hunts.**

The interface is available in British English and Brazilian Portuguese.

## Project overview

Charmwise combines four inputs to recommend the best Major Charm and Minor Charm for every creature in a hunt, and for the hunt as a whole:

1. **Bestiary data** - `src/data/bestiary.json`, hitpoints, experience, resistances, difficulty and Charm Points for hundreds of creatures.
2. **Character information** - level, vocation, hitpoints, mana, critical/leech stats, account type, and which Charms you have unlocked and assigned.
3. **A pasted Hunt Analyser session** - the plain text block Tibia's "Analyse Hunt" window produces, listing kills, loot and session rates.
4. **Charm mechanics** - every Major and Minor Charm's real activation chances and Charm Point / Minor Charm Echo costs.

The app parses the Hunt Analyser text, joins each killed monster against the Bestiary, applies your character's stats, calculates the expected value of every Charm against every creature you fought, and ranks the results. Everything runs client-side - nothing you type is ever uploaded anywhere.

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
- **Charm mechanics** - transcribed into [`src/data/charms.ts`](src/data/charms.ts) from the in-game Charm system (activation chances, tier costs, effect magnitudes).
- **Hunt Analyser** - whatever you paste into the Optimiser page, parsed by [`src/lib/parseHuntAnalyser.ts`](src/lib/parseHuntAnalyser.ts).
- **Character** - whatever you enter into the Character form.

### A note on what the Bestiary source does *not* contain

`bestiary.json` has no loot value, Creature Product value, Skinning/Dusting data, or flee-health thresholds under any key we could find. [`normaliseMonster.ts`](src/lib/normaliseMonster.ts) is written as a defensive adapter: it checks several plausible alternate key names for these fields (in case the upstream source adds them later) and otherwise leaves them `null` rather than inventing a number. Every such gap is recorded in `MonsterProfile.missingFields` and surfaced in the **Missing data warnings** panel. Average loot value falls back to a per-creature estimate derived from your own pasted session's `Loot:` total, which is arguably more relevant than a static table since it reflects current market prices.

## How the optimiser works

1. **Parse** - [`parseHuntAnalyser.ts`](src/lib/parseHuntAnalyser.ts) turns the pasted text into session totals, a list of killed monsters (with kill share and a naive per-kill estimate), and looted items.
2. **Join** - [`normaliseMonster.ts`](src/lib/normaliseMonster.ts) matches each killed monster against `bestiary.json` (case/whitespace-insensitive, with a Levenshtein-distance fuzzy fallback for typos) and maps it to a normalised `MonsterProfile`.
3. **Refine** - `optimiseCharms.ts` refines the parser's naive, evenly-split per-kill estimates once Bestiary data is available: outgoing/incoming damage are allocated across creatures weighted by `kills x hitpoints` (tougher, more-killed creatures absorb proportionally more), and per-kill XP uses the creature's real Bestiary experience value scaled by the session's own XP boost multiplier (`XP Gain / Raw XP Gain`).
4. **Score** - [`charmScoring.ts`](src/lib/charmScoring.ts) computes every Charm's expected value against every creature using the formulas below, then min-max normalises the results into six 0-100 scores (`damage`, `xp`, `profit`, `safety`, `supply_saving`, `utility`) so charms with wildly different natural units (gold/hour vs. a 0-1 utility magnitude) can be weighted together fairly.
5. **Recommend** - [`optimiseCharms.ts`](src/lib/optimiseCharms.ts) picks the best unlocked Major and Minor Charm per creature, respects your account's active-Major-Charm slot limit, proposes the best use of unspent Charm Points / Minor Charm Echoes, suggests reassignments (with gold cost), and compares total removal cost against a full reset.

## Character input explanation

| Field | Meaning |
| --- | --- |
| Level, Vocation | Used for the reset/removal gold formulas. Vocations: Elite Knight, Royal Paladin, Master Sorcerer, Elder Druid, Monk. Vocation itself has no known effect on Charm activation chances or attack cadence, so it is not currently a scoring input - your actual critical/leech stats below are what drive the formulas. |
| Max. hitpoints / mana | Feed Overpower and Overflux's proc-damage caps. |
| Critical chance / damage bonus | Your *existing* (gear/talent) values - Low Blow and Savage Blow add to these. |
| Life Leech % / Mana Leech % | Your *existing* leech - Vampiric Embrace and Void's Call only have an effect once this is above zero. |
| Available Charm Points / Minor Charm Echoes | Your unspent budget, used for purchase suggestions. |
| Account type, Charm Expansion | Free accounts may have 2 active Major Charms at once, Premium 6; Charm Expansion removes that limit and cuts removal cost by 25%. |
| Unlocked Major/Minor Charms | Which Charms you own and at which tier (Bronze/Silver/Gold) - everything else is scored as a hypothetical Tier 1 purchase. |
| Currently assigned Major/Minor Charms | Which Charm is on which creature right now, used to compute reassignment suggestions and removal cost. |

## Hunt Analyser input explanation

Paste the text Tibia's Hunt Analyser window produces (see the "Load sample session" button on the Optimiser page for a worked example). The parser extracts session totals (XP, loot, damage, healing and their per-hour rates), every line under `Killed Monsters:`, and every line under `Looted Items:`. Lines it cannot recognise are reported as parser warnings rather than silently dropped.

## Charm formula explanation

All percentages are stored as fractions internally. `resistance_multiplier` is the creature's Bestiary resistance value divided by 100 (so 100% = neutral = `1`, and a negative value - some creatures heal from certain elements - is clamped to zero damage with a warning rather than reported as healing).

```
Elemental damage charms (Curse, Divine Wrath, Enflame, Freeze, Poison, Wound, Zap):
  expected_damage_per_attack = monster_hitpoints * 0.05 * activation_chance * resistance_multiplier

Carnage (on kill, not on attack):
  expected_damage_per_kill = monster_hitpoints * 0.15 * activation_chance * physical_resistance_multiplier

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

Every damage-dealing Charm also derives an incremental XP/profit contribution from the extra kills/hour its bonus damage enables (`extra_damage_per_hour / monster_hitpoints`), which is what feeds `xp_score` and `profit_score` for charms that the spec doesn't give a standalone XP/profit formula for.

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
  - Attacks/hour against a species is approximated as `kill_share * 1800` (one attack/spell roughly every 2 seconds while actively fighting, scaled by the fraction of the session spent on that species).
  - Incoming damage/hour per species is approximated from the session's `Healing/h` figure (a sustainable hunt's healing received roughly tracks the damage it offsets), allocated across species the same way outgoing damage is.
  - Mana drained/hour is a fixed share (30%) of that same incoming-damage estimate, only for creatures flagged as having a Mana Drain attack.
- `bestiary.json` carries no loot value, Creature Product, Skinning/Dusting, or flee-threshold data (see "Data sources" above); Gut and Scavenge will show "no data" for most creatures until a richer data source is wired in.
- Carnage's AoE damages *other* nearby creatures, not the one that died; Charmwise approximates this using the same creature's own physical resistance, which is most accurate when hunting a single species in a pack.
- Cleanse, Cripple, Numb, Fatal Hold, Adrenaline Burst and Bless are scored from documented heuristic assumptions rather than the spec's explicit EV formulas, since none was given for them.
- Bestiary "unlocked" status is treated as "this creature has a matching Bestiary entry at all", since per-account completion progress is not exposed by the data source.

## Future improvements

- A real loot/Creature Product/Skinning/Dusting value dataset, so Gut and Scavenge can be scored with reported data instead of session-derived fallbacks.
- A direct "Damage Taken" and per-monster hit-count parser path for Hunt Analyser exports that include them, removing the attack-rate and incoming-damage estimation heuristics entirely.
- Persisting character presets (e.g. to `localStorage`) so returning users don't have to re-enter their build.
- A proper knapsack solver for "best use of available Charm Points" across the whole account (today's greedy, per-charm, best-creature suggestion is simple and deterministic but not globally optimal).

## Project structure

```
src/app                  Next.js App Router pages (Home, Optimiser)
src/components           CharacterForm, HuntAnalyserInput, OptimisationResults, CharmRankingTable, MissingDataPanel, ...
src/data                 bestiary.json, charms.ts, sampleHuntAnalyser.ts
src/lib                  parseHuntAnalyser.ts, normaliseMonster.ts, charmScoring.ts, optimiseCharms.ts, economy.ts, validation.ts, format.ts, i18n.tsx
src/locales              en-GB.ts, pt-BR.ts
src/types                character.ts, hunt.ts, monster.ts, charm.ts, optimisation.ts, i18n.ts
```
