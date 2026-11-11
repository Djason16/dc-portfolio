// Files of MediaPipe for the background effects of the video room (blur, image behind the person): the WebAssembly runtime
// of @mediapipe/tasks-vision is copied from node_modules to public/mediapipe/wasm/ (not in Git, about 15 MB), so the site
// serves it itself (no CDN). The model public/mediapipe/selfie_segmenter.tflite (Apache 2.0, Google) is kept in Git.
// Both are downloaded by the browser only when a person chooses an effect (utils/room/segmenter.ts).
// Run by npm before dev and build; by hand: node scripts/mediapipe.mjs
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const to = join(root, 'public', 'mediapipe', 'wasm')
mkdirSync(to, { recursive: true })
for (const name of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
    const source = join(from, name), target = join(to, name)
    // Copied again only when the package changed
    if (existsSync(target) && statSync(target).size === statSync(source).size && statSync(target).mtimeMs >= statSync(source).mtimeMs) continue
    copyFileSync(source, target)
}
