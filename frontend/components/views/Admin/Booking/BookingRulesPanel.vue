<!-- Rules tab of the admin tool Bookings: open or closed, notice, horizon, break between two appointments, gap between two starts
     (one row, a click on a value changes it) -->
<template>
    <div class="booking-rules">
        <EditableTable :items="items" :columns="columns" :show-actions="false" :empty-message="t('loading')" @update="update" />
        <p class="booking-rules__hint text-body-s">{{ t('bookingRulesHint') }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import EditableTable from '@/components/ui/Table/EditableTable.vue'
import { useBookingAdmin } from '@/composables/useBookingAdmin'
import { useLang } from '@/composables/useLang'
import { showResult } from '@/utils/dialog'

const { getTranslation: t } = useLang()
const { rules, saveRules } = useBookingAdmin()

const items = computed(() => (rules.value ? [{ ...rules.value, id: rules.value.id || 'rules' }] : []))

// Number fields: their name and their limits (the same as the server: BookingSettingsController)
const NUMBERS = [
    { key: 'noticeHours', labelKey: 'bookingRuleNotice', min: 0, max: 720 },
    { key: 'horizonDays', labelKey: 'bookingRuleHorizon', min: 1, max: 365 },
    { key: 'bufferMinutes', labelKey: 'bookingRuleBuffer', min: 0, max: 240 },
    { key: 'stepMinutes', labelKey: 'bookingRuleStep', min: 5, max: 240 },
]

const columns = computed(() => [
    { key: 'enabled', label: t('bookingRuleEnabled'), type: 'select', mobile: 'labeled', editValue: (r: Record<string, any>) => r.enabled,
        options: [{ value: true, label: t('yes') }, { value: false, label: t('no') }], formatter: (r: Record<string, any>) => t(r.enabled ? 'yes' : 'no') },
    ...NUMBERS.map(n => ({ key: n.key, label: t(n.labelKey), inputType: 'number', min: String(n.min), max: String(n.max), mobile: 'labeled' })),
])

const update = async ({ field, value }: { field: string, value: any }) => {
    const next = field === 'enabled' ? value === true || value === 'true' : Number(value)
    const res = await saveRules({ [field]: next })
    await showResult(res, t('saveSuccess'), t(res.error ?? '') || t('saveFailed'))
}
</script>

<style scoped>
.booking-rules {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.booking-rules__hint {
    max-width: 60ch;
    margin: 0;
    color: var(--fg-muted);
}
</style>
