import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLang } from './useLang'

// Language given by the address (?lang=en), for the pages opened from the tools, the e-mails and Stripe (pages/licenses):
// read once to show the page in the buyer's language, then the whole query (?lang=, ?product=) is removed from the
// address bar: clean URL like every other page (the pages read what they need from it at setup)
export const useLangQuery = () => {
    const lang = useLang()
    const route = useRoute()
    const router = useRouter()
    const asked = route.query.lang
    if (typeof asked === 'string') lang.setFromAddress(asked)
    onMounted(() => {
        if (Object.keys(route.query).length) router.replace({ query: {}, hash: route.hash })
    })
}
