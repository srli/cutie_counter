# Making a Cutie Pack

A cutie pack is a `.cutie` file. It's just a zip with a different name.
You can make one without any code, and load it with **Load Cutie** on the menu.

## The easy way: Cutie Studio

Open the app and pick **Cutie Studio** on the menu. Everything below can be done there with forms,
and it saves in your browser as you go.

| Tab | What you do there |
|---|---|
| **Profile** | Name, intro, colors, times of day and their backgrounds, affinity stages, milestones, random chatter and fidgets. |
| **Art & Sound** | Drop images into the right box: expressions, backgrounds, reward art, portrait, sounds. Big images shrink automatically. Renaming an expression renames it in every line. |
| **Script** | Every beat as a form: *when* it happens, *only if* these are true, *say* these lines, optional choices and flags. |
| **Coverage** | A grid of days × times and goals. Green = written, amber = placeholder, grey = nothing yet. Click an empty square to write it. |
| **Preview** | Pretend it's any day, time, word count, streak or flag, make something happen, and watch your cutie react. |

**Try it** adds your cutie to the picker in this browser. **Export .cutie** downloads the file to share.
Start from scratch with **+ New cutie**, or **Copy Ryder** to see a full example.

## Writing the script in a spreadsheet

Most of the dialogue can be written in Google Sheets and imported in one go.
See [SPREADSHEET_FORMAT.md](SPREADSHEET_FORMAT.md) and the shared workbook `content/cutie-scripts.xlsx`.

## Sharing a cutie with a link

Put the `.cutie` file somewhere public that allows downloads from other sites (for example a GitHub repo or a gist,
using the "raw" link), then share:

```
https://<where the app lives>/?pack=https://<where the file lives>/mira.cutie
```

Whoever opens it sees your cutie's portrait and intro, and can choose to add them.

## Doing it by hand

Click **Load Cutie → What goes in a cutie pack? → download Ryder's pack**,
rename `ryder.cutie` to `ryder.zip`, unzip it, and change things.

## What's inside

```
my-cutie/
  cutie.json      who they are
  script.json     what they say, and when
  images/
    select.png    square portrait for the picker
    neutral.png   one image per expression (any name you like)
    happy.png
    bg_room.png   backgrounds start with bg_
    cg_hug.png    reward art starts with cg_
  sounds/         optional
    giggle.mp3    a line can play it with "sound": "giggle"
```

- **File types:** PNG or JPG (WebP and GIF work too). Use PNG for sprites, since JPG can't be see-through.
- **Expressions:** the file name is the expression name. `blush.png` is the expression `blush`.
- **Sprite size:** tall, full-body PNGs with a see-through background work best. Ryder's are 800 × 2851.
  The app shows the top part (head and chest), so keep faces near the top.
- **Backgrounds:** 1920 × 1080 is plenty.

To package it: zip the **contents** (or the folder, both work), then rename `.zip` to `.cutie`.
If something is wrong, the app lists each problem in plain words, for example:
*"Beat d8-morning, line 1: Expression "smirk" has no image."*

## cutie.json

```json
{
  "formatVersion": 1,
  "id": "ember",
  "name": "Ember",
  "intro": "Ember is a bright, young aspiring novelist...",
  "defaultExpression": "neutral",
  "defaultBackground": "library",
  "backgroundBySlot": { "morning": "library", "evening": "library_night" },
  "timeSlots": [
    { "id": "morning", "start": "05:00" },
    { "id": "late_morning", "start": "11:00" },
    { "id": "evening", "start": "16:00" },
    { "id": "midnight", "start": "23:00" },
    { "id": "ultra_late", "start": "02:00" }
  ],
  "stages": [
    { "id": "stranger", "name": "Stranger", "minTotalPct": 0 },
    { "id": "friend", "name": "Friend", "minTotalPct": 40, "defaultExpression": "smile" },
    { "id": "close", "name": "Close", "minTotalPct": 80, "defaultExpression": "happy" }
  ],
  "milestones": { "daily": [10, 33, 50, 75, 100], "total": [10, 25, 50, 75, 100] },
  "ambient": { "everyMinutes": 20, "chance": 0.35 },
  "idle": { "everySeconds": 30, "expressions": [{ "expression": "neutral", "weight": 6 }, { "expression": "thinking", "weight": 2 }] },
  "colors": { "accent": "#e08a6a", "name": "#8f4f3a" }
}
```

| Field | What it does |
|---|---|
| `id` | Short name, lowercase, no spaces. A pack with the same id replaces the old one. |
| `timeSlots` | Times of day. **The first one in the list starts the day.** Slots after midnight but before it (`midnight`, `ultra_late`) belong to the night before, so day 18's 2 a.m. line plays after day 18's 11 p.m. line, and writing past midnight doesn't start `midnight` over. |
| `stages` | Affinity levels. As total words grow past `minTotalPct`% of the goal, the cutie moves up a stage. A stage's `defaultExpression` becomes their resting face (idle fidgets use it in place of the main `defaultExpression`). |
| `milestones` | Percentages that always "fire". If you haven't written a line for one, a `[PLACEHOLDER …]` shows instead, so you can see what's missing. |
| `ambient` | Every N minutes, a `chance` (0 to 1) of random chatter. |
| `idle` | Every N seconds with nothing happening, swap to a random expression (weights = odds). |

## script.json

The script is a list of **beats**. A beat says: *when this happens, and these things are true, say this.*

```json
{
  "formatVersion": 1,
  "beats": [
    {
      "id": "d1-morning",
      "trigger": { "type": "time_slot", "value": "morning" },
      "when": [{ "var": "day", "op": "==", "value": 1 }],
      "lines": [
        { "text": "Good morning, {player}. Day one!", "expression": "smile" },
        { "text": "Let's get writing.", "expression": "happy" }
      ]
    }
  ]
}
```

### Triggers: when a beat can play

| `type` | `value` | Happens when… |
|---|---|---|
| `session_start` | – | the story is opened |
| `reopen` | – | the story is opened again later the same day ("welcome back") |
| `day_start` | day number | the first visit on a new day. `30` is the last day of a 30-day month, whatever the date |
| `time_slot` | slot id | a time of day (`morning`, `evening`…) begins while the writer is here, or they arrive during it |
| `daily_pct` | e.g. `50` | today's words pass 50% of the daily goal |
| `total_pct` | e.g. `50` | total words pass 50% of the whole goal |
| `words_today` | e.g. `500` | today's words pass 500 |
| `words_total` | e.g. `10000` | total words pass 10,000 |
| `words_every` | e.g. `1000` | every 1,000 words |
| `date` | `"10-31"` | a calendar date (month-day). For "the last day" use `day_start` `30`: stories can start any day |
| `stage` | stage id | moving up to that stage |
| `streak` | e.g. `7` | a 7-day writing streak |
| `idle` | minutes | no typing for that long |
| `random` | – | ambient chatter roll succeeds |
| `after` | beat id, or `beatId/choiceId` | right after that beat, or after picking that choice |

Leave out `value` to match any value, e.g. any `daily_pct`.

### Conditions: `when`

Every condition must be true. Each is `{ "var": …, "op": …, "value": … }`.

| `var` | Meaning |
|---|---|
| `day` | project day (1 = first day, 0 = the day before). Night time slots count as the day they follow |
| `date` | today as `"MM-DD"` |
| `weekday` | 0 = Sunday … 6 = Saturday |
| `hour` | 0–23 |
| `timeSlot` | current slot id |
| `stage` | current stage id |
| `totalWords`, `todayWords` | word counts |
| `totalPct`, `dailyPct` | progress percentages |
| `missedDays` | days with no writing so far |
| `daysAway` | blank days right before today |
| `streak` | writing days in a row |
| `flag:anything` | a flag set by a choice or beat |
| `flag:visits_morning` | built in: how many days the writer has been here in the morning, today included. One per time slot: `visits_evening`, `visits_ultra_late`… |
| `seen:beat-id` | `true` if that beat has played |
| `chance` | random: `{ "var": "chance", "op": "<", "value": 0.3 }` is a 30% roll |

`op` is one of `==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `not_in` (`in` takes a list: `"value": [1, 2, 3]`).

### More beat options

| Field | What it does |
|---|---|
| `priority` | If several beats match, the highest wins. Default 0. |
| `weight` | Among ties, higher weight = more likely. Default 1. |
| `repeat` | `always` (default), `daily`, or `once`. |
| `cooldownMinutes` | Wait this long before playing again. |
| `variants` | A list of line lists; one is picked at random. Use instead of `lines`. |
| `choices` | Buttons for the player. Each has `id`, `text`, optional `lines` and `effects`. |
| `prompt` | What the player says before choosing. |
| `effects` | Change flags: `{ "flag": "fed", "op": "set", "value": true }` or `{ "flag": "visits", "op": "add", "value": 1 }`. |
| `note` | A note to yourself. Never shown. |
| `display` | `"scene"` plays it full screen over the writing area, like a cutscene. |

### Lines

| Field | What it does |
|---|---|
| `text` | What they say. Can use `{player}`, `{cutie}`, `{day}`, `{todayWords}`, `{totalWords}`, `{dailyGoal}`, `{wordsLeftToday}`, `{wordsLeft}`, `{streak}`, `{flag:name}`. |
| `expression` | Switch to this expression. Lines without one keep the last. |
| `background` | Switch background (name without `bg_`). |
| `cg` | Show reward art (name without `cg_`). In the textbox it shows for that line only; in a full-screen scene it stays until another `cg` or `"none"`. Seen pictures are kept in the story's **Gallery**. |
| `sound` | Play a clip from `sounds/` (name without extension). |
| `style` | `"thought"` shows the line in italics, in parentheses. |
| `speaker` | Someone else talking. `"player"` uses the player's name. |

### Placeholders

Write `[PLACEHOLDER anything]` as a line's text to mark a gap, like `[PLACEHOLDER 80 AFFINITY]`.
Placeholders show in amber so they're easy to spot while testing.
