import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  LuColumns2,
  LuEye,
  LuFilePlus,
  LuFolderOpen,
  LuPenLine,
  LuSave,
  LuSaveAll,
  LuSettings,
} from 'react-icons/lu'
import IconButton from './IconButton.jsx'
import StatusBar from './StatusBar.jsx'
import FormatToolbar from './FormatToolbar.jsx'
import SettingsDialog from './SettingsDialog.jsx'
import EditableTitle from './EditableTitle.jsx'
import { markdownKeymap } from './markdownCommands.js'
import { accentEditorTheme } from './editorTheme.js'
import { findLanguage } from './languages.js'
import { loadSettings, saveSettings } from './settings.js'
import './App.css'

const api = window.api

const MODES = [
  { id: 'edit', label: 'Редактор', icon: LuPenLine },
  { id: 'split', label: 'Разделить', icon: LuColumns2 },
  { id: 'preview', label: 'Предпросмотр', icon: LuEye },
]

const DEFAULT_NAME = 'Без названия.txt'

function getBaseName(filePath) {
  return filePath.split(/[\\/]/).pop()
}

function isMarkdownFile(name) {
  return /\.md$/i.test(name)
}

function normalizeFileName(input) {
  const name = input.trim()
  if (!name) return null
  if (/[\\/:*?"<>|]/.test(name)) {
    window.alert('Имя файла не может содержать символы \\ / : * ? " < > |')
    return null
  }
  return /\.[^./\\]+$/.test(name) ? name : `${name}.txt`
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
  const [docName, setDocName] = useState(DEFAULT_NAME)
  const [mode, setMode] = useState('edit')
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)

  const editorRef = useRef(null)
  const previewRef = useRef(null)

  const language = findLanguage(docName)
  const extensions = useMemo(
    () => [
      language.support(),
      language.name === 'Markdown' ? markdownKeymap : [],
      accentEditorTheme(settings.accentColor),
      settings.lineWrapping ? EditorView.lineWrapping : [],
    ],
    [language, settings.lineWrapping, settings.accentColor],
  )
  const basicSetup = useMemo(() => ({ tabSize: settings.tabSize }), [settings.tabSize])
  const handleCursorUpdate = useCallback((update) => {
    const head = update.state.selection.main.head
    const line = update.state.doc.lineAt(head)
    setCursor({ line: line.number, col: head - line.from + 1 })
  }, [])

  const isDirty = text !== savedText
  const isMarkdown = isMarkdownFile(docName)
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
    setDocName(DEFAULT_NAME)
  }

  async function openFile() {
    if (!confirmDiscard()) return
    const file = await api.openFile()
    if (!file) return
    setText(file.content)
    setSavedText(file.content)
    setFilePath(file.filePath)
    setDocName(getBaseName(file.filePath))
  }

  async function saveFile(saveAs = false) {
    const content = text
    const result = await api.saveFile({
      content,
      filePath: saveAs ? null : filePath,
      defaultName: docName,
    })
    if (!result) return
    setFilePath(result.filePath)
    setDocName(getBaseName(result.filePath))
    setSavedText(content)
  }

  async function renameDocument(input) {
    const name = normalizeFileName(input)
    if (!name || name === docName) return

    if (!filePath) {
      setDocName(name)
      return
    }

    const result = await api.renameFile({ filePath, newName: name })
    if (result.error) {
      window.alert(result.error)
      return
    }
    setFilePath(result.filePath)
    setDocName(getBaseName(result.filePath))
  }

  useEffect(() => {
    api.setDirty(isDirty)
  }, [isDirty])

  useEffect(() => {
    saveSettings(settings)
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.style.setProperty('--accent', settings.accentColor)
  }, [settings])

  function updateSettings(patch) {
    setSettings((current) => ({ ...current, ...patch }))
  }

  useEffect(() => {
    return api.onMenuCommand((command) => {
      if (command === 'new') newFile()
      if (command === 'open') openFile()
      if (command === 'save') saveFile(false)
      if (command === 'save-as') saveFile(true)
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
        <div className="toolbar-group">
          <IconButton icon={LuFilePlus} label="Новый" onClick={newFile} />
          <IconButton icon={LuFolderOpen} label="Открыть" onClick={openFile} />
          <IconButton icon={LuSave} label="Сохранить" onClick={() => saveFile(false)} />
          <IconButton icon={LuSaveAll} label="Сохранить как" onClick={() => saveFile(true)} />
        </div>
        {isMarkdown && (
          <div className="toolbar-group">
            {MODES.map(({ id, label, icon }) => (
              <IconButton
                key={id}
                icon={icon}
                label={label}
                pressed={currentMode === id}
                onClick={() => setMode(id)}
              />
            ))}
          </div>
        )}
        <div className="toolbar-end">
          <EditableTitle name={docName} isDirty={isDirty} onRename={renameDocument} />
          <IconButton icon={LuSettings} label="Настройки" onClick={() => setShowSettings(true)} />
        </div>
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
      <StatusBar text={text} cursor={cursor} format={language.name} />
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
