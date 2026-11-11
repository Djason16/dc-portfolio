import { DatabaseHelper } from '../utils/DatabaseHelper'

/*
 * Free slots of the booking page, worked out from what the admin already sets elsewhere:
 *   the week (admin > Calendar: dc_calendar_settings, hours in the owner's zone), minus the holidays (dc_unavailability),
 *   minus everything while the manual status is busy or unavailable (dc_availability_override),
 *   minus the bookings already made (with a free time around each one), never too soon (notice) nor too far (horizon).
 *
 *   const slots = await BookingHelper.freeSlots(type, from, to)   ['2026-11-20T09:00:00.000Z', ...]
 *   await BookingHelper.exclusive(async () => { ...check the slot again, then insert... })
 */
export type BookingSettings = { id: string, enabled: boolean, noticeHours: number, horizonDays: number, bufferMinutes: number, stepMinutes: number }
export type BookingType = { id: string, nameFr: string, nameEn: string, descriptionFr: string, descriptionEn: string, duration: number, mode: string, location: string, active: boolean, sortOrder: number }

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

// Database row -> JSON sent to the site (camelCase)
const toBookingSettings = (row: Record<string, any> | null): BookingSettings => ({
    id: row?.id ?? '',
    enabled: Boolean(row?.enabled ?? 1),
    noticeHours: Number(row?.notice_hours ?? 12),
    horizonDays: Number(row?.horizon_days ?? 60),
    bufferMinutes: Number(row?.buffer_minutes ?? 15),
    stepMinutes: Math.max(5, Number(row?.step_minutes ?? 30)),
})
const toBookingType = (row: Record<string, any>): BookingType => ({
    id: row.id, nameFr: row.name_fr, nameEn: row.name_en, descriptionFr: row.description_fr ?? '', descriptionEn: row.description_en ?? '',
    duration: Number(row.duration), mode: row.mode, location: row.location ?? '', active: Boolean(row.active), sortOrder: Number(row.sort_order),
})

// UTC moment <-> the 'YYYY-MM-DD HH:MM:SS' text stored in the database (in UTC, whatever the zone of MySQL)
const toSqlUtc = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
const fromSqlUtc = (text: string) => Date.parse(`${String(text).replace(' ', 'T')}Z`)

// A name of zone the browser and the server both know (Europe/Paris...), else null
const validZone = (zone: unknown) => {
    if (typeof zone !== 'string' || !zone || zone.length > 64) return null
    try { new Intl.DateTimeFormat('en', { timeZone: zone }); return zone } catch { return null }
}

// Gap between a zone and UTC at a moment, in ms (Paris in winter: +1 h); the Intl parts avoid any date library
const offsetOf = (ms: number, zone: string) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(ms).map(p => [p.type, p.value]))
    return Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!) - Math.floor(ms / 1000) * 1000
}

// The moment of a time on the clock of a zone: '2026-11-20' + '09:00' in Europe/Paris -> 08:00 UTC (summer time included)
const zonedToUtc = (date: string, time: string, zone: string) => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number]
    const [h, min] = time.split(':').map(Number) as [number, number]
    const wall = Date.UTC(y, m - 1, d, h, min)
    const first = wall - offsetOf(wall, zone)
    // Checked once more: the change of hour can fall between the guess and the result
    return wall - offsetOf(first, zone)
}

// 'YYYY-MM-DD' of a moment on the clock of a zone
const dateIn = (ms: number, zone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms)

// The next day of a 'YYYY-MM-DD' (noon in UTC: never caught by a change of hour)
const nextDate = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) + DAY).toISOString().slice(0, 10)

// 'HH:MM' -> minutes since midnight
const minutesOf = (time: unknown) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''))
    return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

// One process serves the site: a promise chain is enough to keep two bookings of the same slot from crossing
let queue: Promise<unknown> = Promise.resolve()

export const BookingHelper = {
    toBookingSettings, toBookingType, toSqlUtc, fromSqlUtc, validZone, zonedToUtc, dateIn,

    async settings() {
        return toBookingSettings(await DatabaseHelper.fetchOne('SELECT * FROM dc_booking_settings LIMIT 1'))
    },

    /** Free starts (ISO, UTC) of a kind lasting "duration" minutes between two moments, inside the notice and the horizon. */
    async freeSlots(duration: number, fromMs: number, toMs: number, settings?: BookingSettings) {
        const rules = settings ?? await BookingHelper.settings()
        const now = Date.now()
        const start = Math.max(fromMs, now + rules.noticeHours * 60 * MINUTE)
        const end = Math.min(toMs, now + rules.horizonDays * DAY)
        if (!rules.enabled || !(duration > 0) || start >= end) return []

        // The manual status of the admin wins: busy or unavailable, nothing can be booked while it is on
        const override = await DatabaseHelper.fetchOne('SELECT enabled, status FROM dc_availability_override LIMIT 1')
        if (override?.enabled && override.status !== 'available') return []

        const calendar = await DatabaseHelper.fetchOne('SELECT timezone, schedule FROM dc_calendar_settings LIMIT 1')
        if (!calendar) return []
        const zone = validZone(calendar.timezone) ?? 'Europe/Paris'
        const schedule: Record<string, { start?: string, end?: string }> = JSON.parse(calendar.schedule || '{}')

        const firstDay = dateIn(start, zone), lastDay = dateIn(end, zone)
        const holidays = await DatabaseHelper.fetchAll('SELECT start_date, end_date FROM dc_unavailability WHERE end_date >= ? AND start_date <= ?', [firstDay, lastDay])
        const isHoliday = (day: string) => holidays.some(p => String(p.start_date).slice(0, 10) <= day && String(p.end_date).slice(0, 10) >= day)

        // Bookings around the range, each one widened by the free time kept before and after it
        const buffer = rules.bufferMinutes * MINUTE
        const taken = (await DatabaseHelper.fetchAll("SELECT start_at, end_at FROM dc_bookings WHERE status = 'booked' AND end_at > ? AND start_at < ?",
            [toSqlUtc(start - DAY), toSqlUtc(end + DAY)])).map(b => [fromSqlUtc(b.start_at) - buffer, fromSqlUtc(b.end_at) + buffer] as const)

        const slots: string[] = []
        const length = duration * MINUTE, step = rules.stepMinutes * MINUTE
        for (let day = firstDay; day <= lastDay; day = nextDate(day)) {
            const hours = schedule[String(new Date(`${day}T12:00:00Z`).getUTCDay())]
            const open = minutesOf(hours?.start), close = minutesOf(hours?.end)
            if (open === null || close === null || close <= open || isHoliday(day)) continue
            const dayEnd = zonedToUtc(day, hours!.end!, zone)
            for (let at = zonedToUtc(day, hours!.start!, zone); at + length <= dayEnd; at += step) {
                if (at < start || at >= end) continue
                if (taken.some(([from, to]) => at < to && at + length > from)) continue
                slots.push(new Date(at).toISOString())
            }
        }
        return slots
    },

    /** Runs a task alone: the next one waits until it is over (check a slot, then book it). */
    exclusive<T>(task: () => Promise<T>): Promise<T> {
        const run = queue.then(task, task)
        queue = run.catch(() => undefined)
        return run
    },

    /** Secret of a cancel link: 32 random hexadecimal figures (128 bits, never guessed). */
    token: () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''),
}
