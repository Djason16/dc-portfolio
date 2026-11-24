import { computed, ref } from 'vue'
import { api } from '@/utils/api'

// Licences of the DC tools in the admin (/api/licenses, server/controllers/LicensesController.ts). The tools come from the
// server (dc_license_products: a released tool appears by itself), shared by every modal (useState)
export const useLicenses = () => {
    const licenses = ref<Record<string, any>[]>([])
    const products = useState<{ id: string, name: string }[]>('licenseProducts', () => [])
    const productIds = computed(() => products.value.map(p => p.id))
    const productNames = computed<Record<string, string>>(() => Object.fromEntries(products.value.map(p => [p.id, p.name])))
    const search = ref('')
    const product = ref('')

    const fetchLicenses = async () => {
        const res = await api.get('/licenses')
        if (res.success) licenses.value = res.licenses, products.value = res.products ?? products.value
        return res
    }

    // Search on the e-mail, the name, the note and the end of the key; filter on one tool
    const filtered = computed(() => {
        const q = search.value.toLowerCase().trim()
        return licenses.value.filter(l => (!product.value || l.products.includes(product.value))
            && (!q || [l.email, l.name, l.note, l.keyEnd].some(text => String(text || '').toLowerCase().includes(q))))
    })

    const replace = (license: Record<string, any>) => {
        licenses.value = licenses.value.map(l => l.id === license.id ? license : l)
    }

    const updateLicense = async (id: string, changes: Record<string, unknown>) => {
        const res = await api.put(`/licenses/${id}`, changes)
        if (res.success) replace(res.license)
        return res
    }

    const renewLicense = async (id: string) => {
        const res = await api.post(`/licenses/${id}/renew`, {})
        if (res.success) replace(res.license)
        return res
    }

    const giftLicense = async (data: Record<string, unknown>) => {
        const res = await api.post('/licenses', data)
        if (res.success) licenses.value = [res.license, ...licenses.value]
        return res
    }

    // Prices and offers (Stripe), admin > DC licences > Prices and offers
    const pricing = ref<{ prices: Record<string, any>[], offers: Record<string, any>[] }>({ prices: [], offers: [] })
    const keepPricing = (res: Record<string, any>) => {
        if (res.success) pricing.value = { prices: res.prices, offers: res.offers }
        return res
    }
    const fetchPricing = async () => keepPricing(await api.get('/licenses/pricing'))
    const setPrice = async (offer: string, interval: string, amount: number) => keepPricing(await api.put('/licenses/pricing', { offer, interval, amount }))
    const createOffer = async (data: Record<string, unknown>) => keepPricing(await api.post('/licenses/offers', data))
    const deleteOffer = async (id: string) => keepPricing(await api.delete(`/licenses/offers/${id}`))

    const fetchVersions = () => api.get('/licenses/versions')
    const setVersion = (productId: string, version: string) => api.put('/licenses/versions', { product: productId, version })

    // The tools only (the gift and offer forms opened without the list)
    const fetchProducts = async () => products.value.length || await fetchLicenses()

    return { licenses, products, productIds, productNames, fetchProducts, search, product, filtered, fetchLicenses, updateLicense, renewLicense, giftLicense, fetchVersions, setVersion,
        pricing, fetchPricing, setPrice, createOffer, deleteOffer }
}
