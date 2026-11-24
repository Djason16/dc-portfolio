// Archivo of the titles reduced to what the pages use: writes assets/fonts/archivo/ (fonts declared in
// assets/css/base/fonts.css). The site shows Archivo only in its expanded width (125 %) and semi bold (600): the variable
// font of @fontsource (every width and weight, 90 KB for the latin letters) becomes one fixed font of about 12 KB, so the
// first page gets its letters sooner (Lighthouse). Same letters as @fontsource (latin, latin-ext); the full variable font
// stays declared for any other width or weight (only downloaded if one is ever used).
// Run by npm before dev and build; by hand: node scripts/fonts.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import subsetFont from 'subset-font'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = join(root, 'node_modules', '@fontsource-variable', 'archivo', 'files')
const target = join(root, 'assets', 'fonts', 'archivo')
mkdirSync(target, { recursive: true })

// Every letter of a list of code points and ranges ("0020-00FF", "0131")
const lettersOf = (ranges) => ranges.split(',').map((part) => part.trim().replace(/^U\+/i, '')).flatMap((part) => {
    const [start, end = start] = part.split('-').map((hex) => parseInt(hex, 16))
    return Array.from({ length: end - start + 1 }, (_, i) => String.fromCodePoint(start + i))
}).join('')

// The unicode-range of each part (the same as @fontsource-variable/archivo/wdth.css and assets/css/base/fonts.css)
const PARTS = {
    latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
}

for (const [part, ranges] of Object.entries(PARTS)) {
    const font = readFileSync(join(source, `archivo-${part}-wdth-normal.woff2`))
    const fixed = await subsetFont(font, lettersOf(ranges), { targetFormat: 'woff2', variationAxes: { wdth: 125, wght: 600 } })
    writeFileSync(join(target, `archivo-expanded-600-${part}.woff2`), fixed)
    console.log(`archivo-expanded-600-${part}.woff2: ${Math.round(font.length / 1024)} KB -> ${Math.round(fixed.length / 1024)} KB`)
}
