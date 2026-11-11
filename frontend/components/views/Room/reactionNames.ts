// Names of the reactions of the video room (composables/useRoomChat.ts REACTIONS), read by screen readers and shown on hover
const KEYS: Record<string, string> = {
    '👍': 'roomReactThumbs', '👏': 'roomReactClap', '😂': 'roomReactLaugh', '❤️': 'roomReactHeart', '🎉': 'roomReactParty', '🤔': 'roomReactThink',
}

export const reactionKey = (emoji: string) => KEYS[emoji] ?? 'roomReactions'
