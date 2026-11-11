<!-- Background and devices, in the waiting screen (under the preview) and in the side panel of the call -->
<template>
    <div class="room-settings">
        <RoomEffects :media="media" />
        <RoomDevices :media="media" />
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import RoomDevices from './RoomDevices.vue'
import RoomEffects from './RoomEffects.vue'
import type { LocalMedia } from '@/composables/useLocalMedia'

defineProps({ media: { type: Object as PropType<LocalMedia>, required: true } })
</script>

<style scoped>
.room-settings {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem;
}
</style>
