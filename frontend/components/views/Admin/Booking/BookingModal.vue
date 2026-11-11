<!-- Admin tool Bookings: the appointments booked on the page /book (cancel one), the kinds of appointment offered, the rules of the page.
     One tab at a time, so each part keeps the whole height of the modal. -->
<template>
    <TableModal :show="show" :title="t('bookingsAdminTitle')" max-width="1200px" @close="emit('close')">
        <div class="booking-tabs" role="tablist" :aria-label="t('bookingsAdminTitle')">
            <button v-for="tab in TABS" :id="`booking-tab-${tab.id}`" :key="tab.id" type="button" role="tab" class="booking-tabs__tab text-label"
                :class="{ 'is-active': current === tab.id }" :aria-selected="current === tab.id" :aria-controls="`booking-panel-${tab.id}`"
                :tabindex="current === tab.id ? 0 : -1" @click="current = tab.id" @keydown.right.prevent="move(1)" @keydown.left.prevent="move(-1)">
                {{ t(tab.key) }}
            </button>
        </div>

        <BookingListPanel v-if="current === 'list'" id="booking-panel-list" role="tabpanel" aria-labelledby="booking-tab-list" />
        <BookingKindsPanel v-else-if="current === 'kinds'" id="booking-panel-kinds" role="tabpanel" aria-labelledby="booking-tab-kinds" />
        <BookingRulesPanel v-else id="booking-panel-rules" role="tabpanel" aria-labelledby="booking-tab-rules" />

        <!-- The personal room /room/: a video call without booking (visitors knock, admin > My video room) -->
        <template #actions>
            <HeroButton iconClass="fas fa-video" :href="withTrailingSlash('/room')" :label="t('adminLounge')" />
        </template>
    </TableModal>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import HeroButton from '@/components/ui/Button/HeroButton.vue'
import TableModal from '@/components/ui/Modal/TableModal.vue'
import { withTrailingSlash } from '@/utils/pathHelpers'
import { useLang } from '@/composables/useLang'
import { useModalData } from '@/composables/useLiveData'
import { useBookingAdmin } from '@/composables/useBookingAdmin'
import BookingKindsPanel from './BookingKindsPanel.vue'
import BookingListPanel from './BookingListPanel.vue'
import BookingRulesPanel from './BookingRulesPanel.vue'

const props = defineProps({ show: Boolean })
const emit = defineEmits(['close'])
const { getTranslation: t } = useLang()
const { fetchBookings, fetchKinds, fetchRules } = useBookingAdmin()

const TABS = [
    { id: 'list', key: 'bookingsTabList' },
    { id: 'kinds', key: 'bookingsTabKinds' },
    { id: 'rules', key: 'bookingsTabRules' },
]
const current = ref('list')

// Arrows of the keyboard: the tab beside, focused
const move = async (step: number) => {
    const index = (TABS.findIndex(tab => tab.id === current.value) + step + TABS.length) % TABS.length
    current.value = TABS[index]!.id
    await nextTick()
    document.getElementById(`booking-tab-${current.value}`)?.focus()
}

// Loaded when it opens, and again while open when it changes elsewhere (a new booking, another tab)
useModalData(() => props.show, () => Promise.all([fetchBookings(), fetchKinds(), fetchRules()]), ['dc_bookings', 'dc_booking_types', 'dc_booking_settings'])
</script>

<style scoped>
.booking-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.75rem;
    border-bottom: 1px solid var(--line);
}

.booking-tabs__tab {
    min-height: 2.75rem;
    margin-bottom: -1px;
    padding: 0;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--fg-muted);
    cursor: pointer;
    transition: color var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease);
}

.booking-tabs__tab.is-active {
    border-bottom-color: var(--accent);
    color: var(--fg);
}

.booking-tabs__tab:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
</style>
