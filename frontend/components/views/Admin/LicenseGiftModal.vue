<template>
    <!-- Offered key: who, which tools, for how long; the key is e-mailed at once and shown once here -->
    <FormModal :show="show" :title="t('licenseGiftTitle')" :message="translatedMessage" :loading="loading" :columns="2"
        @close="close" @submit="submit">
        <div class="form-group">
            <label for="gift-email">{{ t('licenseGiftEmail') }}</label>
            <input id="gift-email" v-model="form.email" type="email" required autocomplete="email" :title="t('licenseGiftEmail')" />
        </div>
        <div class="form-group">
            <label for="gift-name">{{ t('licenseGiftName') }}</label>
            <input id="gift-name" v-model="form.name" type="text" autocomplete="name" maxlength="255" :title="t('licenseGiftName')" />
        </div>
        <!-- The tools offered: one tile per tool (its name and what it does), ticked tiles in mint; all of them in one click -->
        <div class="form-group gift-products" role="group" aria-labelledby="gift-products-label">
            <label id="gift-products-label" class="gift-products__label">{{ t('licenseGiftProducts') }}</label>
            <div class="gift-products__grid">
                <label v-for="id in productIds" :key="id" class="gift-tile" :class="{ 'gift-tile--on': form.products.includes(id) }" :title="productNames[id]">
                    <input v-model="form.products" type="checkbox" :value="id" />
                    <span class="gift-tile__text">
                        <span class="gift-tile__name text-label">{{ productNames[id] }}</span>
                        <span class="gift-tile__hint text-body-s">{{ t(`licenseGiftHint_${id}`) }}</span>
                    </span>
                </label>
            </div>
            <button type="button" class="gift-products__all text-label" :title="t('licenseGiftAll')" @click="form.products = [...productIds]">{{ t('licenseGiftAll') }}</button>
        </div>
        <div class="form-group">
            <label for="gift-duration">{{ t('licenseGiftDuration') }}</label>
            <select id="gift-duration" v-model.number="form.months" required :title="t('licenseGiftDuration')">
                <option v-for="months in [1, 3, 12, 0]" :key="months" :value="months">{{ t(`licenseDuration_${months}`) }}</option>
            </select>
        </div>
        <div class="form-group">
            <label for="gift-language">{{ t('licenseGiftLanguage') }}</label>
            <select id="gift-language" v-model="form.language" :title="t('licenseGiftLanguage')">
                <option value="fr">{{ t('languageFr') }}</option>
                <option value="en">{{ t('languageEn') }}</option>
            </select>
        </div>
        <div class="form-group">
            <label for="gift-note">{{ t('licenseGiftNote') }}</label>
            <input id="gift-note" v-model="form.note" type="text" maxlength="500" :title="t('licenseGiftNote')" />
        </div>
    </FormModal>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import FormModal from '@/components/ui/Modal/FormModal.vue'
import { useLang } from '@/composables/useLang'
import { useMessage } from '@/composables/useMessage'
import { useLicenses } from '@/composables/useLicenses'
import { showAlert } from '@/utils/dialog'

defineProps({ show: Boolean })
const emit = defineEmits(['close'])
const { getTranslation: t } = useLang()
const { translatedMessage, showMessage, clearMessage } = useMessage()
const { giftLicense, productIds, productNames, fetchProducts } = useLicenses()
fetchProducts()

const empty = () => ({ email: '', name: '', products: [...productIds.value] as string[], months: 12, language: 'fr', note: '' })
const form = reactive(empty())
const loading = ref(false)
// Every tool ticked by default, once the list of the tools is known
watch(productIds, ids => { if (!form.products.length) form.products = [...ids] })

const close = () => {
    Object.assign(form, empty())
    clearMessage()
    emit('close')
}

const submit = async () => {
    if (!form.products.length) return showMessage('error', t('licenseProductsRequired'), 0)
    loading.value = true
    const res = await giftLicense({ ...form })
    loading.value = false
    if (!res.success) return showMessage('error', t(res.error || 'saveFailed'), 0)
    const email = form.email
    close()
    await showAlert(t(res.emailSent ? 'licenseKeyCreated' : 'licenseKeyNotSent', { email, key: res.key }))
}
</script>

<style scoped>
/* Same spacing as every field of the form modals (FormModal .form-group: label, then its field .5rem below) */
.gift-products {
    grid-column: 1 / -1;
    min-width: 0;
}

.gift-products__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

/* A tile: a dark panel with a thin line; ticked, its line and its box turn mint */
.gift-tile {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    min-width: 0;
    padding: 1rem;
    border: 1px solid var(--line);
    background: var(--panel);
    cursor: pointer;
    transition: border-color var(--motion-fast) var(--ease), background-color var(--motion-fast) var(--ease);
}

.gift-tile--on {
    border-color: var(--accent);
    background: rgba(126, 230, 168, 0.06);
}

.gift-tile input {
    margin-top: 0.15rem;
}

.gift-tile__text {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
}

.gift-tile__name {
    color: var(--fg);
}

.gift-tile__hint {
    color: var(--fg-muted);
    overflow-wrap: anywhere;
}

.gift-products__all {
    align-self: flex-start;
    margin-top: 0.25rem;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
    .gift-tile:hover {
        border-color: var(--fg-muted);
    }

    .gift-tile--on:hover {
        border-color: var(--accent);
    }

    .gift-products__all:hover {
        color: var(--fg);
    }
}

@media (max-width: 640px) {
    .gift-products__grid {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
