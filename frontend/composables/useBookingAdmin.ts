import { api } from '@/utils/api'
import type { BookingKind } from '@/utils/booking'

/*
 * Admin tool Bookings (components/views/Admin/Booking): the appointments booked on /book, the kinds offered, the rules.
 *   const { bookings, kinds, rules, fetchBookings, cancelBooking, fetchKinds, addKind, updateKind, removeKind, fetchRules, saveRules } = useBookingAdmin()
 */
export type BookingRules = { id?: string, enabled: boolean, noticeHours: number, horizonDays: number, bufferMinutes: number, stepMinutes: number }

export const useBookingAdmin = () => {
    // Shared by the panels of the modal
    const bookings = useState<Record<string, any>[]>('adminBookings', () => [])
    const kinds = useState<BookingKind[]>('adminBookingKinds', () => [])
    const rules = useState<BookingRules | null>('adminBookingRules', () => null)

    const fetchBookings = async () => {
        const res = await api.get('/bookings')
        if (res.success) bookings.value = res.bookings
    }

    const cancelBooking = async (id: string) => {
        const res = await api.post(`/bookings/${id}/cancel`)
        if (res.success) bookings.value = bookings.value.map(b => (b.id === id ? { ...b, status: 'cancelled' } : b))
        return res
    }

    const fetchKinds = async () => {
        const res = await api.get('/booking-types/all')
        if (res.success) kinds.value = res.types
    }

    const addKind = async (kind: Partial<BookingKind>) => {
        const res = await api.post('/booking-types', kind)
        if (res.success) kinds.value = [...kinds.value, res.type]
        return res
    }

    const updateKind = async (id: string, changes: Partial<BookingKind>) => {
        const res = await api.put(`/booking-types/${id}`, changes)
        if (res.success) kinds.value = kinds.value.map(k => (k.id === id ? { ...k, ...changes } : k))
        return res
    }

    const removeKind = async (id: string) => {
        const res = await api.delete(`/booking-types/${id}`)
        if (res.success) kinds.value = kinds.value.filter(k => k.id !== id)
        return res
    }

    const fetchRules = async () => {
        const res = await api.get('/booking-settings')
        if (res.success) rules.value = res.settings
    }

    const saveRules = async (changes: Partial<BookingRules>) => {
        const res = await api.put('/booking-settings', changes)
        if (res.success) rules.value = res.settings
        return res
    }

    return { bookings, kinds, rules, fetchBookings, cancelBooking, fetchKinds, addKind, updateKind, removeKind, fetchRules, saveRules }
}
