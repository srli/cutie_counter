/**
 * Drive the app in headless Chromium and save screenshots to screenshots/.
 * Run: npm run shots            (all scenarios)
 *      npm run shots -- choice  (only scenarios whose name contains "choice")
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import { chromium, type Browser, type Page } from 'playwright'
import { createServer } from 'vite'

const root = join(import.meta.dirname, '..')
const outDir = join(root, 'screenshots')
mkdirSync(outDir, { recursive: true })

const filter = process.argv[2] ?? ''
const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }

const words = (n: number) => Array.from({ length: n }, (_, i) => ['the', 'moon', 'hung', 'low', 'over', 'quiet', 'shelves'][i % 7]).join(' ')

async function shot(page: Page, name: string) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(outDir, `${name}.png`) })
  console.log(`  📸 ${name}.png`)
}

/** Fresh browser profile, fixed clock, then a new story through the real setup screen. */
async function newStory(browser: Browser, base: string, time: string, viewport = DESKTOP, day1 = time.slice(0, 10)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('  page error:', e.message))
  await page.clock.setFixedTime(new Date(time))
  await page.goto(`${base}#/setup`)
  await page.getByPlaceholder('What should they call you?').fill('Sophie')
  await page.getByPlaceholder('Untitled story').fill('The Moonlit Library')
  await page.getByLabel('Day 1').fill(day1)
  await page.getByRole('button', { name: "Let's Start!" }).click()
  await page.locator('.textbox').waitFor()
  await page.waitForTimeout(1500) // typewriter
  return { ctx, page }
}

async function typeWords(page: Page, n: number) {
  await page.locator('.tiptap').click()
  await page.keyboard.insertText(words(n) + ' ')
  await page.waitForTimeout(900) // word-count debounce + typewriter
}

const scenarios: Record<string, (b: Browser, base: string) => Promise<void>> = {
  async menu(browser, base) {
    const ctx = await browser.newContext({ viewport: DESKTOP })
    const page = await ctx.newPage()
    await page.goto(base)
    await page.locator('.menu-option').first().waitFor()
    await shot(page, 'menu')
    await page.getByRole('button', { name: /New Story/ }).click()
    await page.getByPlaceholder('What should they call you?').fill('Sophie')
    await shot(page, 'setup')
    await ctx.close()
  },

  async morning(browser, base) {
    const { ctx, page } = await newStory(browser, base, '2026-11-01T07:30:00')
    await shot(page, 'write-day1-intro')
    await page.locator('.textbox').click()
    await page.waitForTimeout(1500)
    await page.locator('.textbox').click()
    await page.waitForTimeout(1800)
    await shot(page, 'write-day1-morning')
    await typeWords(page, 600)
    await shot(page, 'write-daily-33pct')
    await ctx.close()
  },

  async choice(browser, base) {
    const { ctx, page } = await newStory(browser, base, '2026-11-01T12:15:00')
    for (let i = 0; i < 3 && !(await page.locator('.choice').count()); i++) {
      await page.locator('.textbox').click()
      await page.waitForTimeout(1500)
    }
    await shot(page, 'write-choice')
    await page.locator('.choice').first().click()
    await page.waitForTimeout(1500)
    await shot(page, 'write-choice-answer')
    await ctx.close()
  },

  async night(browser, base) {
    const { ctx, page } = await newStory(browser, base, '2026-11-01T23:40:00')
    await page.locator('.textbox').click()
    await page.waitForTimeout(1500)
    await page.locator('.textbox').click()
    await page.waitForTimeout(2500)
    await shot(page, 'write-night')
    await ctx.close()
  },

  async placeholder(browser, base) {
    // Day 5 has no script, so the time slot shows a placeholder.
    const { ctx, page } = await newStory(browser, base, '2026-11-05T09:00:00', DESKTOP, '2026-11-01')
    await page.locator('.textbox').click()
    await page.waitForTimeout(1500)
    await page.locator('.textbox').click()
    await page.waitForTimeout(1200)
    await shot(page, 'write-placeholder')
    await ctx.close()
  },

  async phone(browser, base) {
    const { ctx, page } = await newStory(browser, base, '2026-11-01T07:30:00', PHONE)
    await shot(page, 'phone-write')
    await page.goto(`${base}#/`)
    await page.locator('.menu-option').first().waitFor()
    await shot(page, 'phone-menu')
    await ctx.close()
  },

  async persist(browser, base) {
    const { ctx, page } = await newStory(browser, base, '2026-11-01T07:30:00')
    await typeWords(page, 120)
    await page.getByRole('button', { name: '‹ Menu' }).click()
    await page.locator('.menu-option').first().waitFor() // menu shows once the save finished
    await page.reload() // also proves IndexedDB survives a reload
    await page.getByRole('button', { name: /Continue/ }).click()
    await page.locator('.tiptap').waitFor()
    await page.waitForTimeout(1500)
    const text = await page.locator('.tiptap').innerText()
    const today = await page.locator('.meter-text').first().innerText()
    if (!text.includes('the moon hung low') || !today.startsWith('120')) throw new Error(`not restored: "${today}"`)
    console.log(`  ✓ restored ${today} words`)
    await shot(page, 'write-continued')
    await ctx.close()
  },

  async loadcutie(browser, base) {
    const ctx = await browser.newContext({ viewport: DESKTOP })
    const page = await ctx.newPage()
    await page.goto(base)
    await page.getByRole('button', { name: /Load Cutie/ }).click()
    await shot(page, 'load-cutie')
    const bad = zipSync({
      'mira/cutie.json': strToU8(JSON.stringify({ formatVersion: 1, id: 'mira', name: 'Mira', intro: 'Hi', defaultExpression: 'neutral', defaultBackground: 'cafe' })),
      'mira/script.json': strToU8(JSON.stringify({ formatVersion: 1, beats: [{ id: 'hi', trigger: { type: 'session_start' }, lines: [{ text: 'Hi!', expression: 'smirk' }] }] })),
      'mira/images/neutral.png': new Uint8Array([137, 80, 78, 71]),
    })
    await page.locator('.dropzone').evaluate(() => {}) // ensure mounted
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.dropzone').click()])
    await chooser.setFiles({ name: 'mira.cutie', mimeType: 'application/zip', buffer: Buffer.from(bad) })
    await page.locator('.issues').first().waitFor()
    await shot(page, 'load-cutie-errors')
    await ctx.close()
  },

  async studio(browser, base) {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.error('  page error:', e.message))
    await page.goto(`${base}#/studio`)
    await page.getByRole('button', { name: 'Copy Ryder' }).click()
    await page.locator('.studio-tabs').waitFor()
    await shot(page, 'studio-profile')
    await page.getByRole('tab', { name: 'Art & Sound' }).click()
    await shot(page, 'studio-art')
    await page.getByRole('tab', { name: 'Script' }).click()
    await page.locator('.beat-item', { hasText: 'd1-late_morning' }).click()
    await shot(page, 'studio-beat')
    await page.getByRole('tab', { name: 'Coverage' }).click()
    await shot(page, 'studio-coverage')
    // Empty cell -> new beat, opened in the editor.
    await page.locator('.cov-table button.cov-cell.missing').first().click()
    await page.locator('.beat-editor textarea').first().fill('Day three already? Look at you go, {player}.')
    await shot(page, 'studio-new-from-grid')
    await page.getByRole('tab', { name: 'Preview' }).click()
    await page.getByLabel('Project day').fill('8')
    await page.getByLabel('Date & time').fill('2026-11-08T07:15')
    await page.getByLabel('Days away').fill('2')
    await page.getByRole('button', { name: '▶ Play' }).click()
    await page.waitForTimeout(1800)
    await shot(page, 'studio-preview')
    await ctx.close()
  },

  async gallery(browser, base) {
    // Author a reward picture in the Studio, then meet it in a story.
    const ctx = await browser.newContext({ viewport: DESKTOP })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.error('  page error:', e.message))
    await page.clock.setFixedTime(new Date('2026-11-01T07:30:00'))
    await page.goto(`${base}#/studio`)
    await page.getByRole('button', { name: 'Copy Ryder' }).click()
    await page.getByRole('tab', { name: 'Art & Sound' }).click()
    await page.locator('.asset.add input').nth(2).setInputFiles({
      name: 'first_meeting.png', mimeType: 'image/png', buffer: readFileSync(join(root, 'content/ryder/images/bg_room_day.png')),
    })
    await page.locator('.asset.kind-cg img').waitFor()
    await page.getByRole('tab', { name: 'Script' }).click()
    await page.locator('.beat-item', { hasText: 'intro' }).first().click()
    await page.getByRole('button', { name: 'More options' }).nth(1).click()
    await page.locator('.line-more .sfield', { hasText: 'Reward art' }).locator('select').selectOption('first_meeting')
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: 'Try it' }).click()
    await page.locator('.studio-notice').waitFor()
    await page.goto(`${base}#/setup`)
    await page.getByPlaceholder('What should they call you?').fill('Sophie')
    await page.getByLabel('Day 1').fill('2026-11-01')
    await page.getByRole('button', { name: "Let's Start!" }).click()
    await page.locator('.textbox').waitFor()
    await page.waitForTimeout(1200)
    await page.locator('.textbox').click() // line 2 shows the reward picture
    await page.locator('.cutie-pane .cg').waitFor()
    await page.waitForTimeout(1500)
    await shot(page, 'write-cg')
    await page.locator('.textbox').click() // next line clears it
    await page.locator('.cutie-pane .cg').waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Gallery' }).click()
    await shot(page, 'gallery')
    await ctx.close()
  },

  async sharelink(browser, base) {
    const ctx = await browser.newContext({ viewport: DESKTOP })
    const page = await ctx.newPage()
    await page.goto(`${base}?pack=packs/ryder.cutie#/`)
    await page.getByRole('button', { name: 'Add Ryder' }).waitFor()
    await shot(page, 'share-link')
    await ctx.close()
  },

  async sheet(browser, base) {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.error('  page error:', e.message))
    await page.goto(`${base}#/studio`)
    await page.getByRole('button', { name: 'Copy Ryder' }).click()
    await page.locator('.studio-tabs').waitFor()
    await shot(page, 'studio-header')
    await page.getByRole('button', { name: 'Import spreadsheet' }).click()
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose .xlsx…' }).click()])
    await chooser.setFiles(join(root, 'content/cutie-scripts.xlsx'))
    await page.locator('.import-summary').waitFor()
    await shot(page, 'sheet-import-report')
    await page.getByRole('button', { name: 'Apply' }).click()
    // Play the 25% cutscene in the preview.
    await page.getByRole('tab', { name: 'Preview' }).click()
    await page.locator('.sfield', { hasText: 'Something happens' }).locator('select').selectOption('total_pct')
    await page.locator('.sfield', { hasText: 'Which one' }).locator('input').fill('25')
    await page.getByRole('button', { name: '▶ Play' }).click()
    for (let i = 0; i < 40 && !(await page.locator('.choice').count()); i++) {
      await page.locator('.textbox').click()
      await page.waitForTimeout(250)
    }
    await page.waitForTimeout(1500)
    await shot(page, 'scene-choices')
    await page.locator('.choice').nth(1).click()
    for (let i = 0; i < 20 && !(await page.locator('.textbox-text.narration').count()); i++) {
      await page.locator('.textbox').click()
      await page.waitForTimeout(250)
    }
    await page.waitForTimeout(1500)
    await shot(page, 'scene-narration')
    await ctx.close()
  },

  async studionew(browser, base) {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.error('  page error:', e.message))
    page.on('dialog', (d) => void d.accept('Mira'))
    await page.goto(`${base}#/studio`)
    await page.getByRole('button', { name: '+ New cutie' }).click()
    await page.locator('.studio-tabs').waitFor()
    await page.locator('.status-badge').click()
    await shot(page, 'studio-blank-issues')
    // Give her a face and a room, using Ryder's art as stand-ins.
    await page.getByRole('tab', { name: 'Art & Sound' }).click()
    const img = (f: string) => join(root, 'content/ryder/images', f)
    await page.locator('.asset.add input').nth(0).setInputFiles([
      { name: 'neutral.png', mimeType: 'image/png', buffer: await import('node:fs').then((fs) => fs.readFileSync(img('smile.png'))) },
    ])
    await page.locator('.asset.add input').nth(1).setInputFiles(img('bg_room_night.png'))
    await page.locator('.asset img').nth(1).waitFor()
    await page.getByRole('tab', { name: 'Profile' }).click()
    await page.locator('.sfield', { hasText: 'Default background' }).locator('select').selectOption('room_night')
    await page.waitForTimeout(300)
    await shot(page, 'studio-blank-fixed')
    await page.getByRole('button', { name: 'Try it' }).click()
    await page.locator('.studio-notice').waitFor()
    await shot(page, 'studio-tried')
    await page.goto(`${base}#/setup`)
    await page.locator('.cutie-card', { hasText: 'Mira' }).waitFor()
    await shot(page, 'setup-with-mira')
    await ctx.close()
  },
}

const server = await createServer({ root, server: { port: 5199, host: '127.0.0.1', strictPort: true }, logLevel: 'error' })
await server.listen()
const base = 'http://127.0.0.1:5199/'
const browser = await chromium.launch()
try {
  for (const [name, run] of Object.entries(scenarios)) {
    if (filter && !name.includes(filter)) continue
    console.log(name)
    await run(browser, base)
  }
} finally {
  await browser.close()
  await server.close()
}
