import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import './App.css'

const api = window.api

function getFileName(filePath) {
  return filePath ? filePath.split(/[\\/]/).pop() : 'Без названия'
}

function App() {
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [filePath, setFilePath] = useState(null)

  const isDirty = text !== savedText

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
    return api.onMenuCommand((command) => {
      if (command === 'new') newFile()
      if (command === 'open') openFile()
      if (command === 'save') saveFile(false)
      if (command === 'save-as') saveFile(true)
    })
  })

  return (
    <div className="app">
      <header className="toolbar">
        <div className="actions">
          <button type="button" onClick={newFile}>Новый</button>
          <button type="button" onClick={openFile}>Открыть</button>
          <button type="button" onClick={() => saveFile(false)}>Сохранить</button>
          <button type="button" onClick={() => saveFile(true)}>Сохранить как</button>
        </div>
        <span className="title">
          {getFileName(filePath)}
          {isDirty ? ' •' : ''}
        </span>
      </header>
      <CodeMirror
        className="editor"
        value={text}
        height="100%"
        extensions={[markdown()]}
        onChange={(value) => setText(value)}
      />
    </div>
  )
}

export default App
