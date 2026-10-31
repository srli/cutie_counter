/**
 * One-off: build app icons from the menu logo into public/icons/.
 * Run: npx tsx scripts/make-icons.ts
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const root = join(import.meta.dirname, '..')
const out = join(root, 'public/icons')
mkdirSync(out, { recursive: true })

const bg = (size: number) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
     <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="#f8e9f6"/><stop offset="0.5" stop-color="#ece3f8"/><stop offset="1" stop-color="#dce9f5"/>
     </linearGradient></defs>
     <rect width="100%" height="100%" fill="url(#g)"/>
   </svg>`,
)

async function icon(size: number, name: string, logoShare: number) {
  const logo = await sharp(join(root, 'public/ui/menuscreenlogo.png')).resize({ width: Math.round(size * logoShare) }).toBuffer()
  await sharp(bg(size)).composite([{ input: logo, gravity: 'center' }]).png().toFile(join(out, name))
  console.log(`  ✓ ${name}`)
}

await icon(512, 'icon-512.png', 0.86)
await icon(192, 'icon-192.png', 0.86)
await icon(512, 'maskable-512.png', 0.66) // stays inside the maskable safe zone
await icon(180, 'apple-touch-icon.png', 0.86)
await icon(64, 'favicon.png', 0.95)
