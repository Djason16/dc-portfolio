// DC tools licences on the public pages (/licenses/manage/, /licenses/thanks/): the sales site and the names of the tools
export const TOOLS_SITE = 'https://tools.djason-chery.dev'

const NAMES: Record<string, string> = { scaffold: 'DC Scaffold', prospect: 'DC Prospect', sentinel: 'DC Sentinel', audit: 'DC Audit', bundle: 'DC complet' }

/** Name of a tool or of the bundle; '' when unknown. */
export const toolName = (id: unknown) => NAMES[String(id)] ?? ''

const TOOLS = ['scaffold', 'prospect', 'sentinel', 'audit']

/** The tools of a key in words: "DC Scaffold, DC Prospect" (every tool: "DC complet"). */
export const toolNames = (products: string[]) => TOOLS.every(id => products.includes(id)) ? NAMES.bundle! : products.map(toolName).filter(Boolean).join(', ')
