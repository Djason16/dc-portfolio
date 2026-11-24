<template>
    <!-- A shared question of the city pages: up to 3 wordings (question and answer, with {placeholders}), shown or hidden -->
    <FormModal :show="show" :title="t(faq ? 'faqEdit' : 'faqAdd')" :message="translatedMessage" :loading="loading" @close="close" @submit="submit">
        <p class="faq-form__help text-body-s">{{ t('faqHelp') }}</p>
        <fieldset v-for="(variant, i) in form.variants" :key="i" class="faq-form__variant">
            <legend class="eyebrow">{{ t('faqVariant', { n: i + 1 }) }}</legend>
            <div class="form-group">
                <label :for="`faq-q${i}`">{{ t('faqQuestion') }}</label>
                <input :id="`faq-q${i}`" v-model="variant.q" type="text" :required="i === 0" :maxlength="CITY_LIMITS.question"
                    :placeholder="t('faqQuestionPlaceholder')" :title="t('faqQuestion')" />
            </div>
            <div class="form-group">
                <label :for="`faq-a${i}`">{{ t('faqAnswer') }}</label>
                <textarea :id="`faq-a${i}`" v-model="variant.a" rows="3" :required="i === 0" :maxlength="CITY_LIMITS.answer"
                    :placeholder="t('faqAnswerPlaceholder')" :title="t('faqAnswer')"></textarea>
            </div>
        </fieldset>
        <label class="faq-form__active text-label">
            <input v-model="form.active" type="checkbox" /> {{ t('faqActive') }}
        </label>
    </FormModal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { reactive, ref, watch } from 'vue'
import FormModal from '@/components/ui/Modal/FormModal.vue'
import { useCities } from '@/composables/useCities'
import { useLang } from '@/composables/useLang'
import { useMessage } from '@/composables/useMessage'
import { CITY_LIMITS, checkFaqVariants } from '@/utils/cities/cityRules'
import type { CityFaqTemplate } from '@/utils/cities/cityTypes'
import { MESSAGE_DELAY, afterMessage } from '@/utils/feedback'

const props = defineProps({
    show: Boolean,
    // Question to change; none = a new one
    faq: { type: Object as PropType<CityFaqTemplate | null>, default: null },
})
const emit = defineEmits(['close', 'saved'])

const { getTranslation: t } = useLang()
const { saveFaq } = useCities()
const { translatedMessage, showMessage, clearMessage } = useMessage()
const loading = ref(false)
const form = reactive({ variants: [] as { q: string, a: string }[], active: true })

watch(() => props.show, open => {
    if (!open) return
    form.variants = Array.from({ length: CITY_LIMITS.variants }, (_, i) => ({ q: props.faq?.variants[i]?.q ?? '', a: props.faq?.variants[i]?.a ?? '' }))
    form.active = props.faq?.active ?? true
    clearMessage()
}, { immediate: true })

const close = () => {
    loading.value = false
    clearMessage()
    emit('close')
}

const submit = async () => {
    clearMessage()
    const checked = checkFaqVariants(form.variants)
    if ('error' in checked) return showMessage('error', t(checked.error))
    loading.value = true
    try {
        const res = await saveFaq(props.faq?.id ?? null, { variants: checked.variants, active: form.active })
        if (!res.success) return showMessage('error', t(res.error || 'error'))
        showMessage('success', t('saveSuccess'), MESSAGE_DELAY)
        await afterMessage()
        close()
        emit('saved')
    } finally { loading.value = false }
}
</script>

<style scoped>
.faq-form__help {
    margin: 0;
    color: var(--paper-muted);
}

.faq-form__variant {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
    padding: 1rem;
    border: 1px solid var(--line);
    min-width: 0;
}

.faq-form__variant legend {
    padding: 0 0.4rem;
}

.faq-form__active {
    display: flex;
    align-items: center;
    gap: 0.6rem;
}
</style>
