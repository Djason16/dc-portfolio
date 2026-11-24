<!-- Zone page: every published city (admin > Villes), at /zone-intervention/ (French address: local search);
     content and <head>: components/views/Area -->
<template>
    <Area />
</template>

<script setup lang="ts">
import Area from '@/components/views/Area/Area.vue'

definePageMeta({ path: '/zone-intervention' })
</script>
