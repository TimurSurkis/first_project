import { useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { accentEditorTheme } from './editorTheme.js'
import { findLanguage } from './languages.js'

function getSelectionRect(view, from, to) {
  if (from === to) return null

  const start = view.coordsAtPos(from)
  const end = view.coordsAtPos(to)
  const workspace = view.dom.closest('.workspace')
  if (!start || !end || !workspace) return null

  const box = workspace.getBoundingClientRect()
  return {
    left: (start.left + end.right) / 2 - box.left,
    top: Math.min(start.top, end.top) - box.top,
  }
}

function DocumentEditor({
  doc,
  visible,
  settings,
  formatKeymap,
  registerEditor,
  onTextChange,
  onCursorChange,
  onSelectionChange,
}) {
  const language = findLanguage(doc.docName)
  const extensions = useMemo(
    () => [
      language.support(),
      language.name === 'Markdown' ? formatKeymap : [],
      accentEditorTheme(settings.accentColor),
      settings.lineWrapping ? EditorView.lineWrapping : [],
    ],
    [language, formatKeymap, settings.lineWrapping, settings.accentColor],
  )
  const basicSetup = useMemo(() => ({ tabSize: settings.tabSize }), [settings.tabSize])

  const handleChange = useCallback(
    (value) => onTextChange(doc.id, value),
    [doc.id, onTextChange],
  )
  const handleUpdate = useCallback(
    (update) => {
      const { from, to, head } = update.state.selection.main
      const line = update.state.doc.lineAt(head)
      onCursorChange(doc.id, { line: line.number, col: head - line.from + 1 })
      onSelectionChange(doc.id, getSelectionRect(update.view, from, to))
    },
    [doc.id, onCursorChange, onSelectionChange],
  )

  return (
    <CodeMirror
      ref={(node) => registerEditor(doc.id, node)}
      className={`editor${visible ? '' : ' hidden'}`}
      value={doc.text}
      height="100%"
      extensions={extensions}
      basicSetup={basicSetup}
      theme={settings.theme}
      onChange={handleChange}
      onUpdate={handleUpdate}
    />
  )
}

export default DocumentEditor
