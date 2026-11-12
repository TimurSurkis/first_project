import { useCallback, useMemo } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { accentEditorTheme } from './editorTheme.ts'
import { findLanguage } from './languages.ts'
import type { CursorPosition, DocumentId, EditorDocument, EditorSettings } from './types'

interface DocumentEditorProps {
	doc: EditorDocument
	visible: boolean
	settings: EditorSettings
	formatKeymap: Extension
	registerEditor: (id: DocumentId, node: ReactCodeMirrorRef | null) => void
	onTextChange: (id: DocumentId, text: string) => void
	onCursorChange: (id: DocumentId, cursor: CursorPosition) => void
}

function DocumentEditor({
  doc,
  visible,
  settings,
  formatKeymap,
  registerEditor,
  onTextChange,
	onCursorChange,
}: DocumentEditorProps) {
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
    (value: string) => onTextChange(doc.id, value),
    [doc.id, onTextChange],
  )
	const handleUpdate = useCallback(
    (update: ViewUpdate) => {
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
