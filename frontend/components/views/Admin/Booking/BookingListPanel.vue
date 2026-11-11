<!-- Bookings tab of the admin tool: the appointments of the last 30 days and to come, the next one first; a booked one to come can be cancelled.
A video appointment in the room of the site: "Join" opens the owner's link (new tab, full load: the camera is only allowed on that page),
its two links are in the details (the visitor's one to send again if needed) -->
<template>
    <div class="booking-list">
        <p class="booking-list__zone text-body-s">{{ t('bookingsZone', { zone }) }}</p>
        <!-- No delete button: a booking is only cancelled (kept as a trace), an empty slot falls back to the default buttons -->
        <EditableTable :items="rows" :columns="columns" :actions-label="t('actions')" :show-delete="false" :empty-message="t('bookingsNone')" :per-page="8">
            <template #actions="{ item }">
                <IconButton v-if="item.roomOpen" icon="video" variant="primary" :label="t('bookingJoinRoom')" @click="joinRoom(item)" />
                <IconButton v-if="item.status === 'booked' && !item.past" icon="close" variant="danger" :label="t('bookingCancelAction')" @click="cancel(item)" />
            </template>
        </EditableTable>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import IconButton from '@/components/ui/Button/IconButton.vue'
import EditableTable from '@/components/ui/Table/EditableTable.vue'
import { useBookingAdmin } from '@/composables/useBookingAdmin'
import { useLang } from '@/composables/useLang'
import { MODE_KEYS, dayKeyOf, longDay, timeOf, visitorZone } from '@/utils/booking'
import { showConfirm, showResult } from '@/utils/dialog'
import { withTrailingSlash } from '@/utils/pathHelpers'

const lang = useLang()
const t = lang.getTranslation
const { bookings, cancelBooking } = useBookingAdmin()

// Hours shown on the clock of this device
const zone = ref('UTC')
onMounted(() => { zone.value = visitorZone() })

const whenOf = (b: Record<string, any>) => {
    const locale = lang.current.value
    return `${longDay(dayKeyOf(b.start, zone.value), locale, true)} · ${timeOf(b.start, locale, zone.value)} - ${timeOf(b.end, locale, zone.value)}`
}

// Address of a video room of the site (the same rule as the emails: /room/<token>/)
const ROOM_CLOSES_AFTER_MS = 30 * 60 * 1000
const roomUrl = (token: string) => `${window.location.origin}${withTrailingSlash(`/room/${token}`)}`
const joinRoom = (item: Record<string, any>) => window.open(roomUrl(item.hostToken), '_blank', 'noopener')

// The ones to come first (the nearest on top), then the past ones (the latest on top); "Join" until the room closes
const rows = computed(() => {
    const now = Date.now()
    const list = bookings.value.map(b => ({ ...b, past: Date.parse(b.start) <= now,
        roomOpen: Boolean(b.hostToken) && b.status === 'booked' && Date.parse(b.end) + ROOM_CLOSES_AFTER_MS > now }))
    return [...list.filter(b => !b.past), ...list.filter(b => b.past).reverse()]
})

const statusOf = (b: Record<string, any>) => t(b.status === 'cancelled' ? 'bookingStatusCancelled' : b.past ? 'bookingStatusPast' : 'bookingStatusBooked')

// On a phone: the date as the title of the card, the rest under it
const columns = computed(() => [
    { key: 'start', label: t('bookingWhen'), disabled: true, formatter: whenOf },
    { key: 'typeName', label: t('bookingKind'), disabled: true, mobile: 'labeled', formatter: (b: Record<string, any>) => `${b.typeName} · ${t(MODE_KEYS[b.mode] ?? '')}` },
    { key: 'name', label: t('bookingContact'), disabled: true, mobile: 'labeled', formatter: (b: Record<string, any>) => [b.name, b.email, b.phone].filter(Boolean).join(' · ') },
    { key: 'status', label: t('bookingStatus'), disabled: true, mobile: 'tag', formatter: statusOf },
    { key: 'message', label: t('bookingMessage'), disabled: true, detail: true, formatter: (b: Record<string, any>) => b.message || '-' },
    // Links of the video room (tokens: hexadecimal figures only, nothing to escape)
    { key: 'roomToken', label: t('bookingRoom'), disabled: true, detail: true, processHtml: true, formatter: (b: Record<string, any>) => b.hostToken
        ? [[t('bookingRoomHost'), roomUrl(b.hostToken)], [t('bookingRoomGuest'), roomUrl(b.roomToken)]]
            .map(([label, url]) => `${label} : <a href="${url}" title="${t('bookingJoinRoom')}" target="_blank" rel="noopener">${url}</a>`).join('<br>')
        : '-' },
])

const cancel = async (item: Record<string, any>) => {
    if (!(await showConfirm(t('bookingCancelConfirm', { name: item.name, when: whenOf(item) }), { okLabel: t('bookingCancelAction') }))) return
    const res = await cancelBooking(item.id)
    await showResult(res, t('bookingCancelledOk'), t('bookingCancelFailed'))
}
</script>

<style scoped>
.booking-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
    flex: 1 1 auto;
}

.booking-list__zone {
    margin: 0;
    color: var(--fg-muted);
}
</style>
