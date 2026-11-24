<!-- Page of a city (/creation-site-internet/<slug>/): data and <head> here, the page itself in CitySheet (« fiche de ville »).
     Texts: utils/cities/ (French); figures and map: the data of the city -->
<template>
    <div class="city-page">
        <CitySheet :city="city" :page="page" :title="titleParts" :eyebrow="eyebrow" :crumbs="crumbs" :facts="facts">
            <template #actions>
                <HeroButton primary iconClass="fas fa-calendar-check" :label="t('cityBook')" :title="t('cityBookTitle')" :href="BOOK_PATH" />
                <HeroButton v-if="site.email" iconClass="fas fa-envelope" :label="t('cityWrite')" :title="t('cityWriteTitle', { email: site.email })"
                    :href="`mailto:${site.email}`" />
            </template>
            <template #map>
                <div class="sheet__map">
                    <CityMap :points="mapPoints" :focus="mapFocus" :label="t('cityMapLabel', { names: mapPoints.map(p => p.name).join(', ') })">
                        <a v-if="city.lat !== null" :href="osmUrl" target="_blank" rel="noopener noreferrer" class="sheet__map-link text-label"
                            :title="t('cityMapOpenTitle', { name: city.name })"><i class="fa-solid fa-map sheet__icon" aria-hidden="true"></i>{{ t('cityMapOpen', { name: city.name }) }} ↗</a>
                    </CityMap>
                </div>
            </template>
        </CitySheet>
        <p v-if="page.sourceNote" class="city-source text-body-s" lang="fr">{{ page.sourceNote }}, {{ t('citySourceDate', { date: dataDate }) }}</p>
    </div>
</template>

<script setup lang="ts">
import './city.css'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import CitySheet from './CitySheet.vue'
import CityMap from './CityMap.vue'
import { withBase, type MapPlace } from '@/utils/cityMap'
import { useLang } from '@/composables/useLang'
import { useSite } from '@/composables/useSite'
import { api } from '@/utils/api'
import { buildCityPage } from '@/utils/cities/cityPage'
import { cityMeta } from '@/utils/cities/cityMeta'
import { formatDuration, formatKm, formatNumber, isBase } from '@/utils/cities/cityText'
import type { City, CityContext } from '@/utils/cities/cityTypes'
import { applyLocalSeo, breadcrumbSchema, businessSchema, faqSchema, shortDescription } from '@/utils/citySeo'

const ZONE_PATH = '/zone-intervention/'
const BOOK_PATH = '/book/'

const lang = useLang()
const t = lang.getTranslation
const site = useSite()
const route = useRoute()
const slug = String(route.params.slug ?? '')

// The city and what its page is built from, read on the server (in the HTML); unknown or not published: the 404 page
const { data } = await useAsyncData(`city-${slug}`, () => api.get(`/cities/page/${encodeURIComponent(slug)}`))
if (!data.value?.success) throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })

const city = computed(() => data.value!.city as City)
// A draft (seen by the admin only) is never kept by a cache
if (import.meta.server && !city.value.published) useResponseHeader('Cache-Control').value = 'no-store'
const context = computed(() => data.value!.context as CityContext)
const owner = computed(() => String(data.value!.owner || site.name || ''))
const page = computed(() => buildCityPage(city.value, context.value, owner.value))

// The h1 around the name of the town: "Création de site internet à" / "Compiègne" / "(60200)"
const titleParts = computed(() => {
    const at = page.value.h1.lastIndexOf(city.value.name)
    return at < 0 ? { before: '', name: page.value.h1, after: '' }
        : { before: page.value.h1.slice(0, at).trim(), name: city.value.name, after: page.value.h1.slice(at + city.value.name.length).trim() }
})

const crumbs = computed(() => [{ label: t('cityHome'), to: '/' }, { label: t('cityZone'), to: ZONE_PATH }, { label: city.value.name }])
const eyebrow = computed(() => [city.value.postal_code, city.value.department_name, city.value.region_name].filter(Boolean).join(' · '))

const facts = computed(() => {
    const c = city.value
    const list: { icon: string, label: string, value: string, note: string }[] = []
    if (isBase(c)) list.push({ icon: 'fa-solid fa-route', label: t('cityFactDistance', { base: c.base_town }), value: t('cityHere'), note: t('cityFactBase') })
    else if (c.distance_km !== null && c.drive_minutes !== null)
        list.push({ icon: 'fa-solid fa-route', label: t('cityFactDistance', { base: c.base_town }), value: formatKm(c.distance_km), note: t('cityFactDrive', { time: formatDuration(c.drive_minutes) }) })
    if (c.population) list.push({ icon: 'fa-solid fa-users', label: t('cityFactPopulation'), value: formatNumber(c.population), note: t('cityFactPopulationNote') })
    if (c.companies_total) list.push({ icon: 'fa-solid fa-building', label: t('cityFactCompanies'), value: `${c.companies_capped ? '+ ' : ''}${formatNumber(c.companies_total)}`, note: t('cityFactCompaniesNote') })
    if (c.department_name) list.push({ icon: 'fa-solid fa-location-dot', label: t('cityFactDepartment'), value: `${c.department_name} (${c.department_code})`, note: c.region_name })
    return list
})

// The map: every published town and the base town (settings), first fitted on this town, its neighbours and the base
const mapPoints = computed(() => withBase(((data.value!.area ?? []) as MapPlace[]).map(point => ({ ...point, current: point.name === city.value.name })),
    data.value!.base))
const mapFocus = computed(() => [city.value.name, city.value.base_town, ...context.value.nearby.map(other => other.name)])
const osmUrl = computed(() => `https://www.openstreetmap.org/?mlat=${city.value.lat}&mlon=${city.value.lng}&zoom=12`)
const dataDate = computed(() => city.value.data_updated_at ? new Date(city.value.data_updated_at).toLocaleDateString('fr-FR') : '')

// <head>: title, description, keywords, canonical, the business serving this city, the breadcrumb and the questions
const meta = cityMeta(city.value, owner.value)
applyLocalSeo(site as unknown as Record<string, string>, {
    title: meta.title, description: shortDescription(meta.description), keywords: meta.keywords, path: `/creation-site-internet/${slug}`,
    noIndex: !city.value.published,
}, [
    businessSchema(site as unknown as Record<string, string>, meta.description, [{ name: city.value.name, department: city.value.department_name }]),
    breadcrumbSchema(site as unknown as Record<string, string>, [
        { name: 'Accueil', path: '/' }, { name: "Zone d'intervention", path: ZONE_PATH }, { name: city.value.name, path: `/creation-site-internet/${slug}` },
    ]),
    faqSchema(page.value.faq),
])
</script>
