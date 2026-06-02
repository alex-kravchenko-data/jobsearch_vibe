# 🎯 JobSearch Vibe

Агрегатор вакансій з українських job-бордів (**DOU**, **work.ua**, **Djinni**,
опційно LinkedIn) з фільтрами, гридом результатів, експортом у CSV/JSON та
кнопкою **«Розумний пошук»**, що відсіює нерелевантне й сортує найкращі вакансії.

## Архітектура

```
Користувач
   │
   ▼
GitHub Pages  ──(fetch)──►  Vercel Serverless API  ──►  DOU RSS / work.ua / Djinni
(статичний                  (/api/search:                (парсинг + нормалізація)
 фронтенд /public)           агрегація, фільтри,
                             дедуплікація, ранжування)
   │
   └── Supabase Auth (опційно) — вхід через magic-link
```

- **Фронтенд** — статика (`/public`), без збірки. Хоститься на **GitHub Pages**.
- **Бекенд** — **serverless-функції на Vercel** (`/api`). Вирішує CORS і робить
  скрапінг на сервері (з браузера це неможливо через CORS та анти-бот).
- **Авторизація** — Supabase Auth. Якщо не налаштовано — працює гостьовий режим.
- **«Розумний пошук»** — евристичне ранжування; з `ANTHROPIC_API_KEY` додається
  переранжування через Claude.

## Джерела даних

| Джерело   | Метод                          | Надійність | Примітка |
|-----------|--------------------------------|------------|----------|
| DOU       | Офіційні RSS-стрічки           | ✅ висока   | Найкраще IT-джерело, легально |
| work.ua   | Парсинг HTML                   | 🟡 середня | #1 загальний борд (~106K) |
| robota.ua | Публічний JSON API (api.robota.ua) | 🟡 середня | #2 загальний борд (~110K) |
| Jooble    | Офіційний API (потрібен ключ)  | ✅ висока   | Мета-агрегатор сотень джерел |
| Djinni    | Парсинг HTML (best-effort)     | 🟠 низька   | Анти-бот, може віддавати порожньо |
| OLX       | Публічний JSON API (best-effort) | 🟠 низька  | Величезне охоплення, регіони |
| LinkedIn  | Неофіційний guest-endpoint     | 🔴 ризик    | **Вимкнено за замовч.**, проти ToS |

> **Jooble** вмикається, коли заданий `JOOBLE_API_KEY` (безкоштовний ключ на
> [jooble.org/api/about](https://jooble.org/api/about)). Без ключа джерело
> просто пропускається.

> ⚠️ LinkedIn-скрапінг порушує умови використання LinkedIn і легко блокується.
> Вмикається лише через `ENABLE_LINKEDIN=true`. Використовуйте на власний ризик.
> Рекомендований шлях — DOU / work.ua / Djinni.

## Локальний запуск

```bash
npm install
npm i -g vercel        # один раз
vercel dev             # фронтенд + API на http://localhost:3000
```

Або окремо лише фронтенд (API треба піднімати окремо):

```bash
npm run serve:frontend
```

## Деплой

### 1. Бекенд → Vercel
1. Залийте репозиторій на GitHub.
2. На [vercel.com](https://vercel.com) → **Import Project** → виберіть репо.
3. У **Settings → Environment Variables** додайте (див. `.env.example`):
   - `ALLOWED_ORIGIN` = `https://<ваш-логін>.github.io`
   - `ANTHROPIC_API_KEY` *(опційно)*
   - `ENABLE_LINKEDIN` *(опційно)*
4. Після деплою скопіюйте URL виду `https://<проєкт>.vercel.app`.

### 2. Фронтенд → GitHub Pages
1. У `public/js/config.js` встановіть `API_BASE` = ваш Vercel URL.
2. *(Опційно)* для авторизації заповніть `SUPABASE_URL` і `SUPABASE_ANON_KEY`.
3. У репозиторії: **Settings → Pages → Source: GitHub Actions**.
4. Пуш у `main` запускає workflow `deploy-pages.yml`, який публікує `/public`.

## API

`GET /api/search`

| Параметр   | Опис                                            |
|------------|-------------------------------------------------|
| `q`        | пошуковий запит (`senior motion designer`)      |
| `remote`   | `remote` \| `office` \| `any`                   |
| `location` | місто (фільтр за підрядком)                      |
| `category` | категорія DOU (`Design`, `3D/Animation`, …)     |
| `sources`  | через кому: `dou,work.ua,robota.ua,djinni,olx,jooble,linkedin` |
| `smart`    | `1` — увімкнути розумне ранжування              |
| `limit`    | макс. результатів (за замовч. 100)              |

Відповідь:
```json
{ "query": "...", "count": 12, "total": 40, "smart": true,
  "sources": ["dou","work.ua"], "errors": {}, "jobs": [ /* ... */ ] }
```

## Структура

```
public/            статичний фронтенд (GitHub Pages)
  index.html
  css/styles.css
  js/{config,auth,api,export,app}.js
api/               serverless-функції (Vercel)
  search.js        головний ендпоінт
  _lib/            cors, нормалізація, ранжування, fetch
  _sources/        dou, workua, robotaua, jooble, djinni, olx, linkedin
.github/workflows/deploy-pages.yml
vercel.json
```

## Дисклеймер

Демо-проєкт для навчання. Парсинг сторонніх сайтів робіть з повагою до їхніх
Terms of Service, robots.txt і лімітів. Пріоритет — офіційним API та RSS.
