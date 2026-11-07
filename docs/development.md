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
```

`npm run dev` запускает только фронтенд Vite; сам по себе он не поднимает Electron. Для полного приложения используйте `npm start`.

## Где менять функциональность

- Интерфейс и состояние вкладок: `src/App.jsx` и компоненты в `src/`.
- Команды Markdown и keymap: `src/markdownCommands.js`.
- Языки подсветки по расширению: `src/languages.js`.
- Настройки: `src/settings.js`, `src/SettingsDialog.jsx`.
- Переводы интерфейса и системных меню: `locales/ru.json`, `locales/en.json`.
- Операции с файлами, диалоги и меню Electron: `electron/main.cjs`.
- Ограниченный мост IPC для renderer: `electron/preload.cjs`.

После изменения интерфейса проверьте `npm run lint` и `npm run build`. Проверяйте операции открытия/сохранения и предупреждения о несохранённых изменениях в запущенном Electron через `npm start`.

## Ограничения сборки

В проекте настроена сборка фронтенда, но нет конфигурации для выпуска установщиков (`.exe`, `.dmg`, `.deb`). `dist/` содержит собранный renderer, это не установочный пакет приложения.
