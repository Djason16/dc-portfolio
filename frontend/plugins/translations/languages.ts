/*
 * Languages of the site, the first one is the default.
 * One language = no language buttons. Two or more = buttons at the bottom right of the page.
 * Kept apart from the texts (translations.ts): the browser gets this small file with the page, the texts later
 * (plugins/lang.ts)
 */
export const LANGUAGES: string[] = ['fr', 'en']

// A text with its {{values}} filled in
export const fillText = (text: string, values: Record<string, string | number> = {}): string =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match: string, name: string) => String(values[name] ?? match))
