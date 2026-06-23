# Charm Mechanics Research

Verified on 2026-06-23 before the recommendation UI refactor.

## Sources

- Official Tibia/CipSoft Winter Update 2024 and Charm Overhaul:
  - https://www.tibia.com/news/?id=8140&subtopic=newsarchive
  - https://www.cipsoft.com/en/356-tibia-winter-update-2024
- TibiaWiki mechanics:
  - Major Charms: https://tibia.fandom.com/wiki/Major_Charms
  - Minor Charms: https://tibia.fandom.com/wiki/Minor_Charms
  - Wound / elemental cap and resistance handling: https://tibia.fandom.com/wiki/Wound
  - Carnage: https://tibia.fandom.com/wiki/Carnage
  - Dodge: https://tibia.fandom.com/wiki/Dodge
  - Parry: https://tibia.fandom.com/wiki/Parry
  - Savage Blow: https://tibia.fandom.com/wiki/Savage_Blow
  - Overflux: https://tibia.fandom.com/wiki/Overflux
  - Void's Call: https://tibia.fandom.com/wiki/Void%27s_Call
  - Numb: https://tibia.fandom.com/wiki/Numb
- Community calculators and tested formulas:
  - TibiaPal Charm Damage Calculator: https://tibiapal.com/charm_calculator
  - TibiaMaps Charm Optimizer: https://tibiamaps.io/tools/charms
  - TibiaQA minor/major charm discussion: https://www.tibiaqa.com/36618/which-major-minor-charms-are-worth-unlocking-up-to-stage-3
- Recent player use-case discussions:
  - Carnage / Overpower vs Low Blow / Savage Blow: https://www.reddit.com/r/TibiaMMO/comments/1gzodqx/carnageoverpower_vs_low_blowsavage_blow_1403_ek/
  - Low Blow vs Savage Blow math: https://www.reddit.com/r/TibiaMMO/comments/1gjdru7/who_else_is_considering_switching_all_elemental/
  - Low Blow / Savage Blow sustain discussion: https://www.reddit.com/r/TibiaMMO/comments/1oy2tfl/low_blow_savage_blow_ek/
  - Carnage in dense pulls: https://www.reddit.com/r/TibiaMMO/comments/1ttp58c/why_carnage_isnt_a_bad_charm/

## Implementation Implications

- Major and Minor Charm tier tables in `src/data/charms.ts` match the current 3-stage system. Major costs vary by charm; Minor Charms use 100 / 150 / 225 Minor Charm Echoes.
- One Major and one Minor Charm can be assigned per creature. Major Charm slot limits still matter by account/Charm Expansion.
- Elemental damage charms are 5% of target HP, trigger 5% / 10% / 11%, apply the 2x level cap before resistance, then apply creature resistance and mitigation.
- Overpower and Overflux trigger 5% / 10% / 11%, use 5% max HP or 2.5% max mana, cap at 8% of creature HP, ignore resistances, and still need mitigation applied.
- Low Blow adds critical chance; Savage Blow adds critical extra damage. Their value depends on the player's base critical setup and own damage, and player discussions repeatedly frame them as high-value because crit damage also feeds leech/sustain in real hunts.
- Carnage is on-kill AoE: 10% / 20% / 22%, 15% of killed creature max HP, 6x level cap, physical/armour mitigation, and practical value rises in dense pulls where nearby targets are consistently present.
- Dodge, Parry, Cripple, Numb, Vampiric Embrace, Void's Call, and mana-drain/condition utilities should not beat damage by default. They need concrete hunt data: high incoming damage, low sustain margin, mana drain, paralysis/control value, fleeing behavior, or valuable product/corpse-action data.
- Product behavior should therefore default to damage-first comparison and expose defensive/sustain/control as alternate views, with every non-damage recommendation explaining the concrete reason it is being shown.
