import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import StatusBar from './StatusBar.jsx'
import FormatToolbar from './FormatToolbar.jsx'
import SettingsDialog from './SettingsDialog.jsx'
import { markdownKeymap } from './markdownCommands.js'
import { loadSettings, saveSettings } from './settings.js'
import './App.css'

const api = window.api

const MODES = [
  { id: 'edit', label: 'Редактор' },
  { id: 'split', label: 'Разделить' },
  { id: 'preview', label: 'Предпросмотр' },
]

function getFileName(filePath) {
  return filePath ? filePath.split(/[\\/]/).pop() : 'Без названия'
}

function isMarkdownFile(filePath) {
  return Boolean(filePath) && /\.md$/i.test(filePath)
}

function syncScroll(from, to) {
  const fromMax = from.scrollHeight - from.clientHeight
  const toMax = to.scrollHeight - to.clientHeight
  if (fromMax <= 0 || toMax <= 0) return

  const target = (from.scrollTop / fromMax) * toMax
  if (Math.abs(to.scrollTop - target) > 1) to.scrollTop = target
}

function App() {
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [filePath, setFilePath] = useState(null)
  const [mode, setMode] = useState('edit')
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)

  const editorRef = useRef(null)
  const previewRef = useRef(null)

  const extensions = useMemo(
    () => [markdown(), markdownKeymap, settings.lineWrapping ? EditorView.lineWrapping : []],
    [settings.lineWrapping],
  )
  const basicSetup = useMemo(() => ({ tabSize: settings.tabSize }), [settings.tabSize])
  const handleCursorUpdate = useCallback((update) => {
    const head = update.state.selection.main.head
    const line = update.state.doc.lineAt(head)
    setCursor({ line: line.number, col: head - line.from + 1 })
  }, [])

  const isDirty = text !== savedText
  const isMarkdown = isMarkdownFile(filePath)
  const currentMode = isMarkdown ? mode : 'edit'
  const showEditor = currentMode !== 'preview'
  const showPreview = currentMode !== 'edit'
  const isSplit = currentMode === 'split'

  function runFormat(command) {
    const view = editorRef.current?.view
    if (!view) return
    command(view)
    view.focus()
  }

  function confirmDiscard() {
    return !isDirty || window.confirm('Есть несохранённые изменения. Продолжить без сохранения?')
  }

  function newFile() {
    if (!confirmDiscard()) return
    setText('')
    setSavedText('')
    setFilePath(null)
  }

  async function openFile() {
    if (!confirmDiscard()) return
    const file = await api.openFile()
    if (!file) return
    setText(file.content)
    setSavedText(file.content)
    setFilePath(file.filePath)
  }

  async function saveFile(saveAs = false) {
    const content = text
    const result = await api.saveFile({ content, filePath: saveAs ? null : filePath })
    if (!result) return
    setFilePath(result.filePath)
    setSavedText(content)
  }

  useEffect(() => {
    api.setDirty(isDirty)
  }, [isDirty])

  useEffect(() => {
    saveSettings(settings)
    document.documentElement.dataset.theme = settings.theme
  }, [settings])

  function updateSettings(patch) {
    setSettings((current) => ({ ...current, ...patch }))
  }

  function toggleTheme() {
    setSettings((current) => ({
      ...current,
      theme: current.theme === 'dark' ? 'light' : 'dark',
    }))
  }

  useEffect(() => {
    return api.onMenuCommand((command) => {
      if (command === 'new') newFile()
      if (command === 'open') openFile()
      if (command === 'save') saveFile(false)
      if (command === 'save-as') saveFile(true)
      if (command === 'toggle-theme') toggleTheme()
    })
  })

  useEffect(() => {
    const editorScroller = editorRef.current?.view?.scrollDOM
    const preview = previewRef.current
    if (!isSplit || !editorScroller || !preview) return

    const onEditorScroll = () => syncScroll(editorScroller, preview)
    const onPreviewScroll = () => syncScroll(preview, editorScroller)

    editorScroller.addEventListener('scroll', onEditorScroll)
    preview.addEventListener('scroll', onPreviewScroll)
    return () => {
      editorScroller.removeEventListener('scroll', onEditorScroll)
      preview.removeEventListener('scroll', onPreviewScroll)
    }
  }, [isSplit])

  return (
    <div className="app">
      <header className="toolbar">
        <div className="actions">
          <button type="button" onClick={newFile}>Новый</button>
          <button type="button" onClick={openFile}>Открыть</button>
          <button type="button" onClick={() => saveFile(false)}>Сохранить</button>
          <button type="button" onClick={() => saveFile(true)}>Сохранить как</button>
          <button type="button" onClick={toggleTheme}>Тема</button>
          <button type="button" onClick={() => setShowSettings(true)}>Настройки</button>
          {isMarkdown &&
            MODES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={currentMode === id ? 'active' : ''}
                aria-pressed={currentMode === id}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
        </div>
        <span className="title">
          {getFileName(filePath)}
          {isDirty ? ' •' : ''}
        </span>
      </header>
      {isMarkdown && showEditor && <FormatToolbar onRun={runFormat} />}
      <div
        className={`workspace${isSplit ? ' split' : ''}`}
        style={{ '--editor-font-size': `${settings.fontSize}px` }}
      >
        <CodeMirror
          ref={editorRef}
          className={`editor${showEditor ? '' : ' hidden'}`}
          value={text}
          height="100%"
          extensions={extensions}
          basicSetup={basicSetup}
          theme={settings.theme}
          onChange={(value) => setText(value)}
          onUpdate={handleCursorUpdate}
        />
        {showPreview && (
          <div className="preview" ref={previewRef}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        )}
      </div>
      <StatusBar text={text} cursor={cursor} format={isMarkdown ? 'Markdown' : 'Обычный текст'} />
      {showSettings && (
        <SettingsDialog
          settings={settings}
          onChange={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

export default App
