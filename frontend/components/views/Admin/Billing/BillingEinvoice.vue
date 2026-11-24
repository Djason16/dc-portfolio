<!-- E-invoice of a finalized invoice (French reform): B2B an e-invoice, B2C e-reporting. Its Factur-X to download (manual
mode: uploaded by hand on superpdp.tech), or sent through the Super PDP API with its state (API mode). Data: stores/einvoice.ts -->
<template>
    <section class="billing-actions__block billing-einvoice">
        <p class="eyebrow">{{ t('einvTitle') }}</p>
        <p class="billing-actions__note text-body-s">{{ t(flow === 'b2b' ? 'einvFlowB2b' : 'einvFlowB2c') }}</p>

        <dl v-if="apiOn || item?.status !== 'none'" class="billing-einvoice__state">
            <div><dt class="text-label">{{ t('einvColState') }}</dt>
                <dd><span class="bill-state" :class="`is-${STATE_CLASS[item?.status || 'none']}`">{{ t(`einvState_${item?.status || 'none'}`) }}</span></dd></div>
            <div v-if="item?.code"><dt class="text-label">{{ t('einvColEvent') }}</dt><dd class="text-body-s">{{ item.code }}<template v-if="item.message"> · {{ item.message }}</template></dd></div>
            <div v-if="item?.env === 'sandbox'"><dt class="text-label">{{ t('einvColEnv') }}</dt><dd class="text-body-s">{{ t('einvEnvShown_sandbox') }}</dd></div>
            <div v-if="item?.paymentReportedAt"><dt class="text-label">{{ t('einvColPayment') }}</dt><dd class="text-body-s">{{ t('einvPaymentReported') }}</dd></div>
        </dl>

        <div class="billing-actions__buttons">
            <HeroButton :primary="!apiOn" iconClass="fas fa-file-code" :label="t('einvDownload')" :disabled="busy" @click="download" />
            <template v-if="apiOn">
                <HeroButton v-if="canSend" primary iconClass="fas fa-cloud-arrow-up" :label="t(flow === 'b2b' ? 'einvSend' : 'einvSendB2c')" :disabled="busy" @click="send" />
                <HeroButton v-if="item?.status === 'sent' || item?.status === 'accepted'" iconClass="fas fa-rotate" :label="t('einvRefresh')" :disabled="busy" @click="refresh" />
                <HeroButton v-if="item?.status === 'accepted' && item.paid && !item.paymentReportedAt" iconClass="fas fa-euro-sign" :label="t('einvReportPayment')" :disabled="busy" @click="reportPayment" />
            </template>
        </div>
    </section>
</template>

<script setup lang="ts">
import type { ApiResult } from '@/utils/api'
import type { BillingDocument } from '@/utils/billing'
import type { PropType } from 'vue'
import { computed, onMounted, ref } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import { useEinvoice } from '@/composables/useEinvoice'
import { useLang } from '@/composables/useLang'
import { useEinvoiceStore } from '@/stores/einvoice'
import { showConfirm, showFailure, showSuccess } from '@/utils/dialog'

const props = defineProps({ doc: { type: Object as PropType<BillingDocument>, required: true } })
const { getTranslation: t } = useLang()
const store = useEinvoiceStore()
const einvoice = useEinvoice()
const busy = ref(false)

// The state of the e-invoice -> the classes of the states of the list (billing-admin.css)
const STATE_CLASS: Record<string, string> = { none: 'draft', sent: 'final', accepted: 'accepted', rejected: 'refused' }
onMounted(() => { if (!store.settings) store.load() })

const item = computed(() => store.of(props.doc.id))
const flow = computed(() => item.value?.flow || (props.doc.client?.type !== 'individual' && String(props.doc.client?.siret || '').replace(/\D/g, '').length >= 9 ? 'b2b' : 'b2c'))
const apiOn = computed(() => store.settings?.mode === 'api')
const canSend = computed(() => !item.value || item.value.status === 'none' || item.value.status === 'rejected')

// Runs an action, shows its result (an error: a text of the admin, or the message of Super PDP)
const run = async (action: () => Promise<ApiResult>, done: string) => {
    busy.value = true
    const res = await action()
    busy.value = false
    if (!res.success) return showFailure(t(res.error || 'billError'))
    showSuccess(t(done))
}
const download = () => run(() => einvoice.download(props.doc), 'einvDownloaded')
const send = async () => {
    if (!(await showConfirm(t(flow.value === 'b2b' ? 'einvSendConfirm' : 'einvSendB2cConfirm', { number: props.doc.number ?? '', env: t(`einvEnv_${store.settings?.env || 'sandbox'}`) })))) return
    run(() => einvoice.send(props.doc), 'einvSent')
}
const refresh = () => run(() => store.refresh(props.doc.id), 'einvRefreshed')
const reportPayment = () => run(() => store.reportPayment(props.doc.id), 'einvPaymentReported')
</script>
