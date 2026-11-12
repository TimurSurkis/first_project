# Архитектура

Приложение состоит из Electron main-процесса и React renderer-интерфейса, собранного Vite.

## Поток выполнения

1. Скомпилированный `electron/main.cjs` создаёт окно Electron и загружает `dist/index.html`.
2. `src/main.tsx` монтирует React-приложение; `src/App.tsx` управляет документами, вкладками, настройками и режимами Markdown.
3. Каждая вкладка отображает отдельный `DocumentEditor` на основе CodeMirror 6. Язык выбирается функцией `findLanguage` в `src/languages.ts` по расширению файла.
4. Операции файлов и системные диалоги выполняются в main-процессе. Renderer вызывает только методы, предоставленные через скомпилированный `electron/preload.cjs` и `contextBridge` (`window.api`), используя IPC.

## Основные модули

- `electron/main.cts` — исходник Electron main-процесса; компилируется в `dist-electron/electron/main.cjs`. Отвечает за окно, меню, IPC и файловые операции.
- `electron/preload.cts` — исходник ограниченного IPC-моста; компилируется в `dist-electron/electron/preload.cjs`. Renderer не обращается напрямую к Node.js API.
- `electron/mammoth.d.cts` — локальная декларация типов для используемого API Mammoth, у которого нет встроенных деклараций типов.
- `vite.config.ts` — конфигурация Vite с React-плагином и относительным base path для Electron.
- `src/App.tsx` — состояние документов и их вкладок, команды меню, просмотр Markdown и синхронизация прокрутки.
- `src/DocumentEditor.tsx` — React-обёртка CodeMirror, тема, перенос строк, фиксация текста и позиции курсора.
- `src/markdownCommands.ts` и `src/FormatToolbar.tsx` — команды форматирования и горячие клавиши Markdown.
- `src/settings.ts` и `src/SettingsDialog.tsx` — типизированные значения параметров и UI настроек. Сохранение настроек производится через `localStorage`.
- `locales/` и `src/i18n/` — словари и React-интеграция переводов; Electron читает те же словари для системного меню и диалогов.
- `shared/electron-api.ts` — общий контракт API и IPC-каналов для main, preload и renderer; `src/global.d.ts` объявляет `window.api` для renderer.

## Модель документов и хранение

Содержимое открытых документов, активная вкладка, курсор и режим просмотра хранятся в состоянии React в течение текущего сеанса. Настройки интерфейса сохраняются в `localStorage` под ключом `editor-settings`. Содержимое документов записывается на диск только при явном сохранении.

Для отслеживания несохранённых изменений renderer сравнивает текущий текст с сохранённым снимком и передаёт признак dirty в main-процесс через IPC. Main-процесс использует этот признак при закрытии окна.

## DOCX

Импорт выполняется в main-процессе с помощью Mammoth (DOCX → HTML) и Turndown (HTML → Markdown). Изображения отбрасываются. Это импорт-конвертация, а не редактирование исходного DOCX.
