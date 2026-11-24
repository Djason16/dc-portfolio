/*
 * Social links of the site: an ordered list edited in admin > My info, saved as JSON in the setting socialLinks
 * ([{ network: 'linkedin', url: 'https://...' }, { network: 'other', label: 'Codepen', url: 'https://...' }]).
 * Read by the footer, the structured data (sameAs) and the e-mail signature (WhatsApp); checked by the server on save.
 *
 *   socialLinksOf(site.socialLinks)          the saved links, in their order (bad entries left out)
 *   checkSocialLinks(list)                   { links } cleaned up, or { error, index } for the first wrong one
 *
 * A new network: add it to SOCIAL_NETWORKS (its full Font Awesome classes written here: scripts/icons.mjs finds them)
 * and its link title to plugins/translations/common/socials.ts (socialTitle_<id>).
 */

export type SocialLink = { network: string, url: string, label?: string }
type Network = { label: string, icon: string, hosts: string[], placeholder: string }

// "name.*": any country domain of the brand (malt.fr, malt.de, pinterest.co.uk...)
export const SOCIAL_NETWORKS: Record<string, Network> = {
    linkedin: { label: 'LinkedIn', icon: 'fa-brands fa-linkedin', hosts: ['linkedin.com', 'lnkd.in'], placeholder: 'https://www.linkedin.com/in/...' },
    github: { label: 'GitHub', icon: 'fa-brands fa-github', hosts: ['github.com'], placeholder: 'https://github.com/...' },
    malt: { label: 'Malt', icon: 'fa-solid fa-briefcase', hosts: ['malt.*'], placeholder: 'https://www.malt.fr/profile/...' },
    instagram: { label: 'Instagram', icon: 'fa-brands fa-instagram', hosts: ['instagram.com', 'instagr.am'], placeholder: 'https://www.instagram.com/...' },
    tiktok: { label: 'TikTok', icon: 'fa-brands fa-tiktok', hosts: ['tiktok.com'], placeholder: 'https://www.tiktok.com/@...' },
    facebook: { label: 'Facebook', icon: 'fa-brands fa-facebook', hosts: ['facebook.com', 'fb.com', 'fb.me'], placeholder: 'https://www.facebook.com/...' },
    youtube: { label: 'YouTube', icon: 'fa-brands fa-youtube', hosts: ['youtube.com', 'youtu.be'], placeholder: 'https://www.youtube.com/@...' },
    vimeo: { label: 'Vimeo', icon: 'fa-brands fa-vimeo-v', hosts: ['vimeo.com'], placeholder: 'https://vimeo.com/...' },
    x: { label: 'X (Twitter)', icon: 'fa-brands fa-x-twitter', hosts: ['x.com', 'twitter.com'], placeholder: 'https://x.com/...' },
    threads: { label: 'Threads', icon: 'fa-brands fa-threads', hosts: ['threads.net', 'threads.com'], placeholder: 'https://www.threads.net/@...' },
    bluesky: { label: 'Bluesky', icon: 'fa-brands fa-bluesky', hosts: ['bsky.app'], placeholder: 'https://bsky.app/profile/...' },
    behance: { label: 'Behance', icon: 'fa-brands fa-behance', hosts: ['behance.net'], placeholder: 'https://www.behance.net/...' },
    dribbble: { label: 'Dribbble', icon: 'fa-brands fa-dribbble', hosts: ['dribbble.com'], placeholder: 'https://dribbble.com/...' },
    twitch: { label: 'Twitch', icon: 'fa-brands fa-twitch', hosts: ['twitch.tv'], placeholder: 'https://www.twitch.tv/...' },
    pinterest: { label: 'Pinterest', icon: 'fa-brands fa-pinterest', hosts: ['pinterest.*', 'pin.it'], placeholder: 'https://www.pinterest.fr/...' },
    // A wa.me link, or a phone number turned into one (+33 6 12 34 56 78 -> https://wa.me/33612345678)
    whatsapp: { label: 'WhatsApp', icon: 'fa-brands fa-whatsapp', hosts: ['wa.me', 'whatsapp.com'], placeholder: 'https://wa.me/33...' },
    // Any https address, with its own name
    other: { label: 'Autre', icon: 'fa-solid fa-link', hosts: [], placeholder: 'https://...' },
}

// Settings of the fixed fields used before the list, in the order of the footer (moved once at start: SettingsHelper)
export const LEGACY_SOCIAL_KEYS = ['linkedin', 'github', 'malt', 'instagram', 'tiktok', 'facebook', 'whatsapp']

// Networks whose page is a profile of the owner (structured data sameAs): not a chat link
const NOT_PROFILES = ['whatsapp']

const MAX_LINKS = 30
const MAX_LABEL = 40

// The host of an address is the domain of the network or one of its subdomains
const hostMatches = (host: string, pattern: string) => {
    const base = pattern.replace(/\.\*$/, '').replace(/\./g, '\\.')
    const tld = pattern.endsWith('.*') ? '\\.[a-z]{2,}(\\.[a-z]{2})?' : ''
    return new RegExp(`(^|\\.)${base}${tld}$`).test(host)
}

// An address typed without https:// gets it; a phone number given for WhatsApp becomes a wa.me link
export const normalizeSocialUrl = (network: string, url: string) => {
    const value = String(url ?? '').trim()
    if (network === 'whatsapp' && /^\+?[\d\s.()-]{6,}$/.test(value)) return `https://wa.me/${value.replace(/\D/g, '')}`
    if (value && !/^[a-z][a-z\d+.-]*:/i.test(value)) return `https://${value}`
    return value
}

// Problem of one link (a key of plugins/translations/pages/admin/settings.ts), or '' when it is right
export const socialLinkError = (link: SocialLink) => {
    const network = SOCIAL_NETWORKS[link.network]
    if (!network) return 'socialErrorNetwork'
    if (link.network === 'other' && !String(link.label ?? '').trim()) return 'socialErrorLabel'
    let address: URL
    try { address = new URL(normalizeSocialUrl(link.network, link.url)) } catch { return 'socialErrorUrl' }
    if (address.protocol !== 'https:') return 'socialErrorUrl'
    if (network.hosts.length && !network.hosts.some(pattern => hostMatches(address.hostname.toLowerCase(), pattern))) return 'socialErrorHost'
    return ''
}

// The list cleaned up (addresses completed, unknown fields left out), or the first wrong link
export const checkSocialLinks = (value: unknown): { links: SocialLink[] } | { error: string, index: number } => {
    let list = value
    if (typeof list === 'string') try { list = list.trim() ? JSON.parse(list) : [] } catch { return { error: 'socialErrorList', index: -1 } }
    if (!Array.isArray(list) || list.length > MAX_LINKS) return { error: 'socialErrorList', index: -1 }
    const links: SocialLink[] = []
    for (const [index, item] of list.entries()) {
        const network = String(item?.network ?? '')
        const link: SocialLink = { network, url: normalizeSocialUrl(network, item?.url) }
        if (network === 'other') link.label = String(item?.label ?? '').trim().slice(0, MAX_LABEL)
        const error = socialLinkError(link)
        if (error) return { error, index }
        links.push(link)
    }
    return { links }
}

// The saved links (JSON of the setting), in their order; a broken entry is left out, never the whole list
export const socialLinksOf = (json: unknown): SocialLink[] => {
    let list: unknown
    try { list = JSON.parse(String(json || '[]')) } catch { return [] }
    if (!Array.isArray(list)) return []
    return list.filter(link => link && SOCIAL_NETWORKS[link.network] && typeof link.url === 'string' && link.url)
}

// Name shown for a link: the brand, or the name typed for "Autre"
export const socialLabelOf = (link: SocialLink) => link.network === 'other' ? String(link.label || link.url) : SOCIAL_NETWORKS[link.network]?.label ?? ''

// Addresses of the profiles for the structured data (sameAs)
export const socialProfilesOf = (json: unknown) => socialLinksOf(json).filter(link => !NOT_PROFILES.includes(link.network)).map(link => link.url)

// The WhatsApp number (e-mail signature): from the WhatsApp link, else ''
export const whatsappNumberOf = (json: unknown) => (socialLinksOf(json).find(link => link.network === 'whatsapp')?.url ?? '').replace(/[^\d+]/g, '')
