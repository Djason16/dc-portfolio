<!-- Cancel link of the confirmation email (/book/?cancel=<token>): the booking, then one button to cancel it -->
<template>
    <div class="booking-cancel" aria-live="polite">
        <p class="eyebrow">{{ t('bookCancelLabel') }}</p>
        <p v-if="loading" class="text-body">{{ t('bookCancelLoading') }}</p>
        <p v-else-if="!booking" class="text-body">{{ t('bookingNotFound') }}</p>
        <template v-else>
            <p class="booking-cancel__what text-display-s">{{ booking.typeName }}</p>
            <p class="booking-cancel__when text-body-l">{{ when }}</p>
            <p v-if="booking.status === 'cancelled'" class="text-body">{{ t(emailSent ? 'bookCancelDone' : 'bookCancelDoneNoEmail') }}</p>
            <p v-else-if="booking.past" class="text-body">{{ t('bookingPast') }}</p>
            <HeroButton v-else primary iconClass="fas fa-times" :label="t(cancelling ? 'bookCancelling' : 'bookCancelConfirm')" :disabled="cancelling" @click="cancel" />
            <MessageBox :message="translatedMessage" />
        </template>
        <NuxtLink :to="withTrailingSlash('/book')" class="booking-cancel__link text-label" :title="t('bookAnother')">{{ t('bookAnother') }} →</NuxtLink>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import MessageBox from '@/components/ui/Message/MessageBox.vue'
import { useLang } from '@/composables/useLang'
import { useMessage } from '@/composables/useMessage'
import { api } from '@/utils/api'
import { dayKeyOf, longDay, timeOf } from '@/utils/booking'
import { withTrailingSlash } from '@/utils/pathHelpers'

const props = defineProps({
    token: { type: String, required: true },
    zone: { type: String, required: true },
})

const lang = useLang()
const t = lang.getTranslation
const { translatedMessage, showMessage, clearMessage } = useMessage()

const booking = ref<Record<string, any> | null>(null)
const loading = ref(true)
const cancelling = ref(false)
const emailSent = ref(true)

const when = computed(() => {
    if (!booking.value) return ''
    const locale = lang.current.value, { start, end } = booking.value
    return `${longDay(dayKeyOf(start, props.zone), locale, true)} · ${timeOf(start, locale, props.zone)} - ${timeOf(end, locale, props.zone)} (${props.zone})`
})

// Read in the browser only: the hours need the zone of the visitor
onMounted(async () => {
    const res = await api.get(`/bookings/cancel/${encodeURIComponent(props.token)}`)
    booking.value = res.success ? res.booking : null
    loading.value = false
})

const cancel = async () => {
    clearMessage()
    cancelling.value = true
    const res = await api.post(`/bookings/cancel/${encodeURIComponent(props.token)}`)
    cancelling.value = false
    if (!res.success) return showMessage('error', res.error || 'unknownError', 0)
    emailSent.value = res.emailSent !== false
    booking.value = { ...booking.value, status: 'cancelled' }
}
</script>

<style scoped>
.booking-cancel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    max-width: 40rem;
    padding: 1.5rem 1.75rem;
    border-left: 2px solid var(--accent);
    background: var(--panel);
}

.booking-cancel p {
    margin: 0;
}

.booking-cancel__when {
    color: var(--accent);
}

.booking-cancel__link {
    color: var(--fg-muted);
}

@media (max-width: 600px) {
    .booking-cancel {
        padding: 1.25rem;
    }
}
</style>
