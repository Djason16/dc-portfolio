<template>
    <!-- A city: new (name and postal code only: its data is fetched when it is saved) or changed (meetings, its own paragraph,
         its own questions, projects, keywords), with the data fetched and the similarity with the closest other city page -->
    <FormModal :show="show" :title="t(city ? 'cityEdit' : 'cityAdd')" :message="translatedMessage" :loading="loading" :columns="2"
        @close="close" @submit="submit">
        <div class="form-group">
            <label for="city-name">{{ t('cityName') }}</label>
            <input id="city-name" v-model="form.name" type="text" required :maxlength="CITY_LIMITS.name" :placeholder="t('cityNamePlaceholder')" :title="t('cityName')" />
        </div>
        <div class="form-group">
            <label for="city-postal">{{ t('cityPostalCode') }}</label>
            <input id="city-postal" v-model="form.postal_code" type="text" inputmode="numeric" maxlength="5" pattern="\d{2,5}"
                :placeholder="t('cityPostalCodePlaceholder')" :title="t('cityPostalCode')" />
        </div>
        <p v-if="!city" class="form-group is-wide city-form__help text-body-s">{{ loading ? t('cityAdding') : t('cityAddHelp') }}</p>

        <template v-if="city">
            <div class="form-group is-wide city-form__data text-body-s">
                <span class="eyebrow">{{ t('cityData') }}</span>
                <span>{{ dataLine }}</span>
                <span v-if="city.similarity?.closest" :class="{ 'is-high': city.similarity.percent >= SIMILARITY_LIMIT }">
                    {{ t(city.similarity.percent >= SIMILARITY_LIMIT ? 'citySimilarityHigh' : 'citySimilarity', { percent: String(city.similarity.percent).replace('.', ','), name: city.similarity.closest }) }}
                </span>
            </div>
            <div class="form-group">
                <label for="city-meets">{{ t('cityMeets') }}</label>
                <select id="city-meets" v-model="form.meets_in_person" :title="t('cityMeets')">
                    <option value="">{{ t('cityMeetsAuto') }}</option>
                    <option value="1">{{ t('cityMeetsYes') }}</option>
                    <option value="0">{{ t('cityMeetsNo') }}</option>
                </select>
            </div>
            <div class="form-group">
                <label for="city-keywords">{{ t('cityKeywords') }}</label>
                <input id="city-keywords" v-model="form.keywords" type="text" :maxlength="CITY_LIMITS.keywords" :placeholder="t('cityKeywordsPlaceholder')" :title="t('cityKeywordsHelp')" />
            </div>
            <div class="form-group is-wide">
                <label for="city-intro">{{ t('cityIntro') }}</label>
                <textarea id="city-intro" v-model="form.intro" rows="5" :maxlength="CITY_LIMITS.intro" :placeholder="t('cityIntroPlaceholder')" :title="t('cityIntroHelp')"></textarea>
            </div>
            <template v-for="(entry, i) in form.faq" :key="i">
                <div class="form-group">
                    <label :for="`city-faq-q${i}`">{{ t('cityFaqQuestion', { n: i + 1 }) }}</label>
                    <input :id="`city-faq-q${i}`" v-model="entry.q" type="text" :maxlength="CITY_LIMITS.question" :placeholder="t('cityFaqQuestionPlaceholder')" :title="t('cityFaqQuestion', { n: i + 1 })" />
                </div>
                <div class="form-group">
                    <label :for="`city-faq-a${i}`">{{ t('cityFaqAnswer', { n: i + 1 }) }}</label>
                    <input :id="`city-faq-a${i}`" v-model="entry.a" type="text" :maxlength="CITY_LIMITS.answer" :placeholder="t('cityFaqAnswerPlaceholder')" :title="t('cityFaqAnswer', { n: i + 1 })" />
                </div>
            </template>
            <div class="form-group is-wide">
                <label for="city-projects">{{ t('cityProjects') }}</label>
                <TagPicker id="city-projects" v-model="form.projects" :options="projectOptions" :placeholder="t('cityProjectsPlaceholder')" :remove-label="t('delete')" />
            </div>
        </template>
    </FormModal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, reactive, ref, watch } from 'vue'
import TagPicker from '@/components/ui/Form/TagPicker.vue'
import FormModal from '@/components/ui/Modal/FormModal.vue'
import { useCities, type AdminCity } from '@/composables/useCities'
import { useLang } from '@/composables/useLang'
import { useMessage } from '@/composables/useMessage'
import { useProjects } from '@/composables/useProjects'
import { CITY_LIMITS, checkCityChanges } from '@/utils/cities/cityRules'
import { SIMILARITY_LIMIT } from '@/utils/cities/citySimilarity'
import { formatDuration, formatKm, formatNumber } from '@/utils/cities/cityText'
import { MESSAGE_DELAY, afterMessage } from '@/utils/feedback'

const props = defineProps({
    show: Boolean,
    // City to change (from admin > Villes); none = a new city
    city: { type: Object as PropType<AdminCity | null>, default: null },
})
const emit = defineEmits(['close', 'saved'])

const { getTranslation: t } = useLang()
const { addCity, updateCity } = useCities()
const { projects, fetchProjects } = useProjects()
const { translatedMessage, showMessage, clearMessage } = useMessage()
const loading = ref(false)

// Two questions of its own at most in the form (empty pairs are left out)
const FAQ_ROWS = 2
const empty = () => ({ name: '', postal_code: '', meets_in_person: '', intro: '', keywords: '', projects: [] as string[],
    faq: Array.from({ length: FAQ_ROWS }, () => ({ q: '', a: '' })) })
const form = reactive(empty())

const projectOptions = computed(() => projects.value.map(project => ({ value: project.name, label: project.name })))

const dataLine = computed(() => {
    const c = props.city
    if (!c?.data_updated_at) return t('cityNoData')
    return [
        `${c.insee_code} · ${c.department_name} · ${c.region_name}`,
        c.distance_km !== null && c.drive_minutes !== null ? `${formatKm(c.distance_km)} · ${formatDuration(c.drive_minutes)}${c.travel_source === 'estimate' ? ` (${t('cityTravelEstimate')})` : ''}` : '',
        c.population ? t('cityPopulation', { count: formatNumber(c.population) }) : '',
        c.companies_total ? t('cityCompanies', { count: formatNumber(c.companies_total) }) : '',
        c.neighbours.slice(0, 4).map(n => n.name).join(', '),
        t('cityDataDate', { date: new Date(c.data_updated_at).toLocaleDateString('fr-FR') }),
    ].filter(Boolean).join(' · ')
})

watch(() => props.show, open => {
    if (!open) return
    const c = props.city
    Object.assign(form, empty(), c ? {
        name: c.name, postal_code: c.postal_code, intro: c.intro, keywords: c.keywords, projects: [...c.projects],
        meets_in_person: c.meets_in_person === null ? '' : c.meets_in_person ? '1' : '0',
        faq: Array.from({ length: FAQ_ROWS }, (_, i) => ({ q: c.faq[i]?.q ?? '', a: c.faq[i]?.a ?? '' })),
    } : {})
    clearMessage()
    if (c) fetchProjects()
}, { immediate: true })

const close = () => {
    loading.value = false
    clearMessage()
    emit('close')
}

const submit = async () => {
    clearMessage()
    const changes = props.city
        ? { name: form.name, postal_code: form.postal_code, intro: form.intro, keywords: form.keywords, projects: form.projects, faq: form.faq,
            meets_in_person: form.meets_in_person === '' ? null : form.meets_in_person === '1' }
        : { name: form.name, postal_code: form.postal_code }
    // Same rules as the API: the message at once, without a call
    const checked = checkCityChanges(changes)
    if ('error' in checked) return showMessage('error', t(checked.error))
    loading.value = true
    try {
        const res = props.city ? await updateCity(props.city.id, changes) : await addCity(form.name, form.postal_code)
        if (!res.success) return showMessage('error', t(res.error || 'error'))
        showMessage(res.dataError ? 'error' : 'success', t(res.dataError || 'citySaved'), MESSAGE_DELAY)
        await afterMessage()
        close()
        emit('saved')
    } finally { loading.value = false }
}
</script>

<style scoped>
.city-form__help {
    margin: 0;
    color: var(--paper-muted);
}

.city-form__data {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.9rem 1rem;
    background: var(--panel);
    color: var(--paper-muted);
}

.city-form__data .is-high {
    color: var(--accent-yellow);
}
</style>
