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
import I18nProvider from './i18n/I18nProvider.jsx'
import { useTranslation } from './i18n/context.js'
import { createMarkdownKeymap } from './markdownCommands.js'
import { accentEditorTheme } from './editorTheme.js'
import { findLanguage } from './languages.js'
import { loadSettings, saveSettings } from './settings.js'
import './App.css'

const api = window.api

function getBaseName(filePath) {
  return filePath.split(/[\\/]/).pop()
}

function isMarkdownFile(name) {
  return /\.md$/i.test(name)
}

function normalizeFileName(input, t) {
  const name = input.trim()
  if (!name) return null
  if (/[\\/:*?"<>|]/.test(name)) {
    window.alert(t('alert.invalidName'))
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

function Editor({ settings, setSettings }) {
  const { t } = useTranslation()
  const untitledName = `${t('doc.untitled')}.txt`

  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [filePath, setFilePath] = useState(null)
  const [docName, setDocName] = useState(untitledName)
  const [mode, setMode] = useState('edit')
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [showSettings, setShowSettings] = useState(false)

  const editorRef = useRef(null)
  const previewRef = useRef(null)

  const modes = [
    { id: 'edit', label: t('mode.edit'), icon: LuPenLine },
    { id: 'split', label: t('mode.split'), icon: LuColumns2 },
    { id: 'preview', label: t('mode.preview'), icon: LuEye },
  ]

  const language = findLanguage(docName)
  const formatLabel = language.name === 'plain-text' ? t('status.plainText') : language.name
  const formatKeymap = useMemo(() => createMarkdownKeymap(t), [t])
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
    return !isDirty || window.confirm(t('confirm.unsaved'))
  }

  function newFile() {
    if (!confirmDiscard()) return
    setText('')
    setSavedText('')
    setFilePath(null)
    setDocName(untitledName)
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
    const name = normalizeFileName(input, t)
    if (!name || name === docName) return

    if (!filePath) {
      setDocName(name)
      return
    }

    const result = await api.renameFile({ filePath, newName: name })
    if (result.error) {
      window.alert(result.error === 'exists' ? t('error.fileExists', { name }) : result.error)
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
    document.documentElement.lang = settings.language
    document.documentElement.style.setProperty('--accent', settings.accentColor)
    api.setLanguage(settings.language)
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
          <IconButton icon={LuFilePlus} label={t('toolbar.new')} onClick={newFile} />
          <IconButton icon={LuFolderOpen} label={t('toolbar.open')} onClick={openFile} />
          <IconButton icon={LuSave} label={t('toolbar.save')} onClick={() => saveFile(false)} />
          <IconButton
            icon={LuSaveAll}
            label={t('toolbar.saveAs')}
            onClick={() => saveFile(true)}
          />
        </div>
        {isMarkdown && (
          <div className="toolbar-group">
            {modes.map(({ id, label, icon }) => (
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
          <IconButton
            icon={LuSettings}
            label={t('toolbar.settings')}
            onClick={() => setShowSettings(true)}
          />
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
      <StatusBar text={text} cursor={cursor} format={formatLabel} />
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

function App() {
  const [settings, setSettings] = useState(loadSettings)

  return (
    <I18nProvider language={settings.language}>
      <Editor settings={settings} setSettings={setSettings} />
    </I18nProvider>
  )
}

export default App
