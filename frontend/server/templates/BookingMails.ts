/*
 * Emails of the booking page (server/controllers/BookingsController.ts), in the layout of the other emails (MailLayout):
 *   BookingMails.confirmation(booking, settings)        to the visitor, in his language: date and time in his zone, how it happens
 *                                                       (the link of the video room for a video call), the cancel link, an .ics file
 *   BookingMails.notice(booking, settings)              to the owner, in the first language of the site, with the same .ics
 *                                                       (and his own link of the video room, as a button)
 *   BookingMails.cancelled(booking, settings, byOwner)  to the visitor: his booking is cancelled (by himself or by the owner)
 *   BookingMails.cancelNotice(booking, settings)        to the owner: a visitor cancelled
 */
import type { Mail } from '../helpers/MailHelper'
import { BookingTexts } from './BookingTexts'

// A booking as read from dc_bookings, its moments as UTC ms
export type BookingMail = { id: string, typeName: string, mode: string, location: string, start: number, end: number, name: string, email: string,
    phone: string, message: string, language: string, timezone: string, cancelToken: string, roomToken?: string, hostToken?: string }

const OWNER_LANGUAGE = 'fr'

// Date and hours of a booking on the clock of a zone: "jeudi 20 novembre 2026", "jeu. 20 nov. 2026" (the large value of the email,
// short enough to never break inside a word), "10:00" and "10:30"
const when = (b: BookingMail, locale: string, zone: string) => {
    const tag = locale === 'en' ? 'en-GB' : 'fr-FR'
    const day = new Intl.DateTimeFormat(tag, { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(b.start)
    const short = new Intl.DateTimeFormat(tag, { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(b.start)
    const time = (ms: number) => new Intl.DateTimeFormat(tag, { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms)
    return { day, short, from: time(b.start), to: time(b.end), zone }
}
// The large value: the short date, the hours under it
const value = (at: ReturnType<typeof when>) => `${at.short}<br/>${at.from} - ${at.to}`

// Address of the site, with the page of the bookings
const siteUrl = () => String(useRuntimeConfig().public.frontendDomain || '').replace(/\/$/, '')
export const bookPageUrl = (token = '') => `${siteUrl()}/book/${token ? `?cancel=${token}` : ''}`
// Video room of the site (pages/room/[token].vue): the visitor's token or the owner's one
export const roomUrl = (token: string) => `${siteUrl()}/room/${token}/`
// The link as HTML (a token is only hexadecimal figures: nothing to escape)
const roomLink = (token: string) => `<a href="${roomUrl(token)}">${roomUrl(token)}</a>`

// Calendar file (RFC 5545): one event, its texts escaped, lines ended by CRLF
const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const icsDate = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const ics = (b: BookingMail, summary: string, description: string, location: string) => ({
    filename: 'invite.ics',
    contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
    content: ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//djason-chery.dev//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        `UID:${b.id}@djason-chery.dev`, `DTSTAMP:${icsDate(Date.now())}`, `DTSTART:${icsDate(b.start)}`, `DTEND:${icsDate(b.end)}`,
        `SUMMARY:${icsText(summary)}`, `DESCRIPTION:${icsText(description)}`, ...(location ? [`LOCATION:${icsText(location)}`] : []),
        'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'),
})

// Values typed by the visitor, made safe for HTML
const safe = (b: BookingMail): BookingMail => ({ ...b, typeName: MailHelper.escape(b.typeName), location: MailHelper.escape(b.location), name: MailHelper.escape(b.name),
    email: MailHelper.escape(b.email), phone: MailHelper.escape(b.phone), message: MailHelper.escape(b.message) })

// A short email of the layout of the site (MailLayout.body) with its plain text
const mail = (locale: string, settings: Record<string, any>, parts: { subject: string, title: string, label: string, value: string, text: string, plain: string,
    button?: { href: string, label: string } | null, siteNote?: string }): Mail => ({
    subject: parts.subject,
    text: parts.plain,
    html: MailLayout.body({ title: parts.title, label: parts.label, value: parts.value, instruction: parts.text, button: parts.button ?? null,
        regards: BookingTexts[locale === 'en' ? 'en' : 'fr'].regards, adminName: MailHelper.escape(settings.name || ''), siteNote: parts.siteNote ?? '', locale }),
})

const localeOf = (b: BookingMail) => (b.language === 'en' ? 'en' : 'fr')

export const BookingMails = {
    confirmation(booking: BookingMail, settings: Record<string, any>): Mail {
        const locale = localeOf(booking), t = BookingTexts[locale], b = safe(booking)
        const at = when(booking, locale, booking.timezone)
        const room = booking.roomToken || ''
        const how = t.how(b, settings.phone ? MailHelper.escape(settings.phone) : '', room ? roomLink(room) : '')
        const text = `${t.confirmText(b, at, MailHelper.escape(settings.name || ''))} ${how}`
        const plainHow = t.how(booking, settings.phone || '', room ? roomUrl(room) : '')
        // Where the calendar opens the appointment: the place, the fixed link of the kind, or the video room
        const place = booking.mode === 'meeting' || booking.mode === 'video' ? booking.location || (room ? roomUrl(room) : '') : ''
        return {
            ...mail(locale, settings, { subject: t.confirmSubject(booking.typeName, at.day), title: t.confirmTitle, label: b.typeName, value: value(at),
                text, plain: `${t.confirmText(booking, at, settings.name || '')} ${plainHow}\n${t.cancelLabel}: ${bookPageUrl(booking.cancelToken)}`,
                button: { href: bookPageUrl(booking.cancelToken), label: t.cancelLabel }, siteNote: t.confirmNote }),
            attachments: [ics(booking, `${booking.typeName} · ${settings.name || ''}`, plainHow, place)],
        }
    },

    notice(booking: BookingMail, settings: Record<string, any>, ownerZone: string): Mail {
        const t = BookingTexts[OWNER_LANGUAGE], b = safe(booking)
        const at = when(booking, OWNER_LANGUAGE, ownerZone)
        // The owner's own link of the video room (host): a button, and the place of his calendar event
        const host = booking.hostToken || ''
        const plain = `${t.noticeText(booking, at)}${host ? ` ${t.noticeRoom(roomUrl(host))}` : ''}`
        return {
            ...mail(OWNER_LANGUAGE, settings, { subject: t.noticeSubject(booking.name, at.day), title: t.noticeTitle, label: b.typeName, value: value(at),
                text: `${t.noticeText(b, at)}${host ? ` ${t.noticeRoom(roomLink(host))}` : ''}`, plain,
                button: host ? { href: roomUrl(host), label: t.joinRoom } : null }),
            replyTo: booking.email,
            attachments: [ics(booking, `${booking.typeName} · ${booking.name}`, plain, booking.location || (host ? roomUrl(host) : ''))],
        }
    },

    cancelled(booking: BookingMail, settings: Record<string, any>, byOwner: boolean): Mail {
        const locale = localeOf(booking), t = BookingTexts[locale], b = safe(booking)
        const at = when(booking, locale, booking.timezone)
        const text = byOwner ? t.cancelledByOwnerText(b, at, MailHelper.escape(settings.name || '')) : t.cancelledText(b, at)
        return mail(locale, settings, { subject: t.cancelledSubject(booking.typeName), title: t.cancelledTitle, label: b.typeName, value: value(at),
            text, plain: `${byOwner ? t.cancelledByOwnerText(booking, at, settings.name || '') : t.cancelledText(booking, at)}\n${bookPageUrl()}`,
            button: { href: bookPageUrl(), label: t.bookAgain } })
    },

    cancelNotice(booking: BookingMail, settings: Record<string, any>, ownerZone: string): Mail {
        const t = BookingTexts[OWNER_LANGUAGE], b = safe(booking)
        const at = when(booking, OWNER_LANGUAGE, ownerZone)
        return { ...mail(OWNER_LANGUAGE, settings, { subject: t.cancelNoticeSubject(booking.name, at.day), title: t.cancelNoticeTitle, label: b.typeName,
            value: value(at), text: t.cancelNoticeText(b, at), plain: t.cancelNoticeText(booking, at) }), replyTo: booking.email }
    },
}
