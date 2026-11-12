import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { AccentColor } from './types'

export function accentEditorTheme(accent: AccentColor): Extension {
  return EditorView.theme({
    '& .cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':
      {
        backgroundColor: `color-mix(in srgb, ${accent} 30%, transparent) !important`,
      },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: accent },
  })
}
