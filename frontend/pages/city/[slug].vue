<!-- Page of a city added in admin > Villes, at /creation-site-internet/<slug>/ (French address: local search); content and
     <head>: components/views/City (the title, description and JSON-LD depend on the city) -->
<template>
    <City />
</template>

<script setup lang="ts">
import City from '@/components/views/City/City.vue'

definePageMeta({ path: '/creation-site-internet/:slug' })
</script>
