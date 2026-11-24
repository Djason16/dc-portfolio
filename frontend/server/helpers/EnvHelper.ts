import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/*
 * Environment files (DC Scaffold convention: https://tools.djason-chery.dev/en/scaffold/): .env in development, .env.production in production.
 *
 * Plain Node.js module (no Nitro auto-import): nuxt.config.ts imports it too.
 */

// Keys accepted by the admin editor: letters, digits and underscores only
const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/
// Values never sent to the browser (passwords, keys, tokens, bank details, security answer): only •••• and their last 4 characters
const SECRET_WORDS = ['SECRET', 'PASS', 'KEY', 'TOKEN', 'CREDENTIAL', 'IBAN', 'BIC', 'ANSWER']
const isSecret = (key: string) => SECRET_WORDS.some(word => key.includes(word))
// Last 4 characters only for a long value (a short password would be half given away)
const mask = (value: string) => value ? `••••${value.length >= 12 ? value.slice(-4) : ''}` : ''
// The only platform the e-invoices may go to (its credentials go with each call): anything else is refused by the editor
const SUPERPDP_URL = 'https://api.superpdp.tech'

/** Absolute path of the .env file of the current mode. */
export const envFilePath = (mode = process.env.NODE_ENV, cwd = process.cwd()) =>
    resolve(cwd, mode === 'production' ? '.env.production' : '.env')

// KEY=value -> [key, value] without the surrounding quotes, null for comments and blank lines
const parseLine = (line: string): [string, string] | null => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return null

    const [key, ...rest] = trimmed.split('=')
    let value = rest.join('=').trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    return key?.trim() ? [key.trim(), value] : null
}

// Value written back to the file: one line, quoted when it contains spaces
const formatValue = (value: unknown) => {
    const text = String(value ?? '').replace(/[\r\n]+/g, ' ')
    return text.includes(' ') ? `"${text}"` : text
}

export const EnvHelper = {
    /** Every KEY=value of the current .env file. */
    async read() {
        const content = await readFile(envFilePath(), 'utf-8')
        return Object.fromEntries(content.split('\n').map(parseLine).filter((entry): entry is [string, string] => entry !== null))
    },

    isSecret,

    /** Every KEY=value for the admin editor: secret values masked; masked = names of the masked keys. */
    async readMasked() {
        const env = await EnvHelper.read()
        const masked = Object.keys(env).filter(isSecret)
        for (const key of masked) env[key] = mask(env[key] ?? '')
        return { env, masked }
    },

    /** Real changes sent by the editor: without a value equal to the current one, nor a secret sent back masked. */
    async changesOnly(updates: Record<string, unknown>) {
        const env = await EnvHelper.read()
        return Object.fromEntries(Object.entries(updates).filter(([key, value]) => {
            const text = String(value ?? '')
            return !(key in env && (text === env[key] || (isSecret(key) && text === mask(env[key] ?? ''))))
        }))
    },

    /** Error code (translated by the admin) of a value the editor refuses (e-invoice platform elsewhere than Super PDP, mock flag other than true/false). */
    invalidValue(updates: Record<string, unknown>) {
        if ('SUPERPDP_API_URL' in updates && !['', SUPERPDP_URL].includes(String(updates.SUPERPDP_API_URL ?? '').trim().replace(/\/+$/, '')))
            return 'envSuperPdpUrl'
        if ('SUPERPDP_MOCK' in updates && !['', 'true', 'false'].includes(String(updates.SUPERPDP_MOCK ?? '').trim()))
            return 'envSuperPdpMock'
        return null
    },

    /** Names of the keys the editor refuses (anything but A-Z, 0-9 and _). */
    invalidKeys: (updates: Record<string, unknown>) => Object.keys(updates).filter(key => !KEY_PATTERN.test(key)),

    /** Updates (or adds) keys, keeping comments, blank lines and the order of the file. */
    async write(updates: Record<string, unknown>) {
        const path = envFilePath()
        const lines = (await readFile(path, 'utf-8')).split('\n')
        const pending = new Map(Object.entries(updates))

        const updated = lines.map(line => {
            const entry = parseLine(line)
            if (!entry || !pending.has(entry[0])) return line
            const value = pending.get(entry[0])
            pending.delete(entry[0])
            // Same line end as before (a .env saved on Windows keeps its CRLF)
            return `${entry[0]}=${formatValue(value)}${line.endsWith('\r') ? '\r' : ''}`
        })

        const cr = lines[0]?.endsWith('\r') ? '\r' : ''
        for (const [key, value] of pending) updated.push(`${key}=${formatValue(value)}${cr}`)
        await writeFile(path, updated.join('\n'), 'utf-8')
    },
}
