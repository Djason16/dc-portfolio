// Similarity test of the city pages: builds the page of every city of the database (as if all were published, with the
// shared questions of dc_city_faqs) with the same code as the site (utils/cities/), measures every pair (shingles of
// 5 words, Jaccard) and fails when a pair reaches 50 % or more (Google could see them as near-duplicate pages).
//   npm run test:cities                        the local database (.env)
// Prints the highest, the median and the lowest similarity, then the 5 closest pairs. Reads only, changes nothing.
import fs from 'node:fs'
import mysql from 'mysql2/promise'
import { createJiti } from 'jiti'

const envFile = '.env'
if (fs.existsSync(envFile)) process.loadEnvFile(envFile)
const { DB_HOST = 'localhost', DB_PORT = '3306', DB_USER, DB_PASS, DB_NAME } = process.env
if (!DB_USER || !DB_NAME) { console.error(`DB_USER and DB_NAME are missing in ${envFile}`); process.exit(1) }

// The TypeScript files of the site, loaded as they are
const jiti = createJiti(import.meta.url)
const { toCity, toFaqTemplate, nearbyOf } = await jiti.import('../utils/cities/cityRows.ts')
const { pairSimilarities, SIMILARITY_LIMIT } = await jiti.import('../utils/cities/citySimilarity.ts')

const db = await mysql.createConnection({ host: DB_HOST, port: Number(DB_PORT), user: DB_USER, password: DB_PASS, database: DB_NAME })
const [cityRows] = await db.query('SELECT * FROM dc_cities ORDER BY sort_order, name')
const [faqRows] = await db.query('SELECT * FROM dc_city_faqs ORDER BY sort_order, created_at')
const [[owner]] = await db.query("SELECT value FROM dc_settings WHERE `key` = 'name'")
await db.end()

const cities = cityRows.map(row => ({ ...toCity(row), published: true }))
const faqs = faqRows.map(toFaqTemplate)
if (cities.length < 2) { console.log(`${cities.length} city: nothing to compare (add cities in admin > Villes)`); process.exit(0) }

const pairs = pairSimilarities(cities, city => ({ nearby: nearbyOf(city, cities), faqs, projects: [] }), owner?.value ?? '')
const values = pairs.map(pair => pair.percent).sort((a, b) => a - b)
const median = values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2
console.log(`${cities.length} cities, ${pairs.length} pairs: highest ${values.at(-1)} %, median ${Math.round(median * 10) / 10} %, lowest ${values[0]} %`)
for (const pair of pairs.slice(0, 5)) console.log(`  ${pair.percent} %  ${pair.a} / ${pair.b}`)

const tooClose = pairs.filter(pair => pair.percent >= SIMILARITY_LIMIT)
if (tooClose.length) {
    console.error(`✖ ${tooClose.length} pair(s) at ${SIMILARITY_LIMIT} % or more`)
    process.exit(1)
}
console.log(`✔ every pair under ${SIMILARITY_LIMIT} %`)
