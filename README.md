# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Santseiya/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Santseiya/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the protocols that still record no token by what a token launch would be worth, and shows how to farm each one. It reads a sealed DefiLlama snapshot of 758 protocols, covers the whole 40-protocol watchlist, adds 138 early finds below the $50M floor, and scores every row with one peer-calibrated model: TVL times the median market-cap-to-TVL ratio of the token-bearing protocols in the same category, times a growth multiplier from the 7-day TVL change, times a maturity multiplier from how long the protocol has run with no token. The dashboard is sortable and filterable, every protocol has a detail view with the model's working and a six-step farm plan with costs and times, and a separate view shows the live-token protocols at the market's own values.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22 or later, standard library only, no network. It writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. Screenshots ship in `screenshots/` as base64 text (`*.png.b64`) and are decoded back to whole PNG files by `main.ts` when it runs.

## The model

```
implied value = TVL × peer multiple × growth multiplier × maturity multiplier
```

- **Peer multiple**: median mcap/TVL of the token-bearing protocols in the same category (at least 3 peers, else the global median), clamped to 0.05–1.50.
- **Growth multiplier**: 1 + clamped 7-day TVL change (−50% to +100%) × 0.6.
- **Maturity multiplier**: 0.7 + min(age in days, 1460) / 1460 × 0.5 (age unknown: 365 days).

A protocol on the board *records no token* in the snapshot — that is DefiLlama's record, not proof it has none. The board never predicts whether or when a token is issued; its implied value is this radar's own claim about what a launch would be worth if the protocol's record stayed as it is.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
