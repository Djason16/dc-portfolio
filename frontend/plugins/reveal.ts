/*
 * v-reveal: the element appears when it comes on screen (style and variants: assets/css/components/reveal.css).
 *   v-reveal            rises a little and fades in
 *   v-reveal="'group'"  a header or a block: its parts one after the other
 *   v-reveal="'image'"  a photo fading in, coming slightly closer
 * Known on the server too (it adds nothing there: the content stays visible in the HTML, for search engines);
 * nothing moves when the visitor asked for less motion.
 */
export default defineNuxtPlugin(nuxtApp => {
    let observer: IntersectionObserver | null = null

    // Comes in, then, once every entrance move is over, "is-settled": the entrance delays stop applying, so a hover
    // answers at once (seen on 2026-11-26: the 4th row of « Mes outils » waited about 1 s before moving under the mouse).
    // Endless animations inside (a bouncing arrow) are not waited for. A move cut short (the mouse over the row while it
    // comes in replaces its transition) counts as over: with Promise.all it never settled, and that row kept its
    // entrance delay on every hover (seen on 2026-11-26: DC Audit, the 4th row, 0.39 s late)
    const reveal = (el: Element) => {
        if (el.classList.contains('is-revealed')) return
        el.classList.add('is-revealed')
        const moves = el.getAnimations({ subtree: true })
            .filter(move => Number.isFinite(Number(move.effect?.getComputedTiming().endTime)))
        Promise.allSettled(moves.map(move => move.finished))
            .then(() => { if (el.classList.contains('is-revealed')) el.classList.add('is-settled') })
    }
    const hide = (el: Element) => el.classList.remove('is-revealed', 'is-settled')

    // One observer for every element, created in the browser on first use
    const getObserver = () => {
        if (observer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return observer
        observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                // In view: comes in. Out through the bottom (scrolling back up): leaves, to come in again next time.
                // Out through the top it stays: nothing moves in the part of the page already read
                if (entry.isIntersecting) reveal(entry.target)
                // Only once wholly under the screen: an element still partly visible (in the bottom band of the
                // rootMargin) never hides again (seen on 2026-11-24: a row of « Mes outils » staying invisible at 1024 px)
                else if (entry.boundingClientRect.top > window.innerHeight) hide(entry.target)
            }
        }, { rootMargin: '0px 0px -8% 0px' })
        // Safety net: once the scrolling stops (and once the page is loaded), every element on screen is shown, even if
        // the observer did not fire for it (a jump to a section, a restored scroll, a slow device)
        let timer: ReturnType<typeof setTimeout> | undefined
        const showVisible = () => {
            for (const el of document.querySelectorAll('.reveal:not(.is-revealed)')) {
                const box = el.getBoundingClientRect()
                if (box.top < window.innerHeight && box.bottom > 0) reveal(el)
            }
        }
        window.addEventListener('scroll', () => { clearTimeout(timer); timer = setTimeout(showVisible, 400) }, { passive: true })
        setTimeout(showVisible, 1500)
        return observer
    }

    nuxtApp.vueApp.directive('reveal', {
        // Server: no attribute, no class
        getSSRProps: () => ({}),
        mounted(el: HTMLElement, { value }: { value: unknown }) {
            const watcher = getObserver()
            if (!watcher) return
            el.classList.add('reveal', `reveal--${value || 'rise'}`)
            watcher.observe(el)
        },
        unmounted(el: HTMLElement) {
            observer?.unobserve(el)
        },
    })
})
