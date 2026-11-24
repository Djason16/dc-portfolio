<template>
    <!-- New offer of the DC tools: a Stripe coupon applied by itself at checkout and shown on the sales site -->
    <FormModal :show="show" :title="t('licenseNewOffer')" :message="translatedMessage" :loading="loading" :columns="2"
        @close="close" @submit="submit">
        <div class="form-group">
            <label for="offer-product">{{ t('licenseProducts') }}</label>
            <select id="offer-product" v-model="form.product" :title="t('licenseProducts')">
                <option value="all">{{ t('licenseAllOffers') }}</option>
                <option v-for="id in [...productIds, 'bundle']" :key="id" :value="id">{{ id === 'bundle' ? 'DC complet' : productNames[id] }}</option>
            </select>
        </div>
        <div class="form-group">
            <label for="offer-percent">{{ t('licenseOfferPercent') }}</label>
            <input id="offer-percent" v-model.number="form.percentOff" type="number" min="1" max="100" required :title="t('licenseOfferPercent')" />
        </div>
        <div class="form-group">
            <label for="offer-duration">{{ t('licenseOfferDuration') }}</label>
            <select id="offer-duration" v-model="form.duration" :title="t('licenseOfferDuration')">
                <option value="forever">{{ t('licenseOffer_forever') }}</option>
                <option value="once">{{ t('licenseOffer_once') }}</option>
                <option value="repeating">{{ t('licenseOffer_repeating') }}</option>
            </select>
        </div>
        <div v-if="form.duration === 'repeating'" class="form-group">
            <label for="offer-months">{{ t('licenseOfferMonthsLabel') }}</label>
            <input id="offer-months" v-model.number="form.months" type="number" min="1" max="36" :title="t('licenseOfferMonthsLabel')" />
        </div>
        <div class="form-group">
            <label for="offer-max">{{ t('licenseOfferMax') }}</label>
            <input id="offer-max" v-model.number="form.maxRedemptions" type="number" min="1" :placeholder="t('licenseOfferNoLimit')" :title="t('licenseOfferMax')" />
        </div>
        <div class="form-group">
            <label for="offer-end">{{ t('licenseOfferEnds') }}</label>
            <input id="offer-end" v-model="form.redeemBy" type="date" :min="today" :title="t('licenseOfferEnds')" />
        </div>
        <div class="form-group">
            <label for="offer-fr">{{ t('licenseOfferLabelFr') }}</label>
            <input id="offer-fr" v-model="form.labelFr" type="text" maxlength="80" :placeholder="`-${form.percentOff || 0} %`" :title="t('licenseOfferLabelFr')" />
        </div>
        <div class="form-group">
            <label for="offer-en">{{ t('licenseOfferLabelEn') }}</label>
            <input id="offer-en" v-model="form.labelEn" type="text" maxlength="80" :placeholder="`-${form.percentOff || 0}%`" :title="t('licenseOfferLabelEn')" />
        </div>
    </FormModal>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import FormModal from '@/components/ui/Modal/FormModal.vue'
import { useLang } from '@/composables/useLang'
import { useMessage } from '@/composables/useMessage'
import { useLicenses } from '@/composables/useLicenses'
import { showSuccess } from '@/utils/dialog'

defineProps({ show: Boolean })
const emit = defineEmits(['close'])
const { getTranslation: t } = useLang()
const { translatedMessage, showMessage, clearMessage } = useMessage()
const { createOffer, productIds, productNames, fetchProducts } = useLicenses()
fetchProducts()

const empty = () => ({ product: 'all', percentOff: 20, duration: 'once', months: 3, maxRedemptions: null as number | null, redeemBy: '', labelFr: '', labelEn: '' })
const form = reactive(empty())
// The last day can be today (the server keeps the offer until the end of that day); an empty text: the reduction is shown
const today = new Date().toLocaleDateString('sv-SE')
const loading = ref(false)

const close = () => {
    Object.assign(form, empty())
    clearMessage()
    emit('close')
}

const submit = async () => {
    loading.value = true
    clearMessage()
    const res = await createOffer({ ...form, maxRedemptions: form.maxRedemptions || null, redeemBy: form.redeemBy || null })
    loading.value = false
    if (!res.success) return showMessage('error', t(res.error || 'saveFailed'), 0)
    close()
    showSuccess(t('licenseOfferCreated'))
}
</script>
