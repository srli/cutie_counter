# Agent guide: Cutie Counter

Read this whole file before you change anything.

## Who you're working with

The person driving you is an **artist, not a programmer**. She knows the characters, the art, and the story.
She may not know git, JSON, or the terminal.

- Explain in plain words. Say what you'll change and what she'll see, not how the code works, unless she asks.
- Before any change that touches more than one file, post a short plan and wait for a yes.
- After a change, **show her**: run the app or take screenshots (see *Seeing your work*), and tell her what to click.
- Never ask her to type a command you could run yourself. If she must run one, give it exactly, in one block.
- If something fails, say what failed in one sentence and what you'll try next. Don't hide errors.

## What this app is

A writing app with a dating-sim twist. The writer types their novel on the right; a **cutie** on the left reacts
to word goals, time of day, dates, streaks, idling, and random moments, and grows closer through **affinity stages**.
Everything runs in the browser (no server). It's hosted free on GitHub Pages.

Cuties are **packs** (`.cutie` files: a zip of `cutie.json`, `script.json`, `images/`, optional `sounds/`).
The format is documented for humans in [`docs/CUTIE_PACK_GUIDE.md`](docs/CUTIE_PACK_GUIDE.md). Read it.

## Decide first: is this content or code?

Most requests are **content**. Prefer the lightest path that works.

| She wants… | Do this | Code change? |
|---|---|---|
| New lines, new beats, fix a typo, new expressions or backgrounds | Edit the pack. In the app: **Cutie Studio**. Or edit `content/<id>/` directly | No |
| A brand-new cutie shipped with the app | New folder `content/<id>/` with `cutie.json`, `script.json`, `images/` | No |
| A cutie she shares privately | Make it in Cutie Studio → **Export .cutie**, share the file or a `?pack=` link | No |
| Something the pack format can't express yet (new trigger, new line effect, new screen) | Code change, following *Extending the engine* below | Yes |
| Look and feel (colors, layout, fonts) | `src/styles.css`, `src/studio/studio.css` | Yes, small |

If a request can be met with content, do that and say so. Don't add code for things a beat can already do:
check the trigger, condition, and line tables in the pack guide first.

## Project map

```
content/<id>/          built-in cuties (source). Ryder is the full example.
  cutie.json             profile, time slots, stages, milestones, random behaviour
  script.json            the beats
  images/                select.png, <expression>.png, bg_<name>.png, cg_<name>.png
  sounds/                optional <name>.mp3/.ogg/.wav
public/                  served as-is: ui/ art, fonts/, icons/, sw.js, manifest
public/packs/            GENERATED from content/ by `npm run packs`. Never edit; it's gitignored.
src/engine/              pure TypeScript, no UI. The rules of the game.
  types.ts               every data shape: manifest, beat, trigger, condition, line, project
  director.ts            inputs (open, typing, clock, choices) -> events -> chosen beats -> scenes
  progress.ts            day number, today's words, streak, days away, stage
  conditions.ts          evaluates `when` conditions
  text.ts                {player}-style template fills, placeholder detection
  time.ts, rng.ts        dates/time slots; seeded random
  engine.test.ts         behaviour tests. Add to these.
src/pack/                load.ts (unzip + image URLs), validate.ts (friendly error messages)
src/ui/                  the writer's screens. useStory.ts wires the engine to timers and the editor.
src/studio/              Cutie Studio (the in-app pack editor). Lazy-loaded.
scripts/                 build-packs.ts, screenshot.ts, convert-legacy.ts, make-icons.ts
docs/CUTIE_PACK_GUIDE.md the pack format, for humans
legacy/                  v1 dialogue files, kept for reference only
```

## Commands

```sh
npm install          # once
npm run dev          # app at http://localhost:5173 (rebuilds packs first)
npm test             # engine + studio tests (rebuilds packs first)
npm run typecheck
npm run shots        # headless screenshots into screenshots/ ; `npm run shots -- studio` for one scenario
npm run build        # static site in dist/
```

Requires Node 22+. Scratch files go in a temp folder, not the repo.

## Seeing your work

This app is visual. **Always look at what you changed before saying it's done.**

- `npm run shots` drives the real app in headless Chromium with a fixed clock and saves PNGs to `screenshots/`.
  Open and look at the relevant ones. Check layout, overlap, cut-off text, and that the right expression/background shows.
- To show a specific moment, add a scenario to `scripts/screenshot.ts` (copy an existing one).
  `newStory(browser, base, '<local datetime>', viewport, '<day 1 date>')` starts a story at any time and day.
- For content, the **Preview** tab in Cutie Studio can simulate any day, time, word count, days away, and flags.
- Check phone width too: the `phone` scenario uses 390 × 844.

## Content rules

- Every beat `id` is unique. Use readable ids: `d8-morning`, `total-50`, `stage-close`, `ambient-friend`.
- Day-specific beats use a condition `{ "var": "day", "op": "==", "value": 8 }`, not a special trigger.
- Use `{player}` for the player's name. Don't hard-code names.
- Mark unwritten moments with `[PLACEHOLDER what goes here]`. They show in amber while testing, and the Studio's
  Coverage tab counts them. Never delete a placeholder without writing the real line.
- Expressions, backgrounds, reward art and sounds are found **by file name**. A line's `"expression": "blush"` needs
  `images/blush.png`. The validator catches typos; run `npm test` or open the pack in the Studio.
- Sprites: tall full-body PNGs with transparent backgrounds, faces near the top (Ryder's are 800 × 2851).
  Backgrounds about 1920 × 1080. Portrait `select.png` square. The build shrinks them to WebP.
- Keep `cutie.json` `formatVersion` at `1` unless you change the format (see below).

## Extending the engine

Only when content can't do it. Keep the engine **pure** (no DOM, no storage, no `Date.now()`; time comes in as an argument).

**New trigger type** (e.g. "chapter heading added"):
1. `src/engine/types.ts`: add to `TriggerType` and `TRIGGER_TYPES`, with a comment.
2. `src/engine/director.ts`: emit the event from the right input. Gate it so it can't fire twice for the same moment
   (`firedOnce` / `firedToday`). If it should show a placeholder when unwritten, add it to `PLACEHOLDER_EVENTS`.
3. `src/pack/validate.ts`: validate its `value`, with a message an artist understands.
4. `src/studio/BeatsTab.tsx`: add a plain-English label to `TRIGGER_LABELS` and a value input if needed.
5. `docs/CUTIE_PACK_GUIDE.md`: add a row to the trigger table.
6. `src/engine/engine.test.ts`: test that it fires, and doesn't fire twice.

**New condition variable**: `types.ts` (`ConditionVar`, and `Stats` if derived) → `progress.ts` (compute it) →
`conditions.ts` (`readVar`) → `BeatsTab.tsx` (`VAR_LABELS`) → pack guide → test.

**New line field** (e.g. a screen shake): `types.ts` (`Line`) → validate it in `validate.ts` → act on it in
`src/ui/useStory.ts` / `CutiePane.tsx` → Studio line "more options" in `BeatsTab.tsx` → pack guide → screenshot.

**Format changes:** adding optional fields is fine. Renaming or removing fields breaks packs people already made;
don't, unless you also bump `PACK_FORMAT_VERSION` and make the loader upgrade old packs. Ask first.

Every change to what a pack can say must update **all four**: engine, validator, Studio, pack guide.

## Code style

- TypeScript strict, React function components, plain CSS with the variables in `src/styles.css`
  (pastel lavender → blue; fonts Poetsen for titles, Sansita for dialogue).
- Match the surrounding code. Short comments that say *why*. No new dependencies without asking.
- User-facing text is warm and simple. Error messages say what to fix, e.g.
  *"Expression "smirk" has no image. Available: neutral, smile."*
- Respect `prefers-reduced-motion` for any animation.
- Writers' stories never leave the browser. Don't add analytics, accounts, or network calls with story text.

## Before you call it done

1. `npm run typecheck` and `npm test` pass.
2. You looked at screenshots of what changed (desktop and phone).
3. The pack guide is updated if the format changed.
4. Tell her in two or three sentences what changed and how to see it.

## Git and publishing

- Never push to `master`. Pushing to `master` deploys the live site.
- Work on a branch named for the change (`add-ember`, `halloween-beats`), commit with a clear message, push the branch,
  and open a pull request for review. Give her the PR link.
- `public/packs/`, `screenshots/`, `dist/`, `node_modules/` are generated; never commit them.
- Never commit tokens, passwords, or `.env` files.
