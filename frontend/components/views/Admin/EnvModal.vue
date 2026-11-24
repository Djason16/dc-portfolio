<template>
    <!-- Variables of the .env file -->
    <TableModal :show="show" :title="t('viewEnvironmentVariables')" max-width="1200px" @close="close">
        <EditableTable :items="formattedItems" :columns="columns" :show-actions="false" :item-key="'key'"
            :empty-message="t('noEnvVars')" @update="handleUpdate" />
    </TableModal>
</template>

<script setup lang="ts">
import { useLang } from '@/composables/useLang'
import { computed, watch } from 'vue'
import EditableTable from '@/components/ui/Table/EditableTable.vue'
import { useEnv } from '@/composables/useEnv'
import TableModal from '@/components/ui/Modal/TableModal.vue'
import { showFailure, showSuccess } from '@/utils/dialog'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])
const lang = useLang()
const { getTranslation: t } = lang
const { envVars, masked, fetchEnvVars, updateEnvVars } = useEnv()

// Variables by part, in the order of .env.example (mode, site, database, admin, emails, payments, bank, e-invoices, translation, area, video room, backup)
const envCategories = {
    mode: ['NODE_ENV'],
    site: ['NUXT_PUBLIC_FRONTEND_DOMAIN'],
    database: ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS'],
    admin: ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'ADMIN_NAME', 'SECURITY_ANSWER'],
    emails: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'MAIL_LOG_ONLY'],
    payments: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    bank: ['BANK_IBAN', 'BANK_BIC'],
    einvoice: ['SUPERPDP_API_URL', 'SUPERPDP_ENV', 'SUPERPDP_CLIENT_ID', 'SUPERPDP_CLIENT_SECRET', 'SUPERPDP_MOCK'],
    translation: ['MYMEMORY_EMAIL'],
    area: ['GOOGLE_MAPS_API_KEY'],
    video: ['STUN_URLS', 'TURN_URLS', 'TURN_USERNAME', 'TURN_CREDENTIAL'],
    backup: ['BACKUP_KEY_SHA256'],
}
const known = new Set(Object.values(envCategories).flat())

// Rows of the table: a title row per part, then its variables (a missing one shows empty: filling it adds it to the file);
// variables of the file not listed above come last, in alphabetical order
const formattedItems = computed(() => {
    if (!envVars.value) return []
    const others = Object.keys(envVars.value).filter(key => !known.has(key)).sort()
    const vars = envVars.value
    const groups: [string, string[]][] = [...Object.entries(envCategories), ...(others.length ? [['others', others] as [string, string[]]] : [])]
    return groups.flatMap(([category, keys]) => [
        { key: `section_${category}`, _section: t(`envGroup_${category}`) },
        ...keys.map(key => ({ key, value: vars[key] ?? '', sensitive: masked.value.has(key) })),
    ])
})

// Text of the first column, built as HTML (the clear name, the name of the variable under it): every part escaped
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c] ?? c)

// Table: a clear name with the name of the variable under it, then its value (click to edit)
const columns = computed(() => [
    {
        key: 'field',
        label: lang.getTranslation('field'),
        disabled: true,
        processHtml: true,
        formatter: (item: Record<string, any>) => `${escapeHtml(known.has(item.key) ? t(`env_${item.key}`) : item.key)}<small class="cell-hint text-body-s">${escapeHtml(item.key)}</small>`,
        tooltip: (item: Record<string, any>) => item.key,
    },
    {
        key: 'value',
        label: lang.getTranslation('value'),
        mobile: 'plain',
        // A secret comes masked from the server (•••• + its last 4 characters): edited from an empty field, typed again in full
        inputType: (item: Record<string, any>) => item.sensitive ? 'password' : 'text',
        editValue: (item: Record<string, any>) => item.sensitive ? '' : item.value,
        formatter: (item: Record<string, any>) => item.value || '-',
        tooltip: (item: Record<string, any>) => item.sensitive ? t('envMaskedHint') : item.value,
    }
])

// Handles updates from the table
const handleUpdate = async ({ item, field, value }: { item: Record<string, any>, field: string, value: any }) => {
    if (!item?.key) return console.error('No item key')
    // A secret left empty (or its masked form) keeps its value: nothing sent
    if (item.sensitive && (value === '' || value === item.value)) return

    try {
        await updateEnvVars({ [item.key]: value }, () => showSuccess(lang.getTranslation('envSaved')))
    } catch (error) {
        // A value refused by the server (Super PDP address...): its own message, else the usual one
        const code = (error as Error).message
        await showFailure(code?.startsWith('env') ? t(code) : t('saveFailed'))
    }
}

// Fetches environment variables when modal opens
watch(() => props.show, val => val && fetchEnvVars())
const close = () => emit('close')
</script>
