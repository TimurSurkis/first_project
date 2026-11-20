# API

Все ответы — JSON, кроме `204` выхода. `/api/*` возвращает `Cache-Control: no-store`.
Все ID — положительные числа. Сервер не принимает пути к файлам и чужой `ownerId`.

## Авторизация

| Метод | Маршрут | Тело |
|---|---|---|
| POST | `/api/auth/register` | `{ "email": "...", "password": "..." }` |
| POST | `/api/auth/login` | то же |
| GET | `/api/auth/me` | — |
| POST | `/api/auth/logout` | — |

Email нормализуется, пароль 10–128 символов. Register создаёт аккаунт и сессию.
Вход / регистрация ограничены 30 запросами за 15 минут на IP (общее окно).
Login / register / me возвращают `{ user: { id, email }, csrfToken, expiresAt }`.
Cookie — HttpOnly, SameSite=Strict, в production Secure; срок 24 часа без rolling.

Изменяющие запросы требуют `Origin: <APP_ORIGIN>` и `X-Editor-Request: 1`.
Сессионные изменяющие запросы дополнительно требуют `X-CSRF-Token` из ответа авторизации.
Клиент передаёт ожидаемый ID аккаунта через `X-Editor-User` для документов и logout.
Несовпадение аккаунта даёт `401 SESSION_CHANGED`; это дополнительная защита клиента,
а права определяются исключительно серверной сессией.

## Документы

Все маршруты требуют сессию и ограничены владельцем.

| Метод | Маршрут | Тело / результат |
|---|---|---|
| GET | `/api/documents?deleted=false&offset=0&limit=50` | `{ items, nextOffset }` |
| GET | `/api/documents?deleted=true` | корзина, тот же формат |
| POST | `/api/documents` | `{ name, content?: "" }` → полный документ, 201 |
| POST | `/api/documents/import` | multipart: один `file` → полный документ, 201 |
| GET | `/api/documents/:id` | полный документ, включая `deletedAt` |
| PATCH | `/api/documents/:id` | `{ version, name?, content? }` → `{ version }` |
| POST | `/api/documents/:id/trash` | `{ version }` → `{ version }` |
| POST | `/api/documents/:id/restore` | `{ version }` → `{ version }` |
| DELETE | `/api/documents/:id` | `{ version }`, только из корзины |

Метаданные: `id, name, version, deletedAt, createdAt, updatedAt`.
Полный документ дополнительно содержит `content`.
Предел страницы — 100; `nextOffset: null` означает конец списка.
Имя 1–255 символов, без разделителей пути, управляющих символов и `\\ / : * ? " < > |`.
Одинаковые имена разрешены. Текст до 2 MiB в UTF-8, импортируемый файл до 5 MiB.
DOCX дополнительно ограничен 1000 ZIP-элементами и 20 MiB распакованных данных.

Обновление содержит хотя бы одно из полей `name` / `content`.
Версия проверяется вместе с владельцем и состоянием корзины одной SQL-операцией.
Ответ возвращает ровно подтверждённую версию этой операции, а не текст более позднего писателя.
После DELETE возвращаемая версия условная; сам документ уже удалён.

## Ошибки

```json
{ "error": { "code": "VERSION_CONFLICT", "message": "Document changed or moved to trash in another window" } }
```

- `400 VALIDATION`, `IMPORT_FAILED`, `DOC_UNSUPPORTED`: неверный запрос / файл.
- `401 UNAUTHORIZED`, `SESSION_CHANGED`, `INVALID_CREDENTIALS`: вход или повторный вход.
- `403 ORIGIN`, `CSRF`: отклонённый источник / защита запроса.
- `404 NOT_FOUND`: документа нет или он принадлежит другому пользователю.
- `409 VERSION_CONFLICT`: версия / состояние документа изменились; не повторять запись вслепую.
- `409 EMAIL_EXISTS`: email уже используется.
- `429 RATE_LIMIT`: слишком много попыток входа.
- `500 INTERNAL`: внутренняя ошибка; детали записываются только на сервере.

`GET /api/health` проверяет HTTP-процесс, а не полную готовность MySQL.
