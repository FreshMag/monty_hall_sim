# Monty Hall — simulate & play

A static site for the [Monty Hall problem](https://en.wikipedia.org/wiki/Monty_Hall_problem):

- **Simulate** — two simulations run side by side on the same rules, one contestant
  always keeping the first door and one always switching. Each has a live win-rate
  chart that keeps going for as long as you leave it running, converging on 1/3 and 2/3.
- **Play** — pick a door, watch the host open a goat door that is neither yours nor the
  car, then keep or switch. Your stay/switch record is kept in the browser.

No build step, no dependencies — plain HTML, CSS and ES modules.

## Run locally

Because the JavaScript uses ES modules, open it through a server rather than
`file://`:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## Deploying to GitHub Pages

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publishes the repo root
on every push to `main`. One-time setup in the repository:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push to `main` (or run the workflow manually from the Actions tab).

The deployed URL appears on the workflow run and under Settings → Pages —
`https://<user>.github.io/<repo>/`.

## Layout

| Path | What's in it |
| --- | --- |
| `index.html` | Both panels — simulation and game |
| `assets/css/styles.css` | Tokens, layout, door animation; light + dark |
| `assets/js/simulation.js` | Trial engine and the bounded win-rate history |
| `assets/js/chart.js` | Canvas win-rate chart (hover crosshair, log/linear x-axis) |
| `assets/js/game.js` | Interactive game state machine |
| `assets/js/app.js` | Tabs, theme, the run loop that drives both simulations |

## Notes on the simulation

Trials are played out step by step — car placed, door picked, host opens a door that
is neither the pick nor the car, final choice made — rather than shortcutting to
`pick === car`. It costs a little speed and makes the host's constraint, which is what
the puzzle actually turns on, visible in the code.

The chart history is bounded: once the buffer holds 600 samples it drops every other
one and doubles the sampling interval, so an hour-long run stays evenly represented in
constant memory.
