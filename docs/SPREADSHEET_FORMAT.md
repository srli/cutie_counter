# Writing a cutie's script in a spreadsheet

The whole script for a cutie can live in one Google Sheet. One upload turns it into the cutie's script,
so nothing has to be retyped in the Studio.

The shared workbook is [`content/cutie-scripts.xlsx`](../content/cutie-scripts.xlsx): Ryder, Ember and a Template,
plus a **How to** tab and a **Cheat sheet** tab. Upload it to Google Drive and open it with Google Sheets.

## Round trip

1. Write in Google Sheets.
2. **File → Download → Microsoft Excel (.xlsx)**.
3. In the app: **Cutie Studio → open the cutie → Import spreadsheet** → pick the file.
4. The Studio shows how many moments are new, changed and removed, and lists any problems by tab and row.
   Nothing changes until you press **Apply**. Problems must be fixed first.
5. **Preview** and **Coverage** work as usual. **Export .cutie** to share.

Importing replaces the cutie's whole script with what the sheet says. If you change things in the Studio,
use **Download spreadsheet** there and copy those tabs back into the shared sheet, so the sheet stays the one source.

For the built-in cuties (developers): save the workbook as `content/cutie-scripts.xlsx` and run `npm run sheet`.
It rewrites `content/<id>/script.json` for each cutie with tabs, and refuses if any tab has problems.

## Tabs

Tabs are found **by name**: `<Cutie> – <Tab>`, for example `Ryder – Time of day`. Other tabs (notes, ideas) are ignored.
To start a new cutie, duplicate the `Template – …` tabs and rename them.

| Tab | Rows | Columns | Plays… |
|---|---|---|---|
| **Time of day** | Day `1`…`31`, or `Any` | Morning · Late morning · Evening · Midnight · Ultra-late | when that time of day starts |
| **Daily goal** | Day, or `Any` | `10%` `33%` … `200%` (any %) · `Missed yesterday` | as today's words pass each %; "Missed yesterday" on the first visit after a day with no writing |
| **Whole goal** | `0%`, `10%`, … `100%` | Line | as the whole novel passes each %. `0%` is the very first thing they say |
| **Special days** | `10-31`, or `Day 7` | Line | on that date, or on that project day |
| **Random chatter** | one line per row | Stage (blank = any) · Line | at random while writing (every 30 minutes at most) |
| **Reactions** | one per row | When · If · Line · Options · Notes | anything else: `Welcome back`, `Idle 5 min`, `Streak 7`, `Every 1000 words`… |
| **Scenes** | one line per row | Scene · When · If · Who · Face · Line · Choice · Options · Notes | long moments with several people and choices |

`Any` rows are the fallback: a day's own line wins when there is one.

## Inside a cell

| Write | Means |
|---|---|
| `{smile} Good morning.` | Change face, then say the line. A face can go before any sentence. |
| a new line in the cell (Ctrl/⌘ + Enter) | next textbox page |
| `You: Sure!` · `Narrator: He sighs.` | someone else talking |
| `[A: No, not yet] Try to eat. [B: Yup.] Good.` | choices for the player, then each answer |
| `[You: Before I start writing...]` | the player says this before the choices |
| `[if missed days = 0] … [elif missed days = 1] … [else] …` | different lines depending on what's true; the first true one plays |
| `[or]` | random versions; one is picked each time |
| `[set likes chocolate = yes]` · `[add 1 to hugs]` | remember or count something |
| `[thinks]` · `[bg room_night]` · `[picture first_date]` · `[sound giggle]` | thought, background, reward art, sound |
| `{player}` · `{daily goal}` · `{words today}` · `{words left today}` · `{total words}` · `{words left}` · `{day}` · `{streak}` | filled in for you |
| `[PLACEHOLDER what goes here]` | a known gap (shows in amber) |

Long speech is split into textbox-sized pages at sentence ends automatically.

### Conditions

Inside `[if …]` or the **If** column. Join with `and`.

| Phrase | True when |
|---|---|
| `missed days = 0` · `missed days > 2` | days with no writing so far |
| `missed yesterday` · `wrote yesterday` | whether they wrote yesterday |
| `daily goal done` · `daily goal not done` | today's goal |
| `saw day 18 ultra-late` · `saw whole goal 50%` · `saw <scene name>` | that moment has played before |
| `morning visits > 10` · `ultra-late visits > 4` | how many times they've talked at that time of day |
| `stage = Friend` | current affinity stage |
| `it's ultra-late` | current time of day |
| `likes chocolate = yes` · `hugs > 3` | something remembered with `[set]` / `[add]` |
| `day > 20` · `streak > 3` · `words today > 500` · `total words > 10000` | numbers |
| `chance 30%` | random |

### When (Reactions and Scenes)

`Day 8 Morning` · `Any Evening` · `Daily goal 50%` · `Day 3 Daily goal 100%` · `Whole goal 25%` · `Story opened` ·
`Welcome back` · `New day` · `Date 10-31` · `Stage Friend` · `Streak 7` · `Idle 5 min` · `Every 1000 words` ·
`Words today 500` · `Total words 10000` · `Random` · `After <scene name>` · `After whole goal 25%`

### Options

`once` · `daily` · `wait 30 min` · `priority 2` · `odds 3`, separated by commas.

## The Scenes tab

| Scene | When | If | Who | Face | Line | Choice | Options |
|---|---|---|---|---|---|---|---|
| Movie night | Whole goal 50% | | Ryder | smile | Want to watch a movie? | | once |
| | | | You | | | A: Romance | |
| | | | You | | | B: Horror | |
| | | | Ryder | blush | Oh? A romance, then... | A | |
| | | | Ryder | upset | I'm fine. Totally fine. | B | |
| | | | Narrator | | The credits roll. | | |
| | | | Ryder | | Tissues? | A | |
| | | | Ryder | | I'm leaving the light on tonight. | B | |
| | | | Ryder | happy | Back to writing? | | |

- **Scene** names it, on the first row only. Rows below with the Scene cell empty belong to it.
- **When / If / Options** go on the first row.
- **Who**: the cutie's name (or blank), `You`, `Narrator` (no name box), or anyone else's name.
- **Choice**: on a `You` row, `A: button text` makes a button. A letter (`A`, or `A, C`) on a later row means
  "only if that was picked". Rows with an empty Choice are seen by everyone, so the paths rejoin.
- Dropdowns on **Who** and **Face** keep the spelling right.

## How it maps to the app (developers)

- Grid cells become beats with ids like `d8-morning`, `d8-morning-if`, `any-daily-100`, `total-25`, `intro`, `date-10-31`.
- `[if]` branches share a trigger; earlier branches get higher priority, so the first true one plays. `Any` rows get priority −10.
- Time-of-day beats add 1 to the flag `<slot>_talks` (what "morning visits" reads).
- Scenes become a chain: `scene`, `scene.1`, `scene.2.A` …, linked with `after` triggers. Later branch rows check
  `flag:choice:<beat>`; shared rows follow `branchA|branchB|previous`, so paths rejoin.
- `src/sheet/`: `xlsx.ts` (read/write, no dependencies beyond fflate), `markup.ts` (cells), `workbook.ts` (tabs ⇄ beats).
  Export then import gives the same beats; `src/sheet/sheet.test.ts` checks this on Ryder.
