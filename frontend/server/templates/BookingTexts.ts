/*
 * Texts of the booking emails (BookingMails.ts), one block per language of the site.
 * b: the booking (values already made safe for HTML when the text goes in the HTML), at: its day, hours and zone,
 * room: the link of the video room of the site (HTML or plain text, like b), empty when the kind has its own fixed link.
 */
type Booking = { typeName: string, mode: string, location: string, name: string, email: string, phone: string, message: string }
type At = { day: string, from: string, to: string, zone: string }

export const BookingTexts = {
    fr: {
        regards: 'Bien à vous',
        confirmSubject: (type: string, day: string) => `Réservation confirmée : ${type}, ${day}`,
        confirmTitle: 'Réservation confirmée',
        confirmText: (b: Booking, at: At, owner: string) => `Bonjour ${b.name}, votre créneau avec ${owner} est réservé le ${at.day}, de ${at.from} à ${at.to} (heure de ${at.zone}).`,
        how: (b: Booking, ownerPhone: string, room = '') => ({
            phone: `Je vous appelle au ${b.phone}${ownerPhone ? ` (mon numéro : ${ownerPhone})` : ''}.`,
            video: b.location ? `Lien de l'appel visio : ${b.location}` : room
                ? `L'appel visio se passe sur mon site, dans votre navigateur, sans rien installer : ${room} (ouvert 15 minutes avant le début).`
                : "Le lien de l'appel visio vous sera envoyé par e-mail avant le rendez-vous.",
            meeting: b.location ? `Lieu du rendez-vous : ${b.location}.` : 'Le lieu est à convenir ensemble : je reviens vers vous par e-mail.',
        } as Record<string, string>)[b.mode] ?? '',
        cancelLabel: 'Annuler le rendez-vous',
        confirmNote: "Le fichier joint (invite.ics) ajoute ce rendez-vous à votre agenda. Un empêchement ? Le bouton ci-dessus l'annule en un clic.",
        noticeSubject: (name: string, day: string) => `Nouvelle réservation : ${name}, ${day}`,
        noticeTitle: 'Nouvelle réservation',
        noticeRoom: (link: string) => `Votre lien du salon visio (hôte, ne pas transmettre) : ${link}`,
        joinRoom: 'Rejoindre le salon visio',
        noticeText: (b: Booking, at: At) => `${b.name} (${b.email}${b.phone ? `, ${b.phone}` : ''}) a réservé « ${b.typeName} » le ${at.day}, de ${at.from} à ${at.to} (heure de ${at.zone}).${b.message ? ` Message : ${b.message}` : ''}`,
        cancelledSubject: (type: string) => `Rendez-vous annulé : ${type}`,
        cancelledTitle: 'Rendez-vous annulé',
        cancelledText: (b: Booking, at: At) => `Bonjour ${b.name}, votre rendez-vous du ${at.day}, de ${at.from} à ${at.to} (heure de ${at.zone}), est bien annulé. Vous pouvez réserver un autre créneau quand vous voulez.`,
        cancelledByOwnerText: (b: Booking, at: At, owner: string) => `Bonjour ${b.name}, ${owner} a dû annuler votre rendez-vous du ${at.day}, de ${at.from} à ${at.to} (heure de ${at.zone}). Toutes mes excuses : vous pouvez choisir un autre créneau sur la page des réservations.`,
        bookAgain: 'Réserver un autre créneau',
        cancelNoticeSubject: (name: string, day: string) => `Réservation annulée : ${name}, ${day}`,
        cancelNoticeTitle: 'Réservation annulée',
        cancelNoticeText: (b: Booking, at: At) => `${b.name} (${b.email}) a annulé « ${b.typeName} » du ${at.day}, de ${at.from} à ${at.to} (heure de ${at.zone}). Le créneau est de nouveau libre.`,
    },
    en: {
        regards: 'Best regards',
        confirmSubject: (type: string, day: string) => `Booking confirmed: ${type}, ${day}`,
        confirmTitle: 'Booking confirmed',
        confirmText: (b: Booking, at: At, owner: string) => `Hello ${b.name}, your slot with ${owner} is booked on ${at.day}, from ${at.from} to ${at.to} (${at.zone} time).`,
        how: (b: Booking, ownerPhone: string, room = '') => ({
            phone: `I will call you on ${b.phone}${ownerPhone ? ` (my number: ${ownerPhone})` : ''}.`,
            video: b.location ? `Link of the video call: ${b.location}` : room
                ? `The video call takes place on my site, in your browser, nothing to install: ${room} (open 15 minutes before the start).`
                : 'The link of the video call will be sent to you by email before the appointment.',
            meeting: b.location ? `Place of the meeting: ${b.location}.` : 'The place is to agree on together: I will get back to you by email.',
        } as Record<string, string>)[b.mode] ?? '',
        cancelLabel: 'Cancel the appointment',
        confirmNote: 'The attached file (invite.ics) adds this appointment to your calendar. Something came up? The button above cancels it in one click.',
        noticeSubject: (name: string, day: string) => `New booking: ${name}, ${day}`,
        noticeTitle: 'New booking',
        noticeRoom: (link: string) => `Your link of the video room (host, do not pass it on): ${link}`,
        joinRoom: 'Join the video room',
        noticeText: (b: Booking, at: At) => `${b.name} (${b.email}${b.phone ? `, ${b.phone}` : ''}) booked “${b.typeName}” on ${at.day}, from ${at.from} to ${at.to} (${at.zone} time).${b.message ? ` Message: ${b.message}` : ''}`,
        cancelledSubject: (type: string) => `Appointment cancelled: ${type}`,
        cancelledTitle: 'Appointment cancelled',
        cancelledText: (b: Booking, at: At) => `Hello ${b.name}, your appointment of ${at.day}, from ${at.from} to ${at.to} (${at.zone} time), is cancelled. You can book another slot whenever you like.`,
        cancelledByOwnerText: (b: Booking, at: At, owner: string) => `Hello ${b.name}, ${owner} had to cancel your appointment of ${at.day}, from ${at.from} to ${at.to} (${at.zone} time). Sorry about that: you can pick another slot on the booking page.`,
        bookAgain: 'Book another slot',
        cancelNoticeSubject: (name: string, day: string) => `Booking cancelled: ${name}, ${day}`,
        cancelNoticeTitle: 'Booking cancelled',
        cancelNoticeText: (b: Booking, at: At) => `${b.name} (${b.email}) cancelled “${b.typeName}” of ${at.day}, from ${at.from} to ${at.to} (${at.zone} time). The slot is free again.`,
    },
}
