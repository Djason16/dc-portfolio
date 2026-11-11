import type { Mail } from '../helpers/MailHelper'

/*
 * E-mail to the owner when a visitor knocks at his personal room (/room/) while his page of the room is not open
 * (server/controllers/LoungeController.ts): one every 10 minutes at most. In French, like the other notices to the owner.
 */
const siteUrl = () => String(useRuntimeConfig().public.frontendDomain || '').replace(/\/$/, '')
// Address of the personal room (pages/room/index.vue)
export const loungeUrl = () => `${siteUrl()}/room/`

export const LoungeMails = {
    knock(name: string, settings: Record<string, any>): Mail {
        const url = loungeUrl(), safeName = MailHelper.escape(name)
        const text = `${safeName} frappe à la porte de votre salon visio. La demande attend 10 minutes : ouvrez le salon pour le faire entrer ou refuser.`
        return {
            subject: `${name} frappe à votre salon visio`,
            text: `${name} frappe à la porte de votre salon visio. La demande attend 10 minutes : ouvrez le salon pour le faire entrer ou refuser.\n${url}`,
            html: MailLayout.body({ title: 'Quelqu\'un frappe', label: 'Salon visio', value: safeName, instruction: text,
                button: { href: url, label: 'Ouvrir mon salon' }, regards: 'Bien à vous', adminName: MailHelper.escape(settings.name || ''), siteNote: '', locale: 'fr' }),
        }
    },
}
