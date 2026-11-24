<template>
    <!-- Shared questions of the city pages: one row each (its first wording, how many wordings, shown or hidden),
         buttons to show / hide, edit and delete; Add a question below -->
    <TableModal :show="show" :title="t('adminCityFaqs')" max-width="1100px" @close="emit('close')">
        <ul v-if="faqs.length" class="faq-rows">
            <li v-for="faq in faqs" :key="faq.id" class="faq-row" :class="{ 'is-off': !faq.active }">
                <div class="faq-row__main">
                    <p class="text-display-xs">{{ faq.variants[0]?.q }}</p>
                    <p class="faq-row__meta text-body-s">{{ t('faqVariants', { count: faq.variants.length }) }} · {{ t(faq.active ? 'faqActive' : 'faqHidden') }}</p>
                </div>
                <div class="faq-row__actions">
                    <IconButton :icon="faq.active ? 'close' : 'check'" :label="t(faq.active ? 'cityUnpublish' : 'cityPublish')" :disabled="busy" @click="toggle(faq)" />
                    <IconButton icon="pen" :label="t('faqEdit')" @click="emit('open', 'cityFaq', { faq })" />
                    <IconButton icon="trash" variant="danger" :label="t('delete')" :disabled="busy" @click="remove(faq)" />
                </div>
            </li>
        </ul>
        <p v-else class="faq-rows__empty text-body">{{ t('faqEmpty') }}</p>

        <template #actions>
            <HeroButton primary iconClass="fas fa-plus" :label="t('faqAdd')" @click="emit('open', 'cityFaq', { faq: null })" />
        </template>
    </TableModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import IconButton from '@/components/ui/Button/IconButton.vue'
import TableModal from '@/components/ui/Modal/TableModal.vue'
import { useCities } from '@/composables/useCities'
import { useLang } from '@/composables/useLang'
import type { CityFaqTemplate } from '@/utils/cities/cityTypes'
import { showConfirm, showFailure, showResult } from '@/utils/dialog'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'open'])

const { getTranslation: t } = useLang()
const { faqs, fetchCities, saveFaq, removeFaq } = useCities()
const busy = ref(false)

const toggle = async (faq: CityFaqTemplate) => {
    busy.value = true
    const res = await saveFaq(faq.id, { active: !faq.active })
    busy.value = false
    if (!res.success) showFailure(t(res.error || 'error'))
}

const remove = async (faq: CityFaqTemplate) => {
    if (!(await showConfirm(t('faqDeleteConfirm'), { okLabel: t('dialogDelete') }))) return
    const res = await removeFaq(faq.id)
    await showResult(res, t('deleteSuccess'), t('deleteFailed'))
}

watch(() => props.show, open => open && fetchCities(), { immediate: true })
</script>

<style scoped>
.faq-rows {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--field-line);
    overflow-y: auto;
    overscroll-behavior: contain;
}

.faq-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    padding: 0.9rem 1rem;
    border-bottom: 1px solid var(--line);
}

.faq-row p {
    margin: 0;
}

.faq-row.is-off .faq-row__main {
    opacity: 0.6;
}

.faq-row__meta {
    margin-top: 0.3rem !important;
    color: var(--paper-muted);
}

.faq-row__actions {
    display: flex;
    gap: 0.35rem;
}

.faq-rows__empty {
    padding: 3rem 1rem;
    background: var(--panel);
    color: var(--paper-muted);
    text-align: center;
}

@media (max-width: 600px) {
    .faq-row {
        grid-template-columns: minmax(0, 1fr);
        padding: 0.9rem 0.25rem;
    }
}
</style>
