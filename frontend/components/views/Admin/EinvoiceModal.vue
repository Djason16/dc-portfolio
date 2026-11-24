<!-- E-invoicing (French reform) with Super PDP: the mode (manual, free / API), the credentials of the API (kept by the server
in its .env, never shown again), a connection test, the API cut or the credentials deleted; then every finalized invoice with
its e-invoice state (B2B: e-invoice, B2C: e-reporting) and, API on, the invoices received. Data: stores/einvoice.ts -->
<template>
    <ModalDialog :show="show" :title="t('adminEinvoice')" @close="emit('close')">
        <div class="einvoice">
            <p class="billing-actions__note text-body-s">{{ t('einvIntro') }}</p>

            <!-- Mode -->
            <fieldset class="einvoice__modes">
                <legend class="eyebrow">{{ t('einvMode') }}</legend>
                <label v-for="mode in ['manual', 'api']" :key="mode" class="einvoice__mode">
                    <input type="radio" name="einv-mode" :value="mode" :checked="settings?.mode === mode" :disabled="busy" @change="setMode(mode)" />
                    <span><strong class="text-body">{{ t(`einvMode_${mode}`) }}</strong><small class="text-body-s">{{ t(`einvModeHint_${mode}`) }}</small></span>
                </label>
            </fieldset>

            <!-- What the API does now: off, nothing is sent nor billed; on, every sending is billed by Super PDP -->
            <p class="einvoice__state text-body-s" :class="{ 'is-on': settings?.mode === 'api' }" role="status">{{ t(settings?.mode === 'api' ? 'einvStateOn' : 'einvStateOff') }}</p>

            <!-- Credentials of the API -->
            <section class="billing-actions__block">
                <p class="eyebrow">{{ t('einvApi') }}</p>
                <p class="text-body-s einvoice__muted">{{ t('einvApiTarget', { url: settings?.apiUrl || '', env: t(`einvEnv_${settings?.env || 'sandbox'}`) }) }}<template v-if="settings?.mock"> · {{ t('einvMock') }}</template></p>
                <template v-if="settings?.configured">
                    <p class="text-body-s">{{ settings.mock ? t('einvMock') : t('einvKeySaved', { hint: settings.clientIdHint }) }}</p>
                    <div class="billing-actions__buttons">
                        <HeroButton iconClass="fas fa-plug" :label="t('einvTest')" :disabled="busy" @click="test" />
                        <HeroButton v-if="settings.mode === 'api'" iconClass="fas fa-power-off" :label="t('einvCut')" :disabled="busy" @click="setMode('manual')" />
                        <HeroButton v-if="!settings.mock" iconClass="fas fa-trash" :label="t('einvDeleteKey')" :disabled="busy" @click="removeKey" />
                    </div>
                    <p v-if="testResult" class="billing-actions__note text-body-s" role="status">{{ testResult }}</p>
                </template>
                <form v-else class="einvoice__form" @submit.prevent="saveKey">
                    <div class="row-group">
                        <div class="form-group"><label for="einv-id">{{ t('einvClientId') }}</label>
                            <input id="einv-id" v-model="form.clientId" type="text" autocomplete="off" spellcheck="false" required /></div>
                        <div class="form-group"><label for="einv-secret">{{ t('einvClientSecret') }}</label>
                            <input id="einv-secret" v-model="form.clientSecret" type="password" autocomplete="new-password" required /></div>
                    </div>
                    <HeroButton type="submit" primary iconClass="fas fa-key" :label="t('einvSaveKey')" :disabled="busy" />
                </form>
            </section>

            <!-- Every finalized invoice -->
            <section class="billing-actions__block">
                <p class="eyebrow">{{ t('einvInvoices') }}</p>
                <p v-if="toDeclare" class="billing-actions__note text-body-s">{{ t('einvToDeclare', { count: toDeclare }) }}</p>
                <p v-if="!store.invoices.length" class="text-body-s einvoice__muted">{{ t('einvNoInvoice') }}</p>
                <ul class="einvoice__list">
                    <li v-for="item in store.invoices" :key="item.id" class="einvoice__item">
                        <span class="einvoice__main"><strong class="text-body">{{ item.number }}</strong><span class="text-body-s">{{ item.client }} · {{ day(item.issueDate) }} · {{ money(item.amount, item.currency) }}</span></span>
                        <span class="einvoice__tags">
                            <span class="bill-state">{{ t(item.flow === 'b2b' ? 'einvFlowTag_b2b' : 'einvFlowTag_b2c') }}</span>
                            <span class="bill-state" :class="`is-${STATE_CLASS[item.status]}`">{{ t(`einvState_${item.status}`) }}</span>
                        </span>
                        <small v-if="item.code" class="text-body-s einvoice__muted">{{ item.code }}<template v-if="item.message"> · {{ item.message }}</template></small>
                        <span class="einvoice__open"><IconButton icon="chevron-right" :label="t('billOpen')" @click="emit('open', 'billing', { openId: item.id })" /></span>
                    </li>
                </ul>
            </section>

            <!-- Received on Super PDP (the online account receives them anyway) -->
            <section v-if="settings?.mode === 'api'" class="billing-actions__block">
                <p class="eyebrow">{{ t('einvReceived') }}</p>
                <div class="billing-actions__buttons"><HeroButton iconClass="fas fa-inbox" :label="t('einvReceivedLoad')" :disabled="busy" @click="loadReceived" /></div>
                <ul v-if="received" class="einvoice__list">
                    <li v-if="!received.length" class="text-body-s einvoice__muted">{{ t('einvReceivedNone') }}</li>
                    <li v-for="inv in received" :key="inv.id" class="einvoice__item">
                        <span class="einvoice__main"><strong class="text-body">{{ inv.number }}</strong><span class="text-body-s">{{ inv.seller }} · {{ day(inv.date) }} · {{ inv.amount }}</span></span>
                    </li>
                </ul>
            </section>
        </div>
    </ModalDialog>
</template>

<script setup lang="ts">
import type { ApiResult } from '@/utils/api'
import { computed, reactive, ref, watch } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import IconButton from '@/components/ui/Button/IconButton.vue'
import ModalDialog from '@/components/ui/Modal/ModalDialog.vue'
import { useLang } from '@/composables/useLang'
import { useEinvoiceStore } from '@/stores/einvoice'
import { showConfirm, showFailure, showSuccess } from '@/utils/dialog'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close', 'open'])
const lang = useLang()
const t = lang.getTranslation
const store = useEinvoiceStore()
const settings = computed(() => store.settings)
const busy = ref(false)
const form = reactive({ clientId: '', clientSecret: '' })
const testResult = ref('')
const received = ref<{ id: string, number: string, seller: string, date: string, amount: string }[] | null>(null)
const STATE_CLASS: Record<string, string> = { none: 'draft', sent: 'final', accepted: 'accepted', rejected: 'refused' }

watch(() => props.show, open => { if (open) { testResult.value = ''; received.value = null; store.load() } }, { immediate: true })

const locale = computed(() => lang.current.value === 'fr' ? 'fr-FR' : 'en-GB')
const money = (value: number, currency = 'EUR') => new Intl.NumberFormat(locale.value, { style: 'currency', currency }).format(Number(value) || 0)
const day = (iso: string) => iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale.value, { dateStyle: 'medium', timeZone: 'UTC' }) : ''
// Consumer invoices not given to the platform: to declare by hand (e-reporting) while the API is off
const toDeclare = computed(() => store.invoices.filter(item => item.flow === 'b2c' && item.status === 'none').length)

const run = async (action: () => Promise<ApiResult>, done = 'billSaved') => {
    busy.value = true
    const res = await action()
    busy.value = false
    if (!res.success) { showFailure(t(res.error || 'billError')); return null }
    if (done) showSuccess(t(done))
    return res
}
// Switching the API on is asked first (every sending is then billed by Super PDP); off at once
const setMode = async (mode: string) => {
    if (mode === 'api' && !(await showConfirm(t('einvEnableConfirm', { env: t(`einvEnv_${settings.value?.env || 'sandbox'}`) })))) return store.load()
    run(() => store.setMode(mode), mode === 'api' ? 'einvEnabled' : 'einvDisabled')
}
const saveKey = async () => {
    if (await run(() => store.saveCredentials(form.clientId, form.clientSecret), 'einvKeySavedDone')) Object.assign(form, { clientId: '', clientSecret: '' })
}
const removeKey = async () => {
    if (await showConfirm(t('einvDeleteConfirm'))) run(() => store.removeCredentials(), 'einvKeyDeleted')
}
const test = async () => {
    testResult.value = ''
    const res = await run(() => store.test(), '')
    if (res) testResult.value = t(res.matches ? 'einvTestOk' : 'einvTestMismatch', { name: res.company.name, number: res.company.number, env: t(`einvEnv_${res.company.env}`), expected: t(`einvEnv_${res.expected}`) })
}
const loadReceived = async () => {
    const res = await run(() => store.received(), '')
    if (res) received.value = res.invoices
}
</script>
