<!-- Admin tool "My video room": the personal room /room/ (always the same address, visitors knock, the admin lets them in):
open or closed, the address to share, the button that enters it (the admin is its host there) -->
<template>
    <TableModal :show="show" :title="t('adminLounge')" max-width="44rem" min-width="0" @close="emit('close')">
        <div class="lounge-admin">
            <p class="lounge-admin__text text-body">{{ t('loungeAdminText') }}</p>
            <button type="button" role="switch" class="lounge-admin__switch text-label" :aria-checked="open === true" :title="t('loungeOpenSwitch')"
                :disabled="open === null || saving" @click="toggle">
                <i class="text-display-s" :class="open ? 'fas fa-toggle-on' : 'fas fa-toggle-off'" aria-hidden="true"></i>
                {{ t(open === false ? 'loungeIsClosed' : 'loungeIsOpen') }}
            </button>
            <div class="lounge-admin__share">
                <label class="text-label" for="lounge-admin-url">{{ t('loungeShareLabel') }}</label>
                <div class="lounge-admin__url">
                    <input id="lounge-admin-url" class="lounge-admin__input text-body" type="text" readonly :value="url" :title="url"
                        @focus="($event.target as HTMLInputElement).select()" />
                    <HeroButton iconClass="fas fa-copy" :label="t(copied ? 'loungeCopied' : 'loungeCopy')" @click="copy" />
                </div>
            </div>
        </div>
        <template #actions>
            <HeroButton primary iconClass="fas fa-video" :href="withTrailingSlash('/room')" :label="t('loungeEnter')" />
        </template>
    </TableModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import TableModal from '@/components/ui/Modal/TableModal.vue'
import { useLang } from '@/composables/useLang'
import { api } from '@/utils/api'
import { withTrailingSlash } from '@/utils/pathHelpers'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])
const { getTranslation: t } = useLang()

const open = ref<boolean | null>(null)
const saving = ref(false)
const copied = ref(false)
const url = computed(() => (import.meta.client ? `${window.location.origin}${withTrailingSlash('/room')}` : ''))

// Read each time the tool opens
watch(() => props.show, async (shown) => {
    if (!shown) return
    const res = await api.get('/lounge')
    open.value = res.success ? Boolean(res.lounge.open) : null
}, { immediate: true })

const toggle = async () => {
    saving.value = true
    const res = await api.put('/lounge/open', { open: !open.value })
    if (res.success) open.value = Boolean(res.open)
    saving.value = false
}

const copy = async () => {
    try {
        await navigator.clipboard.writeText(url.value)
        copied.value = true
        setTimeout(() => { copied.value = false }, 2000)
    } catch { /* the address stays selectable in the field */ }
}
</script>

<style scoped>
.lounge-admin {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    text-align: left;
}

.lounge-admin__text {
    max-width: 60ch;
    margin: 0;
    color: var(--fg-muted);
}

.lounge-admin__switch {
    display: inline-flex;
    align-items: center;
    align-self: flex-start;
    gap: 0.6rem;
    min-height: 2.75rem;
    padding: 0;
    border: 0;
    background: none;
    color: var(--fg);
    cursor: pointer;
}

.lounge-admin__switch i {
    color: var(--fg-muted);
}

.lounge-admin__switch[aria-checked='true'] i {
    color: var(--accent);
}

.lounge-admin__switch:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.lounge-admin__share,
.lounge-admin__url {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.lounge-admin__url {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.lounge-admin__input {
    box-sizing: border-box;
    flex: 1 1 12rem;
    min-width: 0;
    min-height: 2.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--fg);
}
</style>
