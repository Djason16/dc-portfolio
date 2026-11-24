/*
 * Rules on the e-mail addresses typed by visitors (trials and help requests of the DC tools, LicenseRequestsController.ts):
 *   EmailRules.isValid(value)        one plain address (no list, no name, no quotes), 255 characters at most
 *   EmailRules.identity(value)       the person behind an address, to count one free trial per person: lower case, without
 *                                    +tag, and without dots for Gmail (jean.dupont+dc@gmail.com = jeandupont@gmail.com)
 *   EmailRules.isDisposable(value)   a throwaway inbox (small built-in list of the common ones)
 */
const GMAIL = ['gmail.com', 'googlemail.com']

// The usual throwaway inboxes: enough to stop a trial taken again and again, not a full list
const DISPOSABLE = new Set([
    '10minutemail.com', '10minutemail.net', '20minutemail.com', 'anonaddy.me', 'burnermail.io', 'byom.de', 'cock.li', 'discard.email',
    'dispostable.com', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net', 'getairmail.com', 'getnada.com', 'guerrillamail.biz',
    'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
    'harakirimail.com', 'inboxbear.com', 'jetable.org', 'mail-temp.com', 'mailcatch.com', 'maildrop.cc', 'mailinator.com',
    'mailinator.net', 'mailnesia.com', 'mailpoof.com', 'mintemail.com', 'mohmal.com', 'moakt.com', 'mytemp.email', 'nada.email',
    'sharklasers.com', 'spam4.me', 'spamgourmet.com', 'tempail.com', 'temp-mail.io', 'temp-mail.org', 'tempmail.com', 'tempmail.dev',
    'tempmail.net', 'tempmailo.com', 'tempr.email', 'throwawaymail.com', 'tmail.ws', 'tmpmail.net', 'tmpmail.org', 'trashmail.com',
    'trashmail.de', 'trashmail.net', 'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc',
    'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf', 'moncourrier.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf',
])

const domainOf = (email: string) => email.slice(email.lastIndexOf('@') + 1).toLowerCase()

export const EmailRules = {
    isValid: (value: unknown) => {
        const email = String(value ?? '')
        return email.length <= 255 && /^[^\s@,;:<>()[\]"'\\]+@[^\s@,;:<>()[\]"'\\]+\.[^\s@,;:<>()[\]"'\\]+$/.test(email)
    },

    identity(value: string) {
        const email = value.trim().toLowerCase()
        const at = email.lastIndexOf('@')
        let local = email.slice(0, at).split('+')[0] ?? ''
        let domain = email.slice(at + 1)
        if (GMAIL.includes(domain)) { local = local.replace(/\./g, ''); domain = 'gmail.com' }
        return `${local}@${domain}`
    },

    isDisposable: (value: string) => {
        const domain = domainOf(value)
        // The domain itself or one of its parents (xyz.yopmail.com)
        return [...DISPOSABLE].some(d => domain === d || domain.endsWith(`.${d}`))
    },
}
