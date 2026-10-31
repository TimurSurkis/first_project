# Text Editor

Текстовый редактор, который работает в браузере и как десктопное приложение (Electron).

## Стек

- React + Vite
- CodeMirror 6 (через `@uiw/react-codemirror`)
- Electron

## Запуск

Установка зависимостей:

```bash
npm install
```

Веб-версия с горячей перезагрузкой:

```bash
npm run dev
```

Десктопное приложение (собирает фронтенд и открывает окно Electron):

```bash
npm start
```

Сборка фронтенда без запуска:

```bash
npm run build
```
