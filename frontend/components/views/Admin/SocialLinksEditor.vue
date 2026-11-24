<template>
    <!-- Social links of the footer: an ordered list, each line a network of the list and its address ("Autre": a name too) -->
    <section class="social-links is-wide" aria-labelledby="social-links-title">
        <p id="social-links-title" class="text-label">{{ t('socialTitle') }}</p>
        <p class="social-links__hint text-body-s">{{ t('socialHint') }}</p>
        <p v-if="!rows.length" class="social-links__hint text-body-s">{{ t('socialEmpty') }}</p>

        <ol v-else class="social-links__list">
            <li v-for="(row, i) in rows" :key="row.key" class="social-links__row">
                <span class="social-links__icon" aria-hidden="true"><i :class="iconOf(row.network)" /></span>

                <div class="form-group social-links__network">
                    <label :for="`social-network-${row.key}`">{{ t('socialNetwork') }}</label>
                    <FormInput :id="`social-network-${row.key}`" v-model="row.network" :options="options"
                        :title="t('socialNetwork')" @change="row.touched = false" />
                </div>

                <div v-if="row.network === 'other'" class="form-group social-links__label">
                    <label :for="`social-label-${row.key}`">{{ t('socialLabel') }}</label>
                    <FormInput :id="`social-label-${row.key}`" v-model="row.label" maxlength="40" placeholder="Codepen"
                        :title="t('socialLabel')" autocomplete="off" @blur="row.touched = true" />
                </div>

                <!-- Text, not url: an address without https:// or a WhatsApp number is completed on save -->
                <div class="form-group social-links__url">
                    <label :for="`social-url-${row.key}`">{{ t('socialUrl') }}</label>
                    <FormInput :id="`social-url-${row.key}`" v-model="row.url" type="text" inputmode="url" :placeholder="placeholderOf(row.network)"
                        :title="t('socialUrl')" autocomplete="off" :aria-invalid="!!errorOf(row)"
                        :aria-describedby="errorOf(row) ? `social-error-${row.key}` : undefined" @blur="row.touched = true" />
                </div>

                <div class="social-links__actions">
                    <IconButton icon="chevron-up" :label="t('socialUp')" :disabled="i === 0" @click="move(i, -1)" />
                    <IconButton icon="chevron-down" :label="t('socialDown')" :disabled="i === rows.length - 1" @click="move(i, 1)" />
                    <IconButton icon="trash" variant="danger" :label="t('socialRemove')" @click="rows.splice(i, 1)" />
                </div>

                <p v-if="errorOf(row)" :id="`social-error-${row.key}`" class="social-links__error text-body-s" role="alert">{{ t(errorOf(row)) }}</p>
            </li>
        </ol>

        <HeroButton type="button" iconClass="fas fa-plus" :label="t('socialAdd')" @click="add" />
    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import IconButton from '@/components/ui/Button/IconButton.vue'
import FormInput from '@/components/ui/Form/FormInput.vue'
import { useLang } from '@/composables/useLang'
import type { SocialLink } from '@/utils/socialNetworks'
import { SOCIAL_NETWORKS, normalizeSocialUrl, socialLinkError, socialLinksOf } from '@/utils/socialNetworks'

// A line of the list: the link, a key for Vue, and "touched" once left (its problem shown from then on)
type Row = { key: number, network: string, url: string, label: string, touched: boolean }

const { getTranslation: t } = useLang()
const rows = ref<Row[]>([])
const showAll = ref(false)
let nextKey = 0

// Networks of the list, in the order of utils/socialNetworks.ts ("Autre" translated)
const options = computed(() => Object.entries(SOCIAL_NETWORKS)
    .map(([value, network]) => ({ value, label: value === 'other' ? t('socialOther') : network.label })))
const iconOf = (network: string) => SOCIAL_NETWORKS[network]?.icon ?? 'fa-solid fa-link'
const placeholderOf = (network: string) => SOCIAL_NETWORKS[network]?.placeholder ?? 'https://...'

// Problem of a line (a key of the translations), once it was left or on save
const linkOf = (row: Row): SocialLink => ({ network: row.network, url: row.url, ...(row.network === 'other' ? { label: row.label } : {}) })
const errorOf = (row: Row) => (row.touched || showAll.value) && (row.url.trim() || row.network === 'other') ? socialLinkError(linkOf(row)) : ''

const add = () => rows.value.push({ key: nextKey++, network: 'linkedin', url: '', label: '', touched: false })
const move = (index: number, step: number) => {
    const [row] = rows.value.splice(index, 1)
    if (row) rows.value.splice(index + step, 0, row)
}

// Lines from the saved JSON (when the modal opens)
const load = (json: string) => {
    showAll.value = false
    rows.value = socialLinksOf(json).map(link => ({ key: nextKey++, network: link.network, url: link.url, label: link.label ?? '', touched: false }))
}

// The list to save (empty lines left out, addresses completed), or null when a line is wrong (its problem shown)
const collect = (): SocialLink[] | null => {
    rows.value = rows.value.filter(row => row.url.trim() || (row.network === 'other' && row.label.trim()))
    showAll.value = true
    if (rows.value.some(row => socialLinkError(linkOf(row)))) return null
    return rows.value.map(row => ({ ...linkOf(row), url: normalizeSocialUrl(row.network, row.url) }))
}

defineExpose({ load, collect })
</script>

<style scoped>
/* The title, a hint, the lines one under the other (a thin rule between them), then "Add a network" */
.social-links {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--line);
}

.social-links p {
    margin: 0;
}

.social-links__hint {
    color: var(--fg-muted);
}

.social-links__list {
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
}

/* A line: icon, network, (name), address, buttons; they wrap on a narrow screen */
.social-links__row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem 1rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--line);
}

.social-links__icon {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.75rem;
    color: var(--mint);
    font-size: 1.25rem;
}

.social-links__network {
    flex: 1 1 9rem;
    min-width: 0;
}

.social-links__label {
    flex: 1 1 9rem;
    min-width: 0;
}

.social-links__url {
    flex: 4 1 14rem;
    min-width: 0;
}

.social-links__actions {
    display: flex;
    flex: none;
    gap: 0.25rem;
    margin-left: auto;
    padding-bottom: 0.25rem;
}

.social-links__actions :deep(.icon-btn:disabled) {
    opacity: 0.35;
    cursor: default;
    pointer-events: none;
}

.social-links__error {
    flex-basis: 100%;
    color: #ff8a7d;
}
</style>
