/*
 * The DC tools of the « Mes outils » block of the home page, read from https://tools.djason-chery.dev/tools.json (written
 * by the sales site at each of its builds: only the tools with a published release) by server/helpers/ToolsCatalogHelper.ts.
 * The file is UNTRUSTED data: checkCatalog() keeps only what it can prove is safe, and the page shows it as plain text.
 *   id ^[a-z0-9-]{2,24}$ · name ≤ 40 · title ≤ 24 · texts ≤ 220 (control characters removed) · colour ^#rrggbb$ (else none)
 *   links: https, host exactly tools.djason-chery.dev, no user, password nor port (else the tool is left out) · 12 tools at most
 *   prices (cents, for the licence server): month 100 to 10 000, year 1 000 to 100 000, else none (the tool is not put on sale)
 * BUILT_IN_CATALOG: the list shown when nothing else is available (the three first tools).
 */
export const CATALOG_SCHEMA = 1
export const CATALOG_HOST = 'tools.djason-chery.dev'
const MAX_TOOLS = 12
const LIMITS = { name: 40, title: 24, text: 220, version: 20 }

export type CatalogLang = 'fr' | 'en'
export type CatalogPrice = { month: number, year: number }
export type CatalogTool = { id: string, name: string, title: string, accent: string | null, version: string, price: CatalogPrice | null,
    text: Record<CatalogLang, string>, url: Record<CatalogLang, string> }
export type ToolsCatalog = { site: Record<CatalogLang, string>, bundle: CatalogPrice | null, tools: CatalogTool[] }

const LANGS: CatalogLang[] = ['fr', 'en']
const ID = /^[a-z0-9-]{2,24}$/
const COLOUR = /^#[0-9a-fA-F]{6}$/
const VERSION = /^[0-9A-Za-z.+-]{1,20}$/
// Control characters, invisible ones and the ones that change the direction of the text
const CONTROL = new RegExp('[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]', 'g')

// A plain string of the right length, without control characters ('' when it is not one)
const plain = (value: unknown, max: number) => {
    if (typeof value !== 'string') return ''
    const text = value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim()
    return text.length <= max ? text : ''
}

/** A link of the sales site, or '' (https only, host exactly tools.djason-chery.dev, no user, password nor port). */
export const safeToolsUrl = (value: unknown) => {
    if (typeof value !== 'string' || value.length > 300) return ''
    try {
        const url = new URL(value)
        if (url.protocol !== 'https:' || url.hostname !== CATALOG_HOST || url.username || url.password || url.port) return ''
        return url.href
    } catch {
        return ''
    }
}

// A Pro price in euro cents within its bounds, else null
export const PRICE_BOUNDS = { month: [100, 10_000], year: [1_000, 100_000] } as const
export const checkPrice = (value: unknown): CatalogPrice | null => {
    if (!value || typeof value !== 'object') return null
    const { month, year } = value as Record<string, unknown>
    const ok = (amount: unknown, [min, max]: readonly [number, number]) => Number.isInteger(amount) && (amount as number) >= min && (amount as number) <= max
    return ok(month, PRICE_BOUNDS.month) && ok(year, PRICE_BOUNDS.year) ? { month: month as number, year: year as number } : null
}

const perLang = <T>(value: unknown, check: (text: unknown) => T) => {
    const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    return Object.fromEntries(LANGS.map(lang => [lang, check(source[lang])])) as Record<CatalogLang, T>
}

const checkTool = (raw: unknown): CatalogTool | null => {
    if (!raw || typeof raw !== 'object') return null
    const tool = raw as Record<string, unknown>
    const id = typeof tool.id === 'string' && ID.test(tool.id) ? tool.id : ''
    const name = plain(tool.name, LIMITS.name)
    const title = plain(tool.title, LIMITS.title)
    const text = perLang(tool.text, value => plain(value, LIMITS.text))
    const url = perLang(tool.url, safeToolsUrl)
    if (!id || !name || !title || LANGS.some(lang => !text[lang] || !url[lang])) return null
    return {
        id, name, title, text, url,
        accent: typeof tool.accent === 'string' && COLOUR.test(tool.accent) ? tool.accent : null,
        version: typeof tool.version === 'string' && VERSION.test(tool.version) ? tool.version : '',
        price: checkPrice(tool.price),
    }
}

/** The safe part of a tools.json (already parsed), or null when nothing usable is left (wrong schema, no valid tool). */
export const checkCatalog = (raw: unknown): ToolsCatalog | null => {
    if (!raw || typeof raw !== 'object') return null
    const data = raw as Record<string, unknown>
    if (data.schema !== CATALOG_SCHEMA || !Array.isArray(data.tools)) return null
    const tools: CatalogTool[] = []
    for (const entry of data.tools.slice(0, MAX_TOOLS)) {
        const tool = checkTool(entry)
        if (tool && !tools.some(other => other.id === tool.id)) tools.push(tool)
    }
    if (!tools.length) return null
    const site = perLang(data.site, safeToolsUrl)
    return { site: { fr: site.fr || BUILT_IN_CATALOG.site.fr, en: site.en || BUILT_IN_CATALOG.site.en }, bundle: checkPrice(data.bundle), tools }
}

const tool = (id: string, title: string, fr: string, en: string): CatalogTool => ({
    id, name: `DC ${title}`, title, accent: null, version: '', price: null, text: { fr, en },
    url: { fr: `https://${CATALOG_HOST}/fr/${id}/`, en: `https://${CATALOG_HOST}/en/${id}/` },
})

export const BUILT_IN_CATALOG: ToolsCatalog = {
    site: { fr: `https://${CATALOG_HOST}/fr/`, en: `https://${CATALOG_HOST}/en/` },
    bundle: null,
    tools: [
        tool('scaffold', 'Scaffold', 'Un site complet et prêt en quelques minutes : front, back end, SEO et sécurité de base inclus.',
            'A complete site ready in minutes: front end, back end, SEO and security basics included.'),
        tool('prospect', 'Prospect', 'La prospection par e-mail faite à votre place, pour les indépendants et petites entreprises en France.',
            'E-mail prospecting done for you, for freelancers and small businesses in France.'),
        tool('sentinel', 'Sentinel', 'Vos sites vérifiés toutes les heures et leurs bases sauvegardées chaque semaine, ordinateur éteint.',
            'Your sites checked every hour and their databases backed up every week, computer off.'),
    ],
}
