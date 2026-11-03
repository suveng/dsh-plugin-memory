---
"dsh-plugin-memory": minor
---

Carry a skill suggestion to adoption without a person

Skill settings gain `autoAdopt` (off by default). A review that finds a
suggestion now drafts it, backtests it against the current version, rewrites
it while the backtest regresses (at most twice) and adopts the winning draft
through the Source's own protocol — no draft or adopt click needed.

A draft that still regresses after two rewrites is left for review with a
warning naming both scores, and turning the switch off stops the remaining
steps of a suggestion already in flight.
