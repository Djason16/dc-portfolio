// DC tools licences on the public pages (/licenses/manage/, /licenses/thanks/): the sales site and the names of the tools
export const TOOLS_SITE = 'https://tools.djason-chery.dev'

const NAMES: Record<string, string> = { scaffold: 'DC Scaffold', prospect: 'DC Prospect', sentinel: 'DC Sentinel', bundle: 'DC complet' }

/** Name of a tool or of the bundle; '' when unknown. */
export const toolName = (id: unknown) => NAMES[String(id)] ?? ''

/** The tools of a key in words: "DC Scaffold, DC Prospect" (the three: "DC complet"). */
export const toolNames = (products: string[]) => products.length === 3 ? NAMES.bundle! : products.map(toolName).filter(Boolean).join(', ')
