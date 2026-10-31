# Cutie Counter

A writing app with a dating-sim twist. Write your novel, and your cutie cheers you on.
They react to your word count, the time of day, streaks, special dates, and more, and grow closer as your story grows.

Everything stays in your browser. Nothing is sent anywhere. It works offline after the first visit
and can be installed as an app.

- **Write:** a calm editor with autosave, export to Markdown, and story backups.
- **Cuties:** react to word goals, time of day, dates, streaks, idling, and random moments; grow closer through affinity stages; unlock pictures for the gallery.
- **Cutie Studio:** make or edit a cutie with forms, check coverage of every day, preview any moment, export a `.cutie` file.
- **Share:** `?pack=<url>` links offer a cutie to whoever opens them.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests
npm run shots      # screenshots of key screens into screenshots/
npm run build      # static site in dist/
npx tsx scripts/make-icons.ts   # rebuild app icons from the logo
```

## Make a cutie

Cuties are `.cutie` pack files: art plus a script, no code. See [docs/CUTIE_PACK_GUIDE.md](docs/CUTIE_PACK_GUIDE.md).
Built-in packs live in `content/<id>/` and are packed by `npm run packs`.

## How it fits together

```
src/engine/    pure TypeScript, no UI
  director.ts  inputs (open, typing, clock, choices) -> events -> beats -> scenes
  progress.ts  day number, today's words, streaks, stages
  conditions.ts, time.ts, text.ts, rng.ts
src/pack/      .cutie loading and friendly validation
src/ui/        React screens; useStory.ts wires the engine to timers and the editor
src/studio/    Cutie Studio (lazy-loaded): drafts, coverage grid, preview simulator
src/store.ts   IndexedDB storage for stories and loaded packs
content/       built-in cutie packs (source)
legacy/        the v1 dialogue files (converted by scripts/convert-legacy.ts)
```

## Deploy

`.github/workflows/pages.yml` builds and publishes to GitHub Pages on push to `master`.
Turn it on in the repo's Settings → Pages → Source: GitHub Actions.
