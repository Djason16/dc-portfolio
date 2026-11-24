import { ref, shallowRef } from 'vue'
import { LANGUAGES, fillText } from './translations/languages'
import { useSiteTextsStore } from '@/stores/siteTexts'

/*
 * Languages of the site, read with useLang() (composables/useLang.js):
 *   const { getTranslation: t } = useLang()   then   {{ t('legal') }} in the template, t('footerText', { year: 2026, name: 'Site' }) in a script
 *   const lang = useLang()                     lang.current.value ('fr' / 'en'), lang.setLang('en')
 * Texts: plugins/translations/ (some can be changed from the admin: stores/siteTexts.js). Languages of the site: plugins/translations/languages.ts.
 *
 * Speed: the texts of every page and of the admin (~300 KB) are not in the JavaScript of the first page. The server writes
 * into the page the texts it used (useState, in the HTML); the browser shows the page with them, then fetches every text
 * once the page is ready (before any other page, a change of language or a text the page did not have: shown at once
 * when they arrive)
 */
const STORAGE_KEY = 'selectedLanguage'

type Texts = typeof import('./translations/translations')
const loadTexts = () => import('./translations/translations')

export default defineNuxtPlugin(async (nuxtApp) => {
    // Current language: the first one of LANGUAGES until the visitor changes it
    const current = ref<string>(LANGUAGES[0]!)
    // Language given by the address (?lang=en, composables/useLangQuery.ts): wins over the one of a previous visit
    let fromAddress = false

    // Texts used by the server for this page, per language (sent in the HTML)
    const used = useState<Record<string, Record<string, string>>>('lang-texts', () => ({}))
    // Every text: at once on the server, after the page in the browser
    const all = shallowRef<Texts | null>(null)
    let loading: Promise<Texts> | null = null
    const loadAll = () => (loading ??= loadTexts().then(module => (all.value = module)))

    if (import.meta.server || !nuxtApp.payload.serverRendered) await loadAll()
    else {
        // After the page is shown (the browser is idle), then before any other page
        onNuxtReady(() => { loadAll() })
        useRouter().beforeEach(async () => {
            if (!nuxtApp.isHydrating) await loadAll()
        })
    }

    // Text of a key as written in the files, undefined when unknown (still loading in the browser)
    const textOf = (language: string, key: string): string | undefined => {
        if (all.value) {
            const text = all.value.textOf(language, key)
            // A key without text shows itself, in the browser too (no difference while the page starts)
            if (import.meta.server) (used.value[language] ??= {})[key] = text ?? key
            return text
        }
        return used.value[language]?.[key]
    }

    const lang = {
        current,
        availableLanguages: LANGUAGES,

        // Text of a key in the current language ("{{name}}" in the text is replaced by values.name);
        // a text changed from the admin (stores/siteTexts.js) replaces the one of plugins/translations/.
        // A key unknown to the page while the texts load: empty, filled in when they arrive (all is reactive)
        getTranslation: (key: string, values?: Record<string, string | number>) => {
            const changed = useSiteTextsStore().changed[current.value]?.[key]
            const text = changed || textOf(current.value, key)
            return fillText(text ?? (all.value ? key : ''), values)
        },

        // remember = keep the language for the next visit (only allowed with functional cookies);
        // the page only has the texts of its language: every text first
        setLang(code: string | null, remember = false) {
            if (!code || !LANGUAGES.includes(code)) return
            if (remember) localStorage.setItem(STORAGE_KEY, code)
            loadAll().then(() => { current.value = code })
        },

        // Language of the address of the page, kept over restore()
        setFromAddress(code: string) {
            if (!LANGUAGES.includes(code)) return
            fromAddress = true
            current.value = code
        },

        // Language kept during a previous visit (not when the address gives one)
        restore() {
            if (!fromAddress) lang.setLang(localStorage.getItem(STORAGE_KEY))
        },
    }

    // <html lang="..."> follows the current language
    useHead({ htmlAttrs: { lang: current } })

    return { provide: { lang } }
})
