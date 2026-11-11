<!-- Video room of a video booking (/room/<token>/): content in components/views/Room; this page alone loads the code of the call -->
<template>
    <Room :token="token" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Room from '@/components/views/Room/Room.vue'
import { useSeo } from '@/composables/useSeo'

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))

// Title of the page, never indexed (utils/seo.ts)
useSeo('room')
</script>
