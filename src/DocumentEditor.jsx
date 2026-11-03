import { useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { accentEditorTheme } from './editorTheme.js'
import { findLanguage } from './languages.js'

function DocumentEditor({
  doc,
  visible,
  settings,
  formatKeymap,
  registerEditor,
  onTextChange,
  onCursorChange,
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
      const head = update.state.selection.main.head
      const line = update.state.doc.lineAt(head)
      onCursorChange(doc.id, { line: line.number, col: head - line.from + 1 })
    },
    [doc.id, onCursorChange],
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
