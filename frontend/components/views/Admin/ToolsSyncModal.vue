<template>
    <!-- Admin > Outils DC: the tools on sale (a released tool is added by itself, every hour), the last sync and its report,
         and « Synchroniser maintenant » (server/helpers/ToolsSyncHelper.ts) -->
    <TableModal :show="show" :title="t('adminToolsSync')" max-width="900px" @close="emit('close')">
        <p class="tools-sync__help text-body-s">{{ t('toolsSyncHelp') }}</p>

        <ul class="tools-sync__list">
            <li v-for="product in status.products" :key="product.id" class="tools-sync__row">
                <span class="text-display-xs">{{ product.name }}</span>
                <span class="tools-sync__meta text-body-s">
                    {{ t('toolsSyncMin', { version: product.minVersion }) }}<template v-if="product.priceMonth"> · {{ euros(product.priceMonth) }} / {{ t('toolsSyncMonth') }}</template>
                </span>
            </li>
        </ul>

        <div class="tools-sync__last text-body-s">
            <span class="eyebrow">{{ t('toolsSyncLast') }}</span>
            <span v-if="!status.last">{{ t('toolsSyncNever') }}</span>
            <template v-else>
                <span>{{ date(status.last.at) }} · {{ t(status.last.ok ? 'toolsSyncOk' : 'toolsSyncFailed') }}</span>
                <span v-if="status.last.error" class="tools-sync__error">{{ status.last.error }}</span>
                <span v-for="(line, i) in status.last.lines" :key="i">{{ line }}</span>
                <span v-if="status.last.ok && !status.last.lines.length">{{ t('toolsSyncNothing') }}</span>
            </template>
        </div>

        <template #actions>
            <HeroButton primary iconClass="fas fa-rotate" :label="t(busy ? 'toolsSyncRunning' : 'toolsSyncNow')" :disabled="busy" @click="runNow" />
        </template>
    </TableModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import TableModal from '@/components/ui/Modal/TableModal.vue'
import { useLang } from '@/composables/useLang'
import { api } from '@/utils/api'
import { showResult } from '@/utils/dialog'

type Status = { last: { at: string, ok: boolean, error: string, lines: string[] } | null, products: { id: string, name: string, minVersion: string, priceMonth: number | null }[] }

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])
const { getTranslation: t } = useLang()
const status = ref<Status>({ last: null, products: [] })
const busy = ref(false)

const date = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
const euros = (cents: number) => `${(cents / 100).toLocaleString('fr-FR')} €`

const load = async () => {
    const res = await api.get('/tools/sync')
    if (res.success) status.value = { last: res.last, products: res.products }
}

const runNow = async () => {
    busy.value = true
    const res = await api.post('/tools/sync', {})
    busy.value = false
    if (res.success) status.value = { last: res.last, products: res.products }
    await showResult(res.success && res.report?.ok ? res : { success: false }, t('toolsSyncOk'), t('toolsSyncFailed'))
}

watch(() => props.show, open => open && load(), { immediate: true })
</script>

<style scoped>
.tools-sync__help,
.tools-sync__meta {
    margin: 0;
    color: var(--paper-muted);
}

.tools-sync__list {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--field-line);
}

.tools-sync__row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.4rem 1rem;
    padding: 0.8rem 0.25rem;
    border-bottom: 1px solid var(--line);
}

.tools-sync__last {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 1rem;
    background: var(--panel);
    color: var(--paper-muted);
}

.tools-sync__error {
    color: var(--accent-yellow);
}
</style>
