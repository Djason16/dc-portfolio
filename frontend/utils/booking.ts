/*
 * Dates of the booking page (components/views/Book), in the zone of the visitor (the one of his browser):
 * the API gives the free starts in UTC, the page groups them by day and shows their hours on his clock.
 */

// A kind of appointment as sent by GET /api/booking-types
export type BookingKind = { id: string, nameFr: string, nameEn: string, descriptionFr: string, descriptionEn: string, duration: number,
    mode: 'phone' | 'video' | 'meeting', location: string, active?: boolean, sortOrder?: number }

// A day of the month grid: 'YYYY-MM-DD', its number, false for the days of the months around
export type GridDay = { key: string, day: number, inMonth: boolean }

// Zone of the visitor ("Europe/Paris"); UTC when the browser does not tell it
export const visitorZone = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

const tagOf = (locale: string) => (locale === 'en' ? 'en-GB' : 'fr-FR')

// 'YYYY-MM-DD' of a moment on the clock of a zone
export const dayKeyOf = (iso: string | number, zone: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))

// '10:30' on the clock of a zone
export const timeOf = (iso: string | number, locale: string, zone: string) =>
    new Intl.DateTimeFormat(tagOf(locale), { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso))

// 'jeudi 20 novembre' of a 'YYYY-MM-DD' (noon in UTC: the same day in every zone)
export const longDay = (key: string, locale: string, year = false) =>
    new Intl.DateTimeFormat(tagOf(locale), { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', ...(year ? { year: 'numeric' } : {}) })
        .format(new Date(`${key}T12:00:00Z`))

// 'novembre 2026' of a month (month from 0)
export const monthTitle = (year: number, month: number, locale: string) =>
    new Intl.DateTimeFormat(tagOf(locale), { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month, 15)))

// Short names of the days, Monday first ('lun.', 'Mon'), and their full names for screen readers
export const weekDays = (locale: string) => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 1 + i, 12))
    return {
        short: new Intl.DateTimeFormat(tagOf(locale), { timeZone: 'UTC', weekday: 'short' }).format(date),
        long: new Intl.DateTimeFormat(tagOf(locale), { timeZone: 'UTC', weekday: 'long' }).format(date),
    }
})

const pad = (n: number) => String(n).padStart(2, '0')

// The weeks of a month, Monday to Sunday, with the days of the months around to fill the first and last weeks
export const monthGrid = (year: number, month: number): GridDay[] => {
    const first = new Date(Date.UTC(year, month, 1))
    const lead = (first.getUTCDay() + 6) % 7
    const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
    const cells = Math.ceil((lead + length) / 7) * 7
    return Array.from({ length: cells }, (_, i) => {
        const date = new Date(Date.UTC(year, month, 1 - lead + i))
        return { key: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`, day: date.getUTCDate(), inMonth: date.getUTCMonth() === month }
    })
}

// First and last moments of a month on the clock of the browser (the visitor's), as ISO texts for the API
export const monthRange = (year: number, month: number) => ({
    from: new Date(year, month, 1).toISOString(),
    to: new Date(year, month + 1, 1).toISOString(),
})

// Name of a kind in the language of the page
export const kindName = (kind: Pick<BookingKind, 'nameFr' | 'nameEn'>, locale: string) => (locale === 'en' ? kind.nameEn || kind.nameFr : kind.nameFr || kind.nameEn)
export const kindDescription = (kind: Pick<BookingKind, 'descriptionFr' | 'descriptionEn'>, locale: string) =>
    (locale === 'en' ? kind.descriptionEn || kind.descriptionFr : kind.descriptionFr || kind.descriptionEn) || ''

// Translation key of a mode, and its Font Awesome icon (written in full: scripts/icons.mjs finds them here)
export const MODE_KEYS: Record<string, string> = { phone: 'bookModePhone', video: 'bookModeVideo', meeting: 'bookModeMeeting' }
export const MODE_ICONS: Record<string, string> = { phone: 'fas fa-phone', video: 'fas fa-video', meeting: 'fas fa-handshake' }
