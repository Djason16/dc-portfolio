<template>
    <!-- Admin > Villes: one row per city (a card on phones): status, data, similarity with the closest other city page,
         buttons to order, publish, refresh, see, edit and delete; Add a town / Shared questions below -->
    <TableModal :show="show" :title="t('adminCities')" max-width="1200px" v-model:search="search" :search-placeholder="t('citiesSearch')"
        @close="emit('close')">
        <ul v-if="shown.length" class="city-rows">
            <li v-for="city in shown" :key="city.id" class="city-row">
                <div class="city-row__main">
                    <p class="city-row__name text-display-xs">
                        {{ city.name }} <span class="city-row__code text-body-s">{{ city.postal_code }}</span>
                        <span class="city-row__status text-label" :class="{ 'is-on': city.published }">{{ t(city.published ? 'cityPublished' : 'cityDraft') }}</span>
                    </p>
                    <p class="city-row__meta text-body-s">{{ metaOf(city) }}</p>
                    <p v-if="city.data_error" class="city-row__warn text-body-s">{{ t(city.data_error) }}</p>
                    <p v-if="city.similarity?.closest" class="city-row__similar text-body-s" :class="{ 'is-high': city.similarity.percent >= SIMILARITY_LIMIT }">
                        {{ t(city.similarity.percent >= SIMILARITY_LIMIT ? 'citySimilarityHigh' : 'citySimilarity', { percent: String(city.similarity.percent).replace('.', ','), name: city.similarity.closest }) }}
                    </p>
                </div>
                <div class="city-row__actions">
                    <IconButton icon="chevron-up" :label="t('cityUp')" :disabled="busy || !canMove(city, -1)" @click="move(city, -1)" />
                    <IconButton icon="chevron-down" :label="t('cityDown')" :disabled="busy || !canMove(city, 1)" @click="move(city, 1)" />
                    <IconButton :icon="city.published ? 'close' : 'check'" :variant="city.published ? 'ghost' : 'primary'"
                        :text="t(city.published ? 'cityUnpublish' : 'cityPublish')" :label="t(city.published ? 'cityUnpublish' : 'cityPublish')"
                        :disabled="busy" @click="togglePublished(city)" />
                    <IconButton icon="refresh" :label="t('cityRefresh')" :disabled="busy" @click="refresh(city)" />
                    <a :href="`/creation-site-internet/${city.slug}/`" target="_blank" rel="noopener" class="icon-btn icon-btn--ghost icon-btn--small"
                        :title="t('cityView', { name: city.name })" :aria-label="t('cityView', { name: city.name })"><i class="fas fa-eye text-normal" aria-hidden="true"></i></a>
                    <IconButton icon="pen" :label="t('cityEdit')" @click="emit('open', 'city', { city })" />
                    <IconButton icon="trash" variant="danger" :label="t('delete')" :disabled="busy" @click="remove(city)" />
                </div>
            </li>
        </ul>
        <p v-else class="city-rows__empty text-body">{{ t('citiesEmpty') }}</p>

        <template #actions>
            <HeroButton iconClass="fas fa-circle-question" :label="t('adminCityFaqs')" @click="emit('open', 'cityFaqs', {})" />
            <HeroButton primary iconClass="fas fa-plus" :label="t('cityAdd')" @click="emit('open', 'city', { city: null })" />
        </template>
    </TableModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import IconButton from '@/components/ui/Button/IconButton.vue'
import TableModal from '@/components/ui/Modal/TableModal.vue'
import { useCities, type AdminCity } from '@/composables/useCities'
import { useLang } from '@/composables/useLang'
import { formatDuration, formatKm, formatNumber } from '@/utils/cities/cityText'
import { SIMILARITY_LIMIT } from '@/utils/cities/citySimilarity'
import { showConfirm, showFailure, showResult, showSuccess } from '@/utils/dialog'

const props = defineProps({ show: Boolean })
// open: another tool of the admin (the city form, the shared questions), with its props
const emit = defineEmits(['close', 'open'])

const { getTranslation: t } = useLang()
const { cities, fetchCities, updateCity, refreshCity, removeCity, reorder } = useCities()
const search = ref('')
const busy = ref(false)

const shown = computed(() => {
    const q = search.value.toLowerCase().trim()
    return q ? cities.value.filter(city => [city.name, city.postal_code, city.department_name].some(v => v?.toLowerCase().includes(q))) : cities.value
})

// One line of data: department, distance, inhabitants, companies
const metaOf = (city: AdminCity) => {
    if (!city.data_updated_at) return t('cityNoData')
    return [
        city.department_name,
        city.distance_km !== null && city.drive_minutes !== null ? t('cityDistance', { km: formatKm(city.distance_km), time: formatDuration(city.drive_minutes) }) : '',
        city.population ? t('cityPopulation', { count: formatNumber(city.population) }) : '',
        city.companies_total ? t('cityCompanies', { count: `${city.companies_capped ? '+' : ''}${formatNumber(city.companies_total)}` }) : '',
    ].filter(Boolean).join(' · ')
}

// The order is the one of the whole list (no move while searching)
const canMove = (city: AdminCity, step: number) => !search.value && cities.value[cities.value.indexOf(city) + step] !== undefined
const run = async (task: () => Promise<{ success: boolean, error?: string, dataError?: string }>, done = '') => {
    busy.value = true
    try {
        const res = await task()
        if (!res.success) return showFailure(t(res.error || 'error'))
        if (res.dataError) return showFailure(t(res.dataError))
        if (done) showSuccess(t(done))
    } finally { busy.value = false }
}

const move = (city: AdminCity, step: number) => run(() => {
    const ids = cities.value.map(c => c.id)
    const from = ids.indexOf(city.id)
    ids.splice(from + step, 0, ...ids.splice(from, 1))
    return reorder(ids)
})
const togglePublished = (city: AdminCity) => run(() => updateCity(city.id, { published: !city.published }), 'citySaved')
const refresh = (city: AdminCity) => run(() => refreshCity(city.id), 'cityRefreshed')

const remove = async (city: AdminCity) => {
    if (!(await showConfirm(t('cityDeleteConfirm', { name: city.name }), { okLabel: t('dialogDelete') }))) return
    const res = await removeCity(city.id)
    await showResult(res, t('cityDeleted'), t('deleteFailed'))
}

// Fresh list each time the modal opens
watch(() => props.show, open => open && fetchCities(), { immediate: true })
</script>

<style scoped>
.city-rows {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--field-line);
    overflow-y: auto;
    overscroll-behavior: contain;
}

.city-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    padding: 0.9rem 1rem;
    border-bottom: 1px solid var(--line);
}

.city-row__main {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
}

.city-row p {
    margin: 0;
}

.city-row__code,
.city-row__meta {
    color: var(--paper-muted);
}

.city-row__status {
    margin-left: 0.5rem;
    padding: 0.1rem 0.5rem;
    background: var(--panel);
    color: var(--paper-muted);
}

.city-row__status.is-on {
    background: rgba(126, 230, 168, 0.12);
    color: var(--mint);
}

.city-row__similar {
    color: var(--mint);
}

.city-row__similar.is-high,
.city-row__warn {
    color: var(--accent-yellow);
}

.city-row__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.35rem;
}

.city-rows__empty {
    padding: 3rem 1rem;
    background: var(--panel);
    color: var(--paper-muted);
    text-align: center;
}

/* Phone: one card per city, its buttons under its texts */
@media (max-width: 700px) {
    .city-row {
        grid-template-columns: minmax(0, 1fr);
        padding: 0.9rem 0.25rem;
    }

    .city-row__actions {
        justify-content: flex-start;
    }
}
</style>
