<!-- Booking page: a visitor books a slot (phone call, video call, meeting...); content: components/views/Book -->
<template>
    <Book />
</template>

<script setup lang="ts">
import Book from '@/components/views/Book/Book.vue'
import { useSeo } from '@/composables/useSeo'

// Title, description, Open Graph... updated when the language changes (utils/seo.ts)
useSeo('book')
</script>
