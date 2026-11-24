// Test of the list of the DC tools of the home page (utils/toolsCatalog.ts, server/helpers/ToolsCatalogHelper.ts) against a
// local server: valid list, XSS text, bad links and colours, too big, too slow, not JSON, redirection.
//   npm run test:tools        (no database needed: storing the copy is skipped when the database cannot be reached)
import http from 'node:http'
import { createJiti } from 'jiti'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const jiti = createJiti(import.meta.url, { alias: { '~': root.replace(/[\/]$/, '') } })
const { checkCatalog, BUILT_IN_CATALOG } = await jiti.import('../utils/toolsCatalog.ts')

const tool = (id, extra = {}) => ({ id, name: `DC ${id}`, title: id, accent: '#a78bfa', version: '1.0.0',
    text: { fr: `Texte ${id}`, en: `Text ${id}` }, url: { fr: `https://tools.djason-chery.dev/fr/${id}/`, en: `https://tools.djason-chery.dev/en/${id}/` }, ...extra })
const four = { schema: 1, tools: ['scaffold', 'prospect', 'sentinel', 'audit'].map(id => tool(id)) }

// Local server: one answer per path
const ROUTES = {
    '/valid': () => [200, 'application/json', JSON.stringify(four)],
    '/invalid': () => [200, 'application/json', '{ not json'],
    '/html': () => [200, 'text/html', JSON.stringify(four)],
    '/big': () => [200, 'application/json', JSON.stringify({ ...four, pad: 'x'.repeat(70 * 1024) })],
    '/redirect': () => [302, 'text/plain', '', { location: 'https://example.com/tools.json' }],
}
const server = http.createServer((req, res) => {
    if (req.url === '/slow') return setTimeout(() => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(four)) }, 5000)
    const [status, type, body, headers = {}] = (ROUTES[req.url] ?? (() => [404, 'text/plain', '']))()
    res.writeHead(status, { 'content-type': type, ...headers })
    res.end(body)
})
await new Promise(resolve => server.listen(0, resolve))
const base = `http://127.0.0.1:${server.address().port}`

let failures = 0
const check = (label, ok) => { console.log(`${ok ? '✔' : '✖'} ${label}`); if (!ok) failures++ }

// Validation of the content (utils/toolsCatalog.ts)
const xss = checkCatalog({ schema: 1, tools: [tool('scaffold', { text: { fr: '<img src=x onerror=alert(1)>', en: '<script>alert(1)</script>' } })] })
check('XSS payload kept as plain text (shown by Vue as text, never as HTML)', xss?.tools[0].text.fr === '<img src=x onerror=alert(1)>')
for (const url of ['javascript:alert(1)', 'http://tools.djason-chery.dev/fr/x/', 'https://evil.example/fr/x/', 'https://tools.djason-chery.dev.evil.com/x/',
    'https://user:pass@tools.djason-chery.dev/x/', 'https://tools.djason-chery.dev:8443/x/'])
    check(`link refused: ${url}`, checkCatalog({ schema: 1, tools: [tool('scaffold', { url: { fr: url, en: url } })] }) === null)
check('bad colour dropped, tool kept', checkCatalog({ schema: 1, tools: [tool('scaffold', { accent: 'red;background:url(x)' })] })?.tools[0].accent === null)
check('bad id refused', checkCatalog({ schema: 1, tools: [tool('Scaffold!')] }) === null)
check('too long text refused', checkCatalog({ schema: 1, tools: [tool('scaffold', { text: { fr: 'x'.repeat(221), en: 'y' } })] }) === null)
check('control characters removed', checkCatalog({ schema: 1, tools: [tool('scaffold', { name: 'DC\u0000 Sca\u202effold' })] })?.tools[0].name === 'DC Sca ffold')
check('wrong schema refused', checkCatalog({ ...four, schema: 2 }) === null)
check('prices within bounds kept', checkCatalog({ schema: 1, bundle: { month: 3500, year: 35000 }, tools: [tool('audit', { price: { month: 1200, year: 12000 } })] })?.tools[0].price?.month === 1200)
check('price out of bounds dropped (tool not put on sale)', checkCatalog({ schema: 1, tools: [tool('audit', { price: { month: 50, year: 12000 } })] })?.tools[0].price === null)
check('bundle price out of bounds dropped', checkCatalog({ schema: 1, bundle: { month: 3500, year: 9_999_999 }, tools: [tool('audit')] })?.bundle === null)
check('12 tools at most', checkCatalog({ schema: 1, tools: Array.from({ length: 20 }, (_, i) => tool(`tool-${i}`)) })?.tools.length === 12)

// Fetching (server/helpers/ToolsCatalogHelper.ts)
process.env.NODE_ENV = 'test'
const { fetchCatalog, ToolsCatalogHelper } = await jiti.import('../server/helpers/ToolsCatalogHelper.ts')
check('valid list read: 4 tools', (await fetchCatalog(`${base}/valid`))?.tools.length === 4)
check('invalid JSON → nothing', (await fetchCatalog(`${base}/invalid`)) === null)
check('not JSON (text/html) → nothing', (await fetchCatalog(`${base}/html`)) === null)
check('more than 64 KB → nothing', (await fetchCatalog(`${base}/big`)) === null)
check('redirection to another host → nothing', (await fetchCatalog(`${base}/redirect`)) === null)
check('slower than the time limit → nothing', (await fetchCatalog(`${base}/slow`, 3000)) === null)

// The list served: the last good one after a failure, else the built-in one
process.env.TOOLS_CATALOG_URL = `${base}/invalid`
ToolsCatalogHelper.reset()
check('nothing good yet → built-in list (3 tools)', (await ToolsCatalogHelper.get()).tools.length === BUILT_IN_CATALOG.tools.length)
process.env.TOOLS_CATALOG_URL = `${base}/valid`
ToolsCatalogHelper.reset()
check('valid → 4 tools', (await ToolsCatalogHelper.get()).tools.length === 4)
process.env.TOOLS_CATALOG_URL = `${base}/slow`
ToolsCatalogHelper.expire()
check('one hour later, the source too slow → the last good list at once (4 tools)', (await ToolsCatalogHelper.get()).tools.length === 4)
await new Promise(resolve => setTimeout(resolve, 3500))
check('…and still the last good list after the failed refresh', (await ToolsCatalogHelper.get()).tools.length === 4)

server.close()
console.log(failures ? `✖ ${failures} failure(s)` : '✔ every check passed')
process.exit(failures ? 1 : 0)
