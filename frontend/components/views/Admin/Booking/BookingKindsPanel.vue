<!-- Kinds tab of the admin tool Bookings: a short form adds a kind of appointment, the table below changes (click a cell) or deletes them.
     The English name and description follow the French ones a moment after typing (MyMemory), still editable. -->
<template>
    <div class="booking-kinds-admin">
        <section class="kind-add">
            <p class="eyebrow">{{ t('bookingKindAddTitle') }}</p>
            <form class="kind-add__form" @submit.prevent="add">
                <div v-for="field in FIELDS" :key="field.model" class="form-group" :class="{ 'is-wide': field.wide }">
                    <label :for="`kind-${field.model}`">{{ t(field.labelKey) }}
                        <span v-if="field.model === 'nameEn' && auto.status.nameFr" class="auto-translate">{{ t(auto.status.nameFr === 'done' ? 'translateDone' : 'translating') }}</span></label>
                    <select v-if="field.model === 'mode'" :id="`kind-${field.model}`" v-model="form.mode">
                        <option v-for="option in modeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                    <input v-else :id="`kind-${field.model}`" v-model="form[field.model]" :type="field.type" :min="field.min" :max="field.max"
                        :required="field.required" :maxlength="field.maxlength" />
                </div>
                <div class="kind-add__end">
                    <HeroButton type="submit" primary iconClass="fas fa-plus" :label="t('bookingKindAdd')" :disabled="saving" />
                    <p class="kind-add__hint text-body-s">{{ t('bookingKindHint') }}</p>
                </div>
            </form>
        </section>

        <EditableTable :items="kinds" :columns="columns" :actions-label="t('actions')" :delete-label="t('delete')"
            :empty-message="t('bookingKindsNone')" @update="update" @delete="remove" />
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import EditableTable from '@/components/ui/Table/EditableTable.vue'
import { useAutoTranslate } from '@/composables/useAutoTranslate'
import { useBookingAdmin } from '@/composables/useBookingAdmin'
import { useLang } from '@/composables/useLang'
import { MODE_KEYS } from '@/utils/booking'
import { showConfirm, showFailure, showResult, showSuccess } from '@/utils/dialog'

const { getTranslation: t } = useLang()
const { kinds, addKind, updateKind, removeKind } = useBookingAdmin()

// Fields of the form, in the order of the grid (two per line on a computer)
const FIELDS: { model: string, labelKey: string, type?: string, required?: boolean, min?: number, max?: number, maxlength?: number, wide?: boolean }[] = [
    { model: 'nameFr', labelKey: 'bookingKindNameFr', type: 'text', required: true, maxlength: 120 },
    { model: 'nameEn', labelKey: 'bookingKindNameEn', type: 'text', maxlength: 120 },
    { model: 'descriptionFr', labelKey: 'bookingKindDescriptionFr', type: 'text', maxlength: 500 },
    { model: 'descriptionEn', labelKey: 'bookingKindDescriptionEn', type: 'text', maxlength: 500 },
    { model: 'duration', labelKey: 'bookingKindDuration', type: 'number', required: true, min: 5, max: 480 },
    { model: 'mode', labelKey: 'bookingKindMode' },
    { model: 'location', labelKey: 'bookingKindLocation', type: 'text', maxlength: 255, wide: true },
]
const empty = () => ({ nameFr: '', nameEn: '', descriptionFr: '', descriptionEn: '', duration: '30', mode: 'phone', location: '' })
const form = reactive<Record<string, string>>(empty())
const saving = ref(false)
// French -> English, a moment after typing
const auto = useAutoTranslate(form, [['nameFr', 'nameEn'], ['descriptionFr', 'descriptionEn']])

const modeOptions = computed(() => Object.entries(MODE_KEYS).map(([value, key]) => ({ value, label: t(key) })))
const yesNo = computed(() => [{ value: true, label: t('yes') }, { value: false, label: t('no') }])

// On a phone: the French name as the title of the card, how long and how as tags, the rest opened by the arrow
const columns = computed(() => [
    { key: 'nameFr', label: t('bookingKindNameFr') },
    { key: 'duration', label: t('bookingKindDuration'), inputType: 'number', min: '5', max: '480', mobile: 'tag', formatter: (k: Record<string, any>) => t('bookMinutes', { minutes: k.duration }) },
    { key: 'mode', label: t('bookingKindMode'), type: 'select', options: modeOptions.value, mobile: 'tag', formatter: (k: Record<string, any>) => t(MODE_KEYS[k.mode] ?? '') },
    { key: 'active', label: t('bookingKindActive'), type: 'select', options: yesNo.value, mobile: 'labeled', editValue: (k: Record<string, any>) => k.active,
        formatter: (k: Record<string, any>) => t(k.active ? 'yes' : 'no') },
    { key: 'nameEn', label: t('bookingKindNameEn'), detail: true },
    { key: 'descriptionFr', label: t('bookingKindDescriptionFr'), inputType: 'textarea', detail: true, formatter: (k: Record<string, any>) => k.descriptionFr || '-' },
    { key: 'descriptionEn', label: t('bookingKindDescriptionEn'), inputType: 'textarea', detail: true, formatter: (k: Record<string, any>) => k.descriptionEn || '-' },
    { key: 'location', label: t('bookingKindLocation'), detail: true, formatter: (k: Record<string, any>) => k.location || '-' },
    { key: 'sortOrder', label: t('bookingKindOrder'), inputType: 'number', detail: true },
])

const add = async () => {
    if (!form.nameFr!.trim()) return
    saving.value = true
    const res = await addKind({ ...form, duration: Number(form.duration), mode: form.mode as 'phone' })
    saving.value = false
    if (!res.success) return showFailure(t(res.error ?? '') || t('saveFailed'))
    Object.assign(form, empty())
    auto.reset()
    showSuccess(t('bookingKindAdded'))
}

const update = async ({ item, field, value }: { item: Record<string, any>, field: string, value: any }) => {
    if (value === item[field]) return
    const next = field === 'active' ? value === true || value === 'true' : ['duration', 'sortOrder'].includes(field) ? Number(value) : value
    const res = await updateKind(item.id, { [field]: next })
    await showResult(res, t('saveSuccess'), t(res.error ?? '') || t('saveFailed'))
}

const remove = async (item: Record<string, any>) => {
    if (!(await showConfirm(t('bookingKindDeleteConfirm', { name: item.nameFr }), { okLabel: t('dialogDelete') }))) return
    const res = await removeKind(item.id)
    await showResult(res, t('deleteSuccess'), t('deleteFailed'))
}
</script>

<style scoped>
.booking-kinds-admin {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* The form: two fields per line on a computer, one on a phone; the button and the hint under them */
.kind-add {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 1.75rem;
    border-bottom: 1px solid var(--line);
}

.kind-add .eyebrow {
    margin: 0;
}

.kind-add__form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 1.5rem;
}

.kind-add__form .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    color: var(--fg-muted);
}

.kind-add__form .is-wide,
.kind-add__end {
    grid-column: 1 / -1;
}

.kind-add__end {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1.5rem;
}

.kind-add__hint {
    flex: 1 1 18rem;
    margin: 0;
    color: var(--paper-muted);
}

@media (max-width: 600px) {
    .kind-add__form {
        grid-template-columns: 1fr;
    }
}
</style>
