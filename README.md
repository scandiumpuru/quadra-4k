# QUADRA — FOUR KEYS. ONE FLOW.

4-key keyboard rhythm game for GitHub Pages.

## Play

- Entry point: `index.html`
- Current track: `music/G線上のアリア.mp3`
- Keys: `F`, `G`, `H`, `J`
- Select a difficulty, then press **START PLAY**.
- Press `Esc` during play to return to music selection.

## Judgement and score

| Judgement | Timing window | Score |
|---|---:|---:|
| PERFECT | ±10 ms | +500 |
| GREAT | ±15 ms | +400 |
| GOOD | ±25 ms | +200 |
| BAD | ±50 ms | 0 |
| MISS | over 50 ms | -100 |

GOOD and above continue the combo. BAD and MISS break it.
The clear condition is a score of at least 90% of the theoretical maximum
(number of notes × 500).

## GitHub Pages

In the repository settings, open **Pages**, choose **Deploy from a branch**,
select the `main` branch and the `/(root)` folder, then save.
The site will be served from the root `index.html`.

## Development note

The current chart is a provisional generated layout using a 72 BPM grid.
Its note timings and patterns still need to be authored and calibrated against
the actual recording before treating it as a final chart.
