# QUADRA — FOUR KEYS. ONE FLOW.

4-key keyboard rhythm game for GitHub Pages.

## Play

- Entry point: `index.html`
- Current track: `music/G線上のアリア.mp3`
- Keys: `F`, `G`, `H`, `J`
- Select a chart difficulty and judgement mode, then press **START PLAY**.
- Hi-Speed: choose ×0.5–×5.0 on the selection screen; use `↑` / `↓` during play to adjust by 0.1.
- Press `Esc` during play to return to music selection.
- HOLD notes: press at the start and keep the same key held until the tail reaches the judgement line. Releasing early breaks the hold and counts as MISS.
- Chart files are JSON under `charts/`; each difficulty has explicit beat/lane/type events. Use `type: "hold"` with `durationBeats` for a hold.

## Judgement and score

| Judgement | Timing window | Score |
|---|---:|---:|
| Judgement | Easy (×2.0) | Normal (×1.5) | Hard (×1.0) | Score |
|---|---:|---:|---:|---:|
| PERFECT | ±20 ms | ±15 ms | ±10 ms | +500 |
| GREAT | ±30 ms | ±22.5 ms | ±15 ms | +400 |
| GOOD | ±50 ms | ±37.5 ms | ±25 ms | +200 |
| BAD | ±100 ms | ±75 ms | ±50 ms | 0 |
| MISS | over 100 ms | over 75 ms | over 50 ms | -100 |

The default judgement mode is **Normal**. The judgement mode changes timing windows only; scoring and combo rules remain unchanged.

GOOD and above continue the combo. BAD and MISS break it.
The clear condition depends on the selected judgement mode:

| Judgement mode | Clear threshold |
|---|---:|
| Easy (甘口) | 75% or more |
| Normal (普通) | 85% or more |
| Hard (辛口) | 90% or more |

The threshold is calculated against the theoretical maximum (number of notes × 500).

## GitHub Pages

In the repository settings, open **Pages**, choose **Deploy from a branch**,
select the `main` branch and the `/(root)` folder, then save.
The site will be served from the root `index.html`.

## Chart JSON format

The current chart is `charts/g-string-air.json`. It defines BPM, offset, a repeating 16-beat phrase, and explicit events for each difficulty. Each event uses `beat`, `lane` (0–3), and `type` (`tap` or `hold`). HOLD events also require `durationBeats`. The phrase currently repeats with a one-lane rotation on each repeat.

This is a first playable draft, not a transcription synchronized to the recording. BPM, offset, phrase repetitions, and individual events should be calibrated against the actual recording before treating it as a final chart.


## La Campanella chart

Liszt's `ラ・カンパネラ` chart is stored at `charts/la-campanella.json`. It is authored as twenty distinct 32-beat sections (640 beats total) with no automatic repetition or lane rotation. The new version emphasizes long and medium HOLD anchors, hold-constrained staircases across the other lanes, adjacent-lane trills, syncopated fragments, broken-arpeggio leaps, and changing phrase contours.

The BPM (120) and offset (0.35 seconds) are provisional and must be calibrated against the exact MP3 recording. HOLDs count as one chart note and are judged when released at the tail.
