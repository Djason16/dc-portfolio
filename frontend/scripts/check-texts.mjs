// Check of the texts shown by the site: every text of plugins/translations (FR and EN) and every text written in the
// templates of the components (text, title, placeholder, aria-label, label, alt) starts with a capital letter, like a
// sentence, a label, a button or a title. A text that starts with a value ({{name}}, a number, « …) is fine.
// Pieces of sentences put inside another text (« mois », « les Conditions Générales de Vente »…) are listed below.
//   npm run check:texts      fails (exit 1) on a text starting with a small letter that is not in the list
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createJiti } from 'jiti'

// Keys of pieces of sentences (they continue another text, after a comma, a colon or a « · »)
const FRAGMENT_KEYS = new Set([
    'during', 'month', 'months', 'toolsSyncMonth',
    'latePaymentPenaltyPro', 'latePaymentInterest', 'termsOfSale', 'privacyPolicy', 'contractRefundPolicy',
    'bookNoFree', 'adminAutoLast', 'autopayRefused', 'flowReasonSteps', 'flowReasonAmount',
    'einvEnv_sandbox', 'einvEnv_production', 'cityTravelEstimate', 'citySourceDate',
    // A brand written in small letters
    'o2switch',
])
// Texts written in the templates that are not sentences (units)
const FRAGMENT_TEXTS = new Set(['h, j, u'])

// The first letter that counts: after spaces and punctuation; null when the text starts with a value or a figure
const firstLetter = (text) => {
    const trimmed = String(text).trim()
    if (/^(\{\{|\d|[+«"'(\[<])/.test(trimmed)) return null
    return trimmed.replace(/^[\s•·\-–—…*#.,:%€$/]+/u, '').charAt(0)
}
const isSmall = (letter) => Boolean(letter) && /\p{Ll}/u.test(letter)

const problems = []

// 1. Translations
const jiti = createJiti(import.meta.url)
const { TRANSLATIONS } = await jiti.import('../plugins/translations/translations.ts')
for (const file of TRANSLATIONS)
    for (const lang of ['fr', 'en'])
        for (const [key, value] of Object.entries(file[lang] ?? {}))
            if (!FRAGMENT_KEYS.has(key) && isSmall(firstLetter(value))) problems.push(`translation ${lang} ${key}: ${String(value).slice(0, 80)}`)

// 2. Texts written in the templates of the components
const walk = (dir) => readdirSync(dir).flatMap((name) => statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)])
const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const vueFiles = ['components', 'pages', 'layouts'].flatMap((dir) => walk(join(root, dir))).filter((file) => file.endsWith('.vue'))
    .concat(['app.vue', 'error.vue'].map((file) => join(root, file)))
for (const file of vueFiles) {
    const template = /<template>([\s\S]*)<\/template>/.exec(readFileSync(file, 'utf8'))?.[1]?.replace(/<!--[\s\S]*?-->/g, '') ?? ''
    const texts = [...template.matchAll(/>([^<>{}]+)</g)].map((match) => match[1].trim()).filter((text) => /\p{L}{3}/u.test(text))
    const attributes = [...template.matchAll(/\s(?:title|placeholder|aria-label|label|alt)="([^"]+)"/g)].map((match) => match[1])
    for (const text of [...texts, ...attributes])
        if (!FRAGMENT_TEXTS.has(text) && isSmall(firstLetter(text))) problems.push(`template ${file.slice(root.length)}: ${text.slice(0, 80)}`)
}

if (problems.length) {
    console.error(`✖ ${problems.length} text(s) starting with a small letter:\n${problems.map((line) => `  ${line}`).join('\n')}`)
    process.exit(1)
}
console.log('✔ every text starts with a capital letter (or a value)')
