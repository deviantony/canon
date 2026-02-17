import { css } from '@codemirror/lang-css'
import { go } from '@codemirror/lang-go'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { yaml } from '@codemirror/lang-yaml'
import type { Extension } from '@codemirror/state'

export function getLanguageExtension(filePath: string): Extension | null {
  const ext = filePath.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
      return javascript()
    case 'ts':
    case 'tsx':
    case 'mts':
      return javascript({ typescript: true, jsx: ext.includes('x') })
    case 'css':
    case 'scss':
    case 'less':
      return css()
    case 'html':
    case 'htm':
    case 'vue':
    case 'svelte':
      return html()
    case 'json':
      return json()
    case 'md':
    case 'mdx':
      return markdown()
    case 'go':
      return go()
    case 'py':
    case 'pyw':
      return python()
    case 'yaml':
    case 'yml':
      return yaml()
    default:
      return null
  }
}
