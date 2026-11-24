// JavaScript of the pages asked for after the styles, the fonts and the logo (fetchpriority="low"): the page is complete
// in the HTML (server rendering), its scripts only make it interactive. With the default (high) priority, the twenty
// scripts of a page shared the connection with the stylesheet and the fonts, and the first paint came later on a phone
// (Lighthouse mobile: FCP / LCP). The order of the scripts between them does not change
export default defineNitroPlugin((nitroApp) => {
    const lowPriority = (tag: string) => tag
        .replace(/<link rel="modulepreload"(?![^>]*fetchpriority)/g, '<link rel="modulepreload" fetchpriority="low"')
        .replace(/<script type="module"(?![^>]*fetchpriority)([^>]*\ssrc=)/g, '<script type="module" fetchpriority="low"$1')

    nitroApp.hooks.hook('render:html', (html) => {
        html.head = html.head.map(lowPriority)
        html.bodyAppend = html.bodyAppend.map(lowPriority)
    })
})
