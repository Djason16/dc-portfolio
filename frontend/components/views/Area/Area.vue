<!-- Zone page (/zone-intervention/), a « fiche » like the city pages (city-sheet.css): the title very large and the ribbon of
     figures of the zone, then the published cities as an editorial index (filter by department), the map, the call to
     action. No city yet: a short text and the call to action. Look: area.css -->
<template>
    <div class="city-page">
        <article class="sheet">
            <CitySheetHero :crumbs="[{ label: t('cityHome'), to: '/' }, { label: t('cityZone') }]" :kicker="kicker" long
                :title="{ before: t('zoneBefore'), name: t('zoneTitle'), after: joinNames(groups.map(group => group.name)) }"
                :lead="!cities.length ? t('zoneLeadEmpty') : base ? t('zoneLead', { base: baseText }) : t('zoneLeadNoBase')" :facts="facts" :facts-label="t('zoneTitle')">
                <template #actions>
                    <HeroButton primary iconClass="fas fa-calendar-check" :label="t('cityBook')" :title="t('cityBookTitle')" href="/book/" />
                    <HeroButton v-if="site.email" iconClass="fas fa-envelope" :label="t('cityWrite')" :title="t('cityWriteTitle', { email: site.email })"
                        :href="`mailto:${site.email}`" />
                </template>
            </CitySheetHero>

            <section v-reveal class="sheet__part" aria-labelledby="zone-cities">
                <div class="sheet__side">
                    <span class="sheet__number text-numeral" aria-hidden="true">01</span>
                    <span class="eyebrow"><i class="fa-solid fa-city sheet__icon text-normal" aria-hidden="true"></i>{{ t('zoneCitiesLabel') }}</span>
                </div>
                <div class="sheet__body">
                    <h2 id="zone-cities" class="text-display-m">{{ t('zoneCitiesTitle') }}</h2>
                    <p class="sheet__text text-body-l">{{ cities.length ? t('zoneElsewhere') : t('zoneEmpty') }}</p>

                    <!-- Filter by department: the hidden rows stay in the page (search engines read them all) -->
                    <ul v-if="groups.length > 1" class="zone-filters" :aria-label="t('zoneFilterLabel')">
                        <li v-for="group in [{ code: '', name: t('zoneFilterAll') }, ...groups]" :key="group.code">
                            <button type="button" class="zone-filter text-label" :aria-pressed="filter === group.code" @click="filter = group.code">
                                {{ group.code ? `${group.name} (${group.code})` : group.name }}
                            </button>
                        </li>
                    </ul>

                    <ol v-if="cities.length" class="zone-index">
                        <li v-for="(city, i) in cities" v-show="!filter || city.department_code === filter" :key="city.slug" class="zone-index__item">
                            <NuxtLink :to="`/creation-site-internet/${city.slug}/`" :title="t('zoneCityLink', { name: city.name })" class="zone-index__link">
                                <span class="zone-index__number eyebrow" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
                                <span class="zone-index__name">
                                    <span class="text-display-m">{{ city.name }}</span>
                                    <span class="zone-index__code text-label">{{ city.postal_code }} · {{ city.department_name }}</span>
                                </span>
                                <span class="zone-index__meta text-body-s">
                                    <span><i class="fa-solid fa-route sheet__icon" aria-hidden="true"></i>{{ distanceOf(city) }}</span>
                                    <span v-if="city.population"><i class="fa-solid fa-users sheet__icon" aria-hidden="true"></i>{{ t('zonePopulation', { count: formatNumber(city.population) }) }}</span>
                                </span>
                                <span class="zone-index__arrow" aria-hidden="true">→</span>
                            </NuxtLink>
                        </li>
                    </ol>
                </div>
            </section>

            <section v-if="cities.length" v-reveal class="sheet__part" aria-labelledby="zone-map">
                <div class="sheet__side">
                    <span class="sheet__number text-numeral" aria-hidden="true">02</span>
                    <span class="eyebrow"><i class="fa-solid fa-map-location-dot sheet__icon text-normal" aria-hidden="true"></i>{{ t('zoneMapLabel') }}</span>
                </div>
                <div class="sheet__body">
                    <h2 id="zone-map" class="text-display-m">{{ t('zoneMapTitle') }}</h2>
                    <p class="sheet__text text-body-l">{{ t('zoneMapText') }}</p>
                    <div class="sheet__map">
                        <CityMap :points="mapPoints" :label="t('cityMapLabel', { names: cities.map(c => c.name).join(', ') })" />
                    </div>
                </div>
            </section>

            <section v-reveal class="sheet__cta" aria-labelledby="zone-cta">
                <h2 id="zone-cta" class="text-display-l">{{ t('zoneCtaTitle') }}</h2>
                <p class="text-body-l">{{ t('zoneCtaText') }}</p>
                <div class="sheet__actions">
                    <HeroButton primary iconClass="fas fa-calendar-check" :label="t('cityBook')" :title="t('cityBookTitle')" href="/book/" />
                    <HeroButton v-if="site.email" iconClass="fas fa-envelope" :label="t('cityWrite')" :title="t('cityWriteTitle', { email: site.email })"
                        :href="`mailto:${site.email}`" />
                </div>
            </section>
        </article>
    </div>
</template>

<script setup lang="ts">
import '@/components/views/City/city.css'
import '@/components/views/City/city-sheet.css'
import './area.css'
import { computed, ref } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import CityMap from '@/components/views/City/CityMap.vue'
import { withBase } from '@/utils/cityMap'
import CitySheetHero from '@/components/views/City/CitySheetHero.vue'
import { useLang } from '@/composables/useLang'
import { useSite } from '@/composables/useSite'
import { api } from '@/utils/api'
import { formatDuration, formatKm, formatNumber, inCity, joinNames } from '@/utils/cities/cityText'
import { applyLocalSeo, breadcrumbSchema, businessSchema, localityOf } from '@/utils/citySeo'

type ZoneCity = { name: string, slug: string, postal_code: string, department_code: string, department_name: string, population: number | null,
    companies_total: number | null, companies_capped: boolean, lat: number | null, lng: number | null, base_town: string,
    distance_km: number | null, drive_minutes: number | null }

const lang = useLang()
const t = lang.getTranslation
const site = useSite()

// The published cities, read on the server (in the HTML)
const { data } = await useAsyncData('zone-cities', () => api.get('/cities/published'))
const cities = computed<ZoneCity[]>(() => data.value?.cities ?? [])
const filter = ref('')
// Every published town on the map, and the base town (town of the billing address, settings)
const mapPoints = computed(() => withBase(cities.value, data.value?.base))

// Base town: the one the distances were measured from, else the town of the billing address
const base = computed(() => cities.value.find(city => city.base_town)?.base_town || localityOf(site.invoiceAddress ?? '')?.locality || '')
const baseText = computed(() => lang.current.value === 'fr' ? inCity(base.value) : `in ${base.value}`)

// Departments in the order of their first city (the order of the admin)
const groups = computed(() => {
    const list: { code: string, name: string }[] = []
    for (const city of cities.value) if (!list.some(group => group.code === city.department_code)) list.push({ code: city.department_code, name: city.department_name })
    return list
})
const kicker = computed(() => [site.name, base.value && t('zoneFactBase') + ' ' + base.value].filter(Boolean).join(' · '))

// Figures of the zone: towns, their inhabitants and companies, the farthest one by road
const facts = computed(() => {
    if (!cities.value.length) return []
    const sum = (pick: (city: ZoneCity) => number | null) => cities.value.reduce((total, city) => total + (pick(city) ?? 0), 0)
    const far = Math.max(...cities.value.map(city => city.distance_km ?? 0))
    const companies = sum(city => city.companies_total)
    return [
        { icon: 'fa-solid fa-city', label: t('zoneFactCities'), value: String(cities.value.length), note: t('zoneFactCitiesNote') },
        { icon: 'fa-solid fa-users', label: t('zoneFactPeople'), value: formatNumber(sum(city => city.population)), note: t('cityFactPopulationNote') },
        ...(companies ? [{ icon: 'fa-solid fa-building', label: t('cityFactCompanies'), value: `${cities.value.some(c => c.companies_capped) ? '+ ' : ''}${formatNumber(companies)}`, note: t('cityFactCompaniesNote') }] : []),
        ...(far ? [{ icon: 'fa-solid fa-route', label: t('zoneFactFar'), value: formatKm(far), note: t('zoneFactFarNote') }] : []),
    ]
})

const distanceOf = (city: ZoneCity) => city.base_town && city.base_town === city.name ? t('cityHere')
    : city.distance_km !== null && city.drive_minutes !== null
        ? t('zoneDistance', { km: formatKm(city.distance_km), base: city.base_town, time: formatDuration(city.drive_minutes) })
        : city.postal_code

// <head>: the business with every published city as its area served
const siteValues = site as unknown as Record<string, string>
applyLocalSeo(siteValues, {
    title: t('seoZoneTitle', { name: site.name }), description: t('seoZoneDescription', { name: site.name }),
    keywords: ['création site internet Oise', 'développeur web Oise', 'création site internet Paris', ...cities.value.map(city => `création site internet ${city.name}`)].join(', '),
    path: '/zone-intervention',
}, [
    businessSchema(siteValues, t('seoZoneDescription', { name: site.name }), cities.value.map(city => ({ name: city.name, department: city.department_name }))),
    breadcrumbSchema(siteValues, [{ name: 'Accueil', path: '/' }, { name: "Zone d'intervention", path: '/zone-intervention' }]),
])
</script>
