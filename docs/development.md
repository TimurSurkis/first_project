# Разработка и развёртывание без Docker

## Требования

- Node.js 22.16+ (рекомендуется актуальная LTS) и npm.
- MySQL 8+ как обычная системная служба.
- Для десктопной оболочки — окружение, поддерживаемое Electron.

Docker, контейнеры и глобальный Sequelize CLI не нужны.

## 1. MySQL

На Ubuntu / Debian, если MySQL ещё не установлен:

```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl enable --now mysql
sudo mysql
```

В административной консоли MySQL выполните (пароль замените своим):

```sql
CREATE DATABASE text_editor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'text_editor'@'127.0.0.1' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT ALL PRIVILEGES ON text_editor.* TO 'text_editor'@'127.0.0.1';
```

Приложение подключается по TCP к `127.0.0.1`, не под root и не через системную socket-аутентификацию.
MySQL не нужно публиковать в интернет. В production желательно разделить пользователя миграций
с DDL-правами и runtime-пользователя с SELECT / INSERT / UPDATE / DELETE.

## 2. Конфигурация

```bash
npm install
cp .env.example .env
```

Отредактируйте `.env`, прежде всего DB_PASSWORD. Файл исключён из Git.
Значения по умолчанию в примере рассчитаны на Vite:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
APP_ORIGIN=http://localhost:5173
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=text_editor
DB_USER=text_editor
DB_PASSWORD=your-password
EDITOR_URL=http://localhost:5173
```

`APP_ORIGIN` — точный адрес, который видит браузер, без завершающего `/` и пути.
Не смешивайте `localhost` и `127.0.0.1` в адресах фронтенда: это разные origin и cookie.
DB_* используются только сервером и никогда не передаются в Vite через VITE_*.

## 3. Миграции

```bash
npm run db:migrate
```

Миграции применяются отдельно от старта приложения. Повторный запуск пропускает уже выполненные.
Запускайте миграции одним процессом, предварительно делая backup при обновлении рабочей базы.
MySQL DDL не является одной откатываемой транзакцией: при сбое миграции сначала выясните состояние
таблиц, не удаляйте рабочую базу и не используйте `sync({ force: true })` / `alter: true`.

## 4. Разработка

В первом терминале:

```bash
npm run dev:server
```

Во втором:

```bash
npm run dev
```

Браузер: **http://localhost:5173**. Vite проксирует `/api` на `127.0.0.1:3000`.
Порт API фиксирован в `vite.config.ts`; при изменении PORT обновите proxy target.

Дополнительно, в третьем терминале:

```bash
npm run build:electron
npm run electron
```

Electron читает EDITOR_URL из `.env` и загружает тот же серверный фронтенд.
В браузере некоторые системные сочетания (например Ctrl+N / Ctrl+W) могут перехватываться браузером;
действия всегда доступны кнопками интерфейса. В Electron используются нативные accelerators.

## 5. Проверка собранного приложения локально

В `.env` измените:

```dotenv
APP_ORIGIN=http://localhost:3000
EDITOR_URL=http://localhost:3000
```

```bash
npm run build
npm start
```

Теперь Express отдаёт и `/api`, и React из `dist/`. Откройте http://localhost:3000
или запустите `npm run electron`. Vite для этого не нужен.
`npm run preview` не является полноценным сервером приложения.

## 6. Проверки и интеграционные тесты

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

Обычные тесты проверяют парольные хеши, защиту API, очередь сохранений, конфликты,
неоднозначные сетевые сбои, Markdown, HTML и безопасность Electron без MySQL.
Интеграционный набор по умолчанию пропущен.

Для проверки реальных MySQL-запросов создайте **отдельную** базу:

```sql
CREATE DATABASE text_editor_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON text_editor_test.* TO 'text_editor'@'127.0.0.1';
```

```bash
TEST_DB_NAME=text_editor_test npm run test:integration
```

Остальные DB_* читаются из `.env`. Тесты требуют имя с суффиксом `_test`, применяют миграции,
создают уникальные тестовые аккаунты и удаляют только свои записи. Рабочую базу не используйте.

Sequelize 6 использует устаревший uuid; в package.json зафиксирован override на совместимую
CommonJS-версию uuid 11 с исправлением advisory GHSA-w5hq-g745-h8pq. Не применяйте
предлагаемый npm audit откат Sequelize на старую major-версию.

## 7. Рабочий сервер

Установите Node.js и MySQL, создайте базу / пользователя, разместите проект, например в `/srv/text-editor`.
Установите зависимости, соберите проект и задайте:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
APP_ORIGIN=https://editor.example.com
EDITOR_URL=https://editor.example.com
# DB_* — реальные параметры MySQL
```

```bash
npm ci
npm run build
npm run db:migrate:production
```

Пример unit-файла `/etc/systemd/system/text-editor.service`
(создание пользователя text-editor и права на каталог настраиваются администратором):

```ini
[Unit]
Description=Text Editor server
After=network.target mysql.service

[Service]
Type=simple
User=text-editor
WorkingDirectory=/srv/text-editor
EnvironmentFile=/srv/text-editor/.env
ExecStart=/usr/bin/node /srv/text-editor/dist-server/server/src/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Уточните путь к Node через `command -v node`. `.env` должен читаться только владельцем службы.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now text-editor
sudo journalctl -u text-editor -f
```

Пример Caddyfile при настроенном DNS домена:

```caddyfile
editor.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy получает TLS-сертификат; наружу открыты только HTTPS / HTTP для редиректа и выдачи сертификата.
Express доверяет forwarded-заголовкам только от loopback-прокси.
В production HTTP в APP_ORIGIN не допускается, сессионная cookie всегда Secure.
Десктопный клиент должен получить тот же HTTPS-адрес в своём EDITOR_URL.

## 8. Резервные копии

Пример (запускается администратором, пароль вводится интерактивно):

```bash
mysqldump --single-transaction --no-tablespaces --set-gtid-purged=OFF -h 127.0.0.1 -u text_editor -p text_editor > backup.sql
```

Храните резервные копии вне сервера с ограниченным доступом. Проверяйте восстановление в отдельную базу:

```bash
mysql -h 127.0.0.1 -u restore_user -p restore_database < backup.sql
```

Backup содержит пользовательские документы, хеши паролей и сессионные метаданные;
его нужно защищать как саму базу. Корзина и номера версий не заменяют резервное копирование.

## Сборки

- `dist/`: фронтенд Vite.
- `dist-server/`: Express, миграции и shared-типы.
- `dist-electron/`: main / preload Electron.

Запуск production-команд выполняется из корня проекта: от него зависят путь `.env` и `dist/`.
Установщики Electron пока не настроены.
