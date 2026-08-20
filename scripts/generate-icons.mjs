// Generuje caly zestaw ikon PWA/iOS z public/icon-master.svg.
// Odpal ponownie po zmianie logo: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const MASTER = join(ROOT, 'public/icon-master.svg')
const OUT = join(ROOT, 'public/icons')

// Standardowe rozmiary PWA + pelen zestaw ikon iOS (iPhone/iPad/iPad Pro) + favicon.
const SIZES = [16, 32, 120, 152, 167, 180, 192, 512]

await mkdir(OUT, { recursive: true })

for (const size of SIZES) {
  await sharp(MASTER, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(OUT, `icon-${size}.png`))
  console.log(`  icon-${size}.png`)
}

// Maskable 512 - ten sam projekt, znak miesci sie w bezpiecznej strefie 80%.
await sharp(MASTER, { density: 384 })
  .resize(512, 512)
  .png()
  .toFile(join(OUT, 'icon-512-maskable.png'))
console.log('  icon-512-maskable.png')

console.log(`\nGotowe: ${SIZES.length + 1} plikow w public/icons/`)
