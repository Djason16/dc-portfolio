<template>
    <!-- Licences of the DC tools, made simple: four figures, then who has a key, for which tools and until when;
         the technical details (computers, version, note) under each row; the rare actions at the bottom -->
    <TableModal :show="show" :title="t('licensesTitle')" max-width="1200px" v-model:search="search"
        :search-placeholder="t('searchLicenses')" @close="emit('close')">
        <template #filters>
            <select class="licenses-filter" v-model="kind" :aria-label="t('licenseKind')" :title="t('licenseKind')">
                <option value="">{{ t('licenseKindAll') }}</option>
                <option v-for="k in KINDS" :key="k" :value="k">{{ t(`licenseKind_${k}`) }}</option>
            </select>
        </template>

        <ul class="licenses-figures">
            <li v-for="(figure, i) in figures" :key="figure.key" class="licenses-figure">
                <span class="licenses-figure__label eyebrow">{{ padIndex(i) }} · {{ t(figure.key) }}</span>
                <span class="licenses-figure__value text-display-m">{{ figure.value }}</span>
            </li>
        </ul>

        <EditableTable :items="shown" :columns="columns" :show-delete="false" :actions-label="t('actions')"
            :empty-message="t('noLicensesFound')" :per-page="8" @update="handleUpdate">
            <template #actions="{ item }">
                <IconButton icon="key" :label="t('licenseNewKey')" @click="renew(item)" />
            </template>
        </EditableTable>

        <template #actions>
            <HeroButton iconClass="fas fa-code-branch" :label="t('licenseMinVersions')" @click="editVersion" />
            <HeroButton iconClass="fas fa-euro-sign" :label="t('licensePricingButton')" @click="emit('open', 'pricing')" />
            <HeroButton primary iconClass="fas fa-gift" :label="t('adminGiftLicense')" @click="emit('open', 'license')" />
        </template>
    </TableModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import EditableTable from '@/components/ui/Table/EditableTable.vue'
import TableModal from '@/components/ui/Modal/TableModal.vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import IconButton from '@/components/ui/Button/IconButton.vue'
import { padIndex } from '@/utils/display'
import { useLang } from '@/composables/useLang'
import { useModalData } from '@/composables/useLiveData'
import { useLicenses } from '@/composables/useLicenses'
import { showAlert, showChoice, showConfirm, showFailure, showPrompt, showResult, showSuccess } from '@/utils/dialog'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'open'])
const { getTranslation: t } = useLang()
const { search, filtered, licenses, productIds, productNames, fetchLicenses, updateLicense, renewLicense, fetchVersions, setVersion } = useLicenses()

const KINDS = ['paid', 'gift', 'trial'] as const
const kind = ref('')
const DAY = 86400 * 1000
const isActive = (l: Record<string, any>) => l.status === 'active' && !l.expired
const shown = computed(() => filtered.value.filter(l => !kind.value || l.kind === kind.value))

// The four figures: keys working now, subscribers, free trials running, and keys ending within 30 days
const figures = computed(() => {
    const active = licenses.value.filter(isActive)
    const soon = active.filter(l => l.expiresAt && new Date(l.expiresAt).getTime() - Date.now() < 30 * DAY)
    return [
        { key: 'licenseFigureActive', value: active.length },
        { key: 'licenseFigurePaid', value: active.filter(l => l.kind === 'paid').length },
        { key: 'licenseFigureTrials', value: active.filter(l => l.kind === 'trial').length },
        { key: 'licenseFigureSoon', value: soon.length },
    ]
})

const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString() : ''
const day = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : ''
const toolsOf = (ids: string[]) => productIds.value.every(id => ids.includes(id)) ? t('licenseAllTools') : productIds.value.filter(id => ids.includes(id)).map(id => productNames.value[id]).join(' + ')
// In plain words: active (until when), ended, or turned off
const stateOf = (l: Record<string, any>) => l.status === 'revoked' ? t('licenseStatus_revoked')
    : l.expired ? t('licenseExpired') : l.expiresAt ? t('licenseUntil', { date: date(l.expiresAt) }) : t('licenseActiveNoEnd')

// The sets of tools a key can open (sorted ids, like editValue): all the tools first, then one tool, two, three; with many
// tools (over 5), only all of them, each one alone, and the sets the keys already have
const PRODUCT_CHOICES = computed(() => {
    const ids = productIds.value
    const all = ids.length
    const sets = all <= 5
        ? Array.from({ length: 2 ** all - 1 }, (_, i) => ids.filter((_, bit) => (i + 1) & (1 << bit)))
        : [ids, ...ids.map(id => [id]), ...licenses.value.map(l => l.products as string[])]
    const values = sets.sort((a, b) => (a.length === all ? -1 : b.length === all ? 1 : a.length - b.length)).map(set => [...set].sort().join(','))
    return [...new Set(values)]
})
const columns = computed(() => [
    { key: 'email', label: t('licensePerson'), disabled: true, mobile: 'plain', formatter: (l: Record<string, any>) => l.name ? `${l.name} · ${l.email}` : l.email },
    {
        key: 'products', label: t('licenseProducts'), type: 'select', mobile: 'plain', formatter: (l: Record<string, any>) => toolsOf(l.products),
        editValue: (l: Record<string, any>) => [...l.products].sort().join(','), options: PRODUCT_CHOICES.value.map(value => ({ value, label: toolsOf(value.split(',')) })),
    },
    { key: 'kind', label: t('licenseKind'), disabled: true, mobile: 'tag', formatter: (l: Record<string, any>) => t(`licenseKind_${l.kind}`) },
    {
        key: 'status', label: t('licenseStatus'), type: 'select', mobile: 'tag', formatter: stateOf, editValue: (l: Record<string, any>) => l.status,
        options: ['active', 'revoked'].map(value => ({ value, label: t(value === 'active' ? 'licenseTurnOn' : 'licenseTurnOff') })),
    },
    { key: 'expiresAt', label: t('licenseExpires'), inputType: 'date', detail: true, formatter: (l: Record<string, any>) => date(l.expiresAt) || t('licenseNoEnd'), editValue: (l: Record<string, any>) => day(l.expiresAt) },
    { key: 'keyEnd', label: t('licenseKeyEnd'), disabled: true, detail: true, formatter: (l: Record<string, any>) => `…${l.keyEnd}` },
    { key: 'lastCheckAt', label: t('licenseLastCheck'), disabled: true, detail: true, formatter: (l: Record<string, any>) => [date(l.lastCheckAt), l.lastVersion && `v${l.lastVersion}`, l.machines && t('licenseComputers', { count: l.machines })].filter(Boolean).join(' · ') || '-' },
    { key: 'note', label: t('licenseNote'), detail: true, formatter: (l: Record<string, any>) => l.note || '-' },
])

const handleUpdate = async ({ item, field, value }: { item: Record<string, any>, field: string, value: any }) => {
    const next = field === 'products' ? String(value).split(',') : field === 'expiresAt' && !value ? null : value
    const res = await updateLicense(item.id, { [field]: next })
    await showResult(res, t('saveSuccess'), t(res.error || 'saveFailed'))
}

// A new key for a lost one: the old one stops at once; the new one is e-mailed, and shown here once
const renew = async (item: Record<string, any>) => {
    if (!(await showConfirm(t('licenseNewKeyConfirm', { email: item.email })))) return
    const res = await renewLicense(item.id)
    if (!res.success) return showFailure(t('saveFailed'))
    await showAlert(t(res.emailSent ? 'licenseKeyCreated' : 'licenseKeyNotSent', { email: item.email, key: res.key }))
}

// Lowest version still allowed for a tool (older ones show "Update required")
const editVersion = async () => {
    const res = await fetchVersions()
    if (!res.success) return showFailure(t('saveFailed'))
    const tool = await showChoice(t('licenseMinVersionPick'), productIds.value.map(id => ({ value: id, label: `${productNames.value[id]} · ${res.versions[id]}` })))
    if (!tool) return
    const version = await showPrompt(t('licenseMinVersionAsk', { tool: productNames.value[tool as string] ?? '' }), String(res.versions[tool as string] ?? ''))
    if (!version) return
    const saved = await setVersion(tool as string, String(version).trim())
    saved.success ? showSuccess(t('licenseMinVersionSaved')) : showFailure(t(saved.error || 'saveFailed'))
}

useModalData(() => props.show, fetchLicenses, ['dc_licenses'])
</script>

<style scoped>
.licenses-filter {
    max-width: 240px;
}

/* The four figures, in the label + large number style of the site */
.licenses-figures {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    margin: 0 0 1.75rem;
    padding: 0;
    list-style: none;
    background: var(--line);
    border: 1px solid var(--line);
}

.licenses-figure {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
    padding: 1.1rem 1.25rem;
    background: var(--ink-900);
}

.licenses-figure__label {
    color: var(--fg-muted);
}

.licenses-figure__value {
    color: var(--fg);
}

@media (max-width: 720px) {
    .licenses-figures {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
