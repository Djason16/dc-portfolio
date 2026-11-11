<!-- Reactions floating up over the picture for a few seconds (ours and the other person's, composables/useRoomChat.ts);
the other person's latest one is read by screen readers. Without movement when the person asked for less motion. -->
<template>
    <div class="room-reactions" aria-hidden="true">
        <span v-for="reaction in chat.reactions.value" :key="reaction.id" class="room-reactions__item text-display-m" :class="{ 'is-mine': reaction.mine }"
            :style="{ left: `${reaction.left}%` }">{{ reaction.emoji }}</span>
    </div>
    <p class="room-reactions__said" aria-live="polite">{{ said }}</p>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { ref, watch } from 'vue'
import { useLang } from '@/composables/useLang'
import type { RoomChat } from '@/composables/useRoomChat'
import { reactionKey } from './reactionNames'

const props = defineProps({
    chat: { type: Object as PropType<RoomChat>, required: true },
    name: { type: String, required: true },
})
const t = useLang().getTranslation

// Said once, then emptied (the same reaction twice is read twice)
const said = ref('')
let clear: ReturnType<typeof setTimeout> | undefined
watch(() => props.chat.reactions.value.filter(reaction => !reaction.mine).at(-1)?.id, (id) => {
    const emoji = props.chat.lastReaction.value
    if (!id || !emoji) return
    said.value = t('roomReactionFrom', { name: props.name, reaction: t(reactionKey(emoji)) })
    clearTimeout(clear)
    clear = setTimeout(() => { said.value = '' }, 4000)
})
</script>

<style scoped>
.room-reactions {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
}

.room-reactions__item {
    position: absolute;
    bottom: 1rem;
    line-height: 1;
    transform: translateX(-50%);
    animation: room-reaction-float 3.2s var(--ease) forwards;
}

@keyframes room-reaction-float {
    0% { opacity: 0; transform: translate(-50%, 0) scale(0.6); }
    12% { opacity: 1; transform: translate(-50%, -1rem) scale(1); }
    75% { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%, -14rem) scale(1); }
}

@media (max-height: 420px) {
    @keyframes room-reaction-float {
        0% { opacity: 0; transform: translate(-50%, 0) scale(0.6); }
        12% { opacity: 1; transform: translate(-50%, -0.5rem) scale(1); }
        75% { opacity: 1; }
        100% { opacity: 0; transform: translate(-50%, -6rem) scale(1); }
    }
}

@media (prefers-reduced-motion: reduce) {
    .room-reactions__item {
        bottom: 40%;
        animation: room-reaction-fade 3.2s linear forwards;
    }

    @keyframes room-reaction-fade {
        0%, 80% { opacity: 1; }
        100% { opacity: 0; }
    }
}

/* Read by screen readers only */
.room-reactions__said {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}
</style>
