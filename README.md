# 🎯 JobSearch Vibe

Агрегатор вакансій з українських job-бордів (**DOU**, **work.ua**, **robota.ua**,
опційно Jooble; Djinni/LinkedIn — best-effort) з фільтрами, гридом/списком
результатів, експортом у CSV/JSON та кнопкою **«Розумний пошук»**, що відсіює
нерелевантне й сортує найкращі вакансії. Плюс вкладка **аналізу резюме** на базі Claude.

## Можливості

- 🔍 **Пошук** з фільтрами (формат, місто, категорія, джерела), грід/список, експорт CSV/JSON.
- 🌗 Перемикач **світлої/темної теми** (зберігається в браузері).
- 💰 Окремий показ **рівня зарплати** + дати публікації на картці.
- ✨ **Розумний пошук** з поясненням принципу роботи (евристика + опційний AI-rerank).
- 🔧 Окреме поле **пошуку за інструментами** (After Effects, Tableau…) у тексті вакансії.
- 📄 **Аналіз резюме** (PDF / DOCX / TXT / зображення) → оцінка, поради, покращена версія.

> Вкладка «Резюме» працює через Claude і потребує `ANTHROPIC_API_KEY`.
> Модель — `ANALYSIS_MODEL` (за замовч. дешева `claude-haiku-4-5`).
> Ендпоінт можна захистити кодом доступу `ANALYSIS_ACCESS_CODE`.

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

> Залишено лише надійні, доступні з дата-центру джерела. Djinni та LinkedIn
> прибрані, бо віддають `403` для serverless (Cloudflare / анти-бот) — без
> residential-проксі з Vercel вони не працюють.

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
   - `ANTHROPIC_API_KEY` (для вкладки «Резюме»)
   - `ANALYSIS_ACCESS_CODE` *(опційно — код доступу до резюме)*
   - `ANALYSIS_MODEL` *(опційно — за замовч. `claude-haiku-4-5`)*
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
| `tools`    | через кому: фрази-інструменти, які мають бути в тексті вакансії |
| `sources`  | через кому: `dou,work.ua,robota.ua` |
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
  js/{config,auth,api,export,ui,app,resume}.js
api/               serverless-функції (Vercel)
  search.js        пошук вакансій
  resume.js        аналіз резюме (Claude)
  _lib/            cors, нормалізація, ранжування, fetch, anthropic
  _sources/        dou, workua, robotaua
.github/workflows/deploy-pages.yml
vercel.json
```

## Інші ендпоінти

- `POST /api/resume` — `{ filename, mimeType, dataBase64 }` → структурована оцінка резюме + покращена версія.

Потребує `ANTHROPIC_API_KEY` (інакше 503). Якщо заданий `ANALYSIS_ACCESS_CODE` —
запит має містити заголовок `x-access-code` (інакше 401).

## Дисклеймер

Демо-проєкт для навчання. Парсинг сторонніх сайтів робіть з повагою до їхніх
Terms of Service, robots.txt і лімітів. Пріоритет — офіційним API та RSS.
