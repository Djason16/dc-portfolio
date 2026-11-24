import { api } from '@/utils/api'
import type { City, CityFaqTemplate } from '@/utils/cities/cityTypes'
import type { CitySimilarity } from '@/utils/cities/citySimilarity'

/*
 * Cities of the pages /creation-site-internet/<slug>/ in the admin (admin > Villes), shared by its modals (useState):
 *   const { cities, faqs, fetchCities, addCity, updateCity, refreshCity, removeCity, reorder, saveFaq, removeFaq } = useCities()
 * Every call answers like api.ts ({ success, error? }); the list is loaded again after a change (similarity of every city).
 */
export type AdminCity = City & { similarity?: CitySimilarity }

export const useCities = () => {
    const cities = useState<AdminCity[]>('adminCities', () => [])
    const faqs = useState<CityFaqTemplate[]>('adminCityFaqs', () => [])
    const loaded = useState('adminCitiesLoaded', () => false)

    const fetchCities = async () => {
        const res = await api.get('/cities')
        if (res.success) cities.value = res.cities, faqs.value = res.faqs, loaded.value = true
        return res
    }
    // After a change: the list again (the similarity of the other cities changes too)
    const then = async (res: Awaited<ReturnType<typeof api.get>>) => (res.success && await fetchCities(), res)

    return {
        cities, faqs, loaded, fetchCities,
        // Adding fetches the data of the town (a few seconds)
        addCity: async (name: string, postalCode: string) => then(await api.post('/cities', { name, postal_code: postalCode })),
        updateCity: async (id: string, changes: Record<string, unknown>) => then(await api.put(`/cities/${id}`, changes)),
        refreshCity: async (id: string) => then(await api.post(`/cities/${id}/refresh`, {})),
        removeCity: async (id: string) => then(await api.delete(`/cities/${id}`)),
        reorder: async (ids: string[]) => then(await api.post('/cities/reorder', { ids })),
        saveFaq: async (id: string | null, changes: Record<string, unknown>) =>
            then(await (id ? api.put(`/cities/faqs/${id}`, changes) : api.post('/cities/faqs', changes))),
        removeFaq: async (id: string) => then(await api.delete(`/cities/faqs/${id}`)),
    }
}
