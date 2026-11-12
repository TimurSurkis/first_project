# Разработка и запуск

## Требования

- Node.js (рекомендуется LTS).
- npm.

## Установка и команды

Из корня проекта выполните:

```bash
npm install
npm start
```

`npm start` сначала выполняет production-сборку интерфейса Vite, затем запускает Electron. Для проверки отдельных задач:

```bash
npm run dev      # Vite dev-сервер для интерфейса
npm run build    # сборка интерфейса в dist/
npm run preview  # предпросмотр собранного интерфейса
npm run lint     # Oxlint
npm run typecheck # проверка типов renderer и Electron без генерации файлов
npm run build:electron # компиляция Electron в dist-electron/
npm run typecheck:electron # проверка типов Electron без генерации файлов
```

`npm run dev` запускает только фронтенд Vite; сам по себе он не поднимает Electron. Для полного приложения используйте `npm start`.

## TypeScript: конфигурация и общие типы

В `tsconfig.json` настроен renderer (React + Vite). Сборку JavaScript выполняет Vite; TypeScript только проверяет типы (`noEmit`). `npm run build` сначала запускает `npm run typecheck`.

Основные настройки:

- `strict: false` оставлен для постепенной миграции; нужные проверки заданы по отдельности: в частности, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply` и `useUnknownInCatchVariables`.
- `noUncheckedIndexedAccess` — элемент массива или словаря может отсутствовать; перед использованием нужна проверка.
- `exactOptionalPropertyTypes` — отсутствие необязательного свойства отличается от явного `undefined`.
- `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters` — проверки возвратов, веток и неиспользуемого кода.
- `moduleResolution: "Bundler"`, `module: "ESNext"`, `jsx: "react-jsx"`, `isolatedModules` и `verbatimModuleSyntax` — режим для Vite и React. Типы импортируются через `import type`.
- `resolveJsonModule` — типизированные импорты словарей переводов; `types: ["vite/client"]` — типы CSS, ресурсов и `import.meta.env` без автоматического подключения Node.js globals к renderer.
- `skipLibCheck` — пропуск внутренней проверки деклараций зависимостей, но не собственного `.ts/.tsx`-кода.

Renderer (`src/`), конфигурация Vite и Electron main/preload переведены на TypeScript. `tsconfig.json` проверяет renderer и `vite.config.ts`; `tsconfig.electron.json` проверяет Electron с NodeNext и CommonJS-выходом из `.cts` в `.cjs`. `npm run build` проверяет типы обеих частей, собирает renderer и компилирует Electron. `npm start` запускает скомпилированный main из `dist-electron/electron/main.cjs`. `allowJs: true` оставлен для постепенного перехода оставшихся конфигурационных файлов; `checkJs: false` не проверяет JavaScript.

Общие контракты:

- `src/types.ts` — `EditorDocument`, `TabsState`, `CursorPosition`, `EditorSettings`, режимы просмотра, команды форматирования, варианты Dropdown и типы переводов. `TranslationKey` выводится из английского словаря.
- `shared/electron-api.ts` — параметры/результаты файловых операций, команды меню, `ElectronAPI` и типы IPC-каналов. Результаты открытия различают импорт DOCX и обычный файл; отмена диалога возвращает `null`.
- `src/global.d.ts` — объявление `window.api` для renderer. Сам API создаётся в `electron/preload.cts` и экспортируется через `contextBridge`.

Например, при переносе компонента можно импортировать `EditorDocument` из `./types` через `import type`. Для обновлений настроек и документа предусмотрены `SettingsPatch` и `DocumentPatch`. Числовые диапазоны (например, ширина панели), данные из `localStorage` и входящие IPC-данные всё равно требуют проверок во время выполнения: TypeScript не валидирует их автоматически.

Основания для конфигурации: [TypeScript TSConfig Reference](https://www.typescriptlang.org/tsconfig/) и [TypeScript в Vite](https://vite.dev/guide/features.html#typescript).

## Где менять функциональность

- Интерфейс и состояние вкладок: `src/App.tsx` и компоненты `.tsx` в `src/`.
- Команды Markdown и keymap: `src/markdownCommands.ts`.
- Языки подсветки по расширению: `src/languages.ts`.
- Настройки: `src/settings.ts`, `src/SettingsDialog.tsx`.
- Переводы интерфейса и системных меню: `locales/ru.json`, `locales/en.json`.
- Операции с файлами, диалоги и меню Electron: `electron/main.cts`.
- Ограниченный мост IPC для renderer: `electron/preload.cts`.

После изменения интерфейса проверьте `npm run lint` и `npm run build`. Проверяйте операции открытия/сохранения и предупреждения о несохранённых изменениях в запущенном Electron через `npm start`.

## Ограничения сборки

В проекте настроена сборка фронтенда, но нет конфигурации для выпуска установщиков (`.exe`, `.dmg`, `.deb`). `dist/` содержит собранный renderer, это не установочный пакет приложения.
