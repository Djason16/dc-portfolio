import { setDefaultResultOrder } from 'node:dns'
import { DatabaseHelper } from '../utils/DatabaseHelper'
import { BUILT_IN_CATALOG, checkCatalog, type ToolsCatalog } from '~/utils/toolsCatalog'

/*
 * The DC tools shown on the home page (« Mes outils »), from https://tools.djason-chery.dev/tools.json, so that a new
 * tool appears without building this site again (ToolsController: GET /api/tools).
 *   await ToolsCatalogHelper.get()   the list: kept one hour in memory; then fetched again, the old one served meanwhile
 * Safety: the address is a constant (TOOLS_CATALOG_URL only outside production, for tests), never taken from a request;
 * one fetch at a time; 8 s at most, 64 KB at most, JSON only, no redirection; the content is checked (utils/toolsCatalog.ts).
 * IPv4 first: the sales site (Cloudflare) also answers in IPv6, and a hosting without a working IPv6 route would wait until
 * the time limit. The reason of the last failure is kept (lastError) and shown by the sync report in the admin.
 * A failure keeps the last good list (memory, then dc_settings « toolsCatalog », checked again when read), else the
 * built-in list: the home page always shows its tools.
 */
const PRODUCTION_URL = 'https://tools.djason-chery.dev/tools.json'
const MAX_AGE = 60 * 60 * 1000
const TIMEOUT = 8000
// After a failure, tried again 10 minutes later (not an hour): a short outage of the sales site is soon forgotten
const RETRY_AFTER = 10 * 60 * 1000
const MAX_BYTES = 64 * 1024
const SETTING = 'toolsCatalog'

setDefaultResultOrder('ipv4first')

// Why the last fetch failed ('' when it worked)
let lastError = ''
const fail = (reason: string): null => {
    lastError = reason
    console.warn('[tools] catalog not read:', reason)
    return null
}

const sourceUrl = () => process.env.NODE_ENV !== 'production' && process.env.TOOLS_CATALOG_URL ? process.env.TOOLS_CATALOG_URL : PRODUCTION_URL

/** The checked list of the address, or null (failure, too big, not JSON, invalid): never throws. */
export const fetchCatalog = async (url: string, timeout = TIMEOUT): Promise<ToolsCatalog | null> => {
    try {
        const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeout), headers: { accept: 'application/json' } })
        if (!res.ok) return fail(`HTTP ${res.status}`)
        if (!/^application\/json\b/i.test(res.headers.get('content-type') ?? '')) return fail(`type ${res.headers.get('content-type') ?? 'absent'}`)
        if (!res.body) return fail('réponse vide')
        if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return fail('fichier trop gros')
        // Read piece by piece: stopped as soon as it is bigger than allowed
        const reader = res.body.getReader()
        const parts: Uint8Array[] = []
        let size = 0
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > MAX_BYTES) {
                await reader.cancel()
                return fail('fichier trop gros')
            }
            parts.push(value)
        }
        const catalog = checkCatalog(JSON.parse(Buffer.concat(parts).toString('utf8')))
        if (!catalog) return fail('contenu refusé par la vérification')
        lastError = ''
        return catalog
    } catch (error) {
        const e = error as Error & { cause?: { code?: string, message?: string } }
        return fail(e.name === 'TimeoutError' ? 'délai dépassé (8 s)' : [e.message, e.cause?.code ?? e.cause?.message].filter(Boolean).join(' : '))
    }
}

const readStored = async () => {
    try {
        const row = await DatabaseHelper.fetchOne('SELECT value FROM dc_settings WHERE `key` = ?', [SETTING])
        return row?.value ? checkCatalog(JSON.parse(String(row.value))) : null
    } catch {
        return null
    }
}

const store = async (catalog: ToolsCatalog) => {
    try {
        await DatabaseHelper.execute('INSERT INTO dc_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [SETTING, JSON.stringify(catalog)])
    } catch (error) {
        console.warn('[tools] catalog not stored:', (error as Error).message)
    }
}

// built: the built-in list (nothing read yet): never used to put tools on sale (ToolsSyncHelper.ts)
let memory: { catalog: ToolsCatalog, at: number, built: boolean } | null = null
let pending: Promise<ToolsCatalog> | null = null

// One fetch at a time for the whole server; a failure keeps what was there (and waits an hour before trying again)
const refresh = () => pending ??= (async () => {
    const fresh = await fetchCatalog(sourceUrl())
    if (fresh) await store(fresh)
    const kept = fresh ?? (memory && !memory.built ? memory.catalog : null) ?? (await readStored())
    memory = { catalog: kept ?? BUILT_IN_CATALOG, at: Date.now(), built: !kept }
    return memory.catalog
})().finally(() => { pending = null })

export const ToolsCatalogHelper = {
    async get(): Promise<ToolsCatalog> {
        if (memory && Date.now() - memory.at < (memory.built ? RETRY_AFTER : MAX_AGE)) return memory.catalog
        // Old list in memory: served at once, the new one fetched behind
        if (memory) {
            refresh()
            return memory.catalog
        }
        return refresh()
    },

    /** The list read from the sales site (now or before), never the built-in one: null when there is none (the sync waits). */
    async read(): Promise<ToolsCatalog | null> {
        const catalog = await ToolsCatalogHelper.get()
        return memory?.built ? null : catalog
    },

    /** Why the last fetch failed, '' when it worked. */
    lastError: () => lastError,

    // Tests only (scripts/tools-catalog-test.mjs): forget the list in memory, or make it one hour old
    reset() {
        memory = null
    },
    expire() {
        if (memory) memory.at = 0
    },
}
