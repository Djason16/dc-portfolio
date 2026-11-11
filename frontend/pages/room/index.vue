<!-- Personal room of the owner (/room/, without a token): always the same address, visitors knock and he lets them in.
Content in components/views/Room/Lounge.vue; this page alone loads the code of the call -->
<template>
    <Lounge />
</template>

<script setup lang="ts">
import Lounge from '@/components/views/Room/Lounge.vue'
import { useSeo } from '@/composables/useSeo'

// Title of the page, never indexed (utils/seo.ts)
useSeo('room')
</script>
