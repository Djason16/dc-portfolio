<!-- Last screen of the booking page: what is booked, when on the clock of the visitor, where the confirmation went -->
<template>
    <div ref="box" class="booking-done" tabindex="-1" role="status">
        <p class="eyebrow">{{ t('bookDoneLabel') }}</p>
        <p class="booking-done__what text-display-s">{{ booking.typeName }}</p>
        <p class="booking-done__when text-body-l">{{ when }}</p>
        <p class="text-body">{{ t(emailSent ? 'bookDone' : 'bookDoneNoEmail', { email: booking.email || '' }) }}</p>
        <!-- A video call in the room of the site: its link at once (a plain link: the room page is loaded in full, the camera is only allowed there) -->
        <p v-if="roomUrl" class="text-body">{{ t('bookDoneRoom') }} <a :href="roomUrl" :title="t('bookDoneRoomTitle')" class="booking-done__room">{{ roomUrl }}</a></p>
        <HeroButton iconClass="fas fa-plus" :label="t('bookAnother')" @click="emit('again')" />
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, onMounted, ref } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import { useLang } from '@/composables/useLang'
import { dayKeyOf, longDay, timeOf } from '@/utils/booking'
import { withTrailingSlash } from '@/utils/pathHelpers'

const props = defineProps({
    // The booking sent back by the API: typeName, start, end, email
    booking: { type: Object as PropType<Record<string, any>>, required: true },
    emailSent: { type: Boolean, default: true },
    zone: { type: String, required: true },
})
const emit = defineEmits<{ again: [] }>()

const lang = useLang()
const t = lang.getTranslation

// "jeudi 20 novembre 2026 · 10:30 - 11:15 (Europe/Paris)"
const when = computed(() => {
    const locale = lang.current.value
    const hours = props.booking.end ? `${timeOf(props.booking.start, locale, props.zone)} - ${timeOf(props.booking.end, locale, props.zone)}` : timeOf(props.booking.start, locale, props.zone)
    return `${longDay(dayKeyOf(props.booking.start, props.zone), locale, true)} · ${hours} (${props.zone})`
})

// Link of the video room of the site (visitor's side), when the kind has no fixed link of its own
const roomUrl = computed(() => props.booking.roomToken && import.meta.client ? `${window.location.origin}${withTrailingSlash(`/room/${props.booking.roomToken}`)}` : '')

// The screen readers and the keyboard start from the confirmation
const box = ref<HTMLElement | null>(null)
onMounted(() => {
    box.value?.focus({ preventScroll: true })
    box.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})
</script>

<style scoped>
.booking-done {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    max-width: 40rem;
    padding: 1.5rem 1.75rem;
    border-left: 2px solid var(--accent);
    background: var(--panel);
    scroll-margin-top: 7.5rem;
}

.booking-done:focus {
    outline: none;
}

.booking-done p {
    margin: 0;
}

.booking-done__when {
    color: var(--accent);
}

/* A long address breaks anywhere: never wider than a phone */
.booking-done__room {
    color: var(--accent);
    overflow-wrap: anywhere;
}

@media (max-width: 600px) {
    .booking-done {
        padding: 1.25rem;
    }
}
</style>
