import { EditorView } from '@codemirror/view'

export function accentEditorTheme(accent) {
  return EditorView.theme({
    '& .cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground':
      {
        backgroundColor: `color-mix(in srgb, ${accent} 30%, transparent) !important`,
      },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: accent },
  })
}
