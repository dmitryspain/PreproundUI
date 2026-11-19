# PreproundWeb: вебклієнт Prepround

Angular 22 (веб) для Prepround — тестів для підготовки до співбесід. Бекенд (ASP.NET Core API), контент (YAML) і вся документація живуть у сусідньому репо `../Prepround`.

## Джерело правди — `../Prepround/backend/.claude/`

- `../Prepround/backend/.claude/pm/spec.md` — поведінка продукту; розділ 5 — контракт API.
- `../Prepround/backend/.claude/pm/backlog.md` — картки `PRP-NNN`.
- `../Prepround/backend/.claude/pm/decisions/` — рішення: 001 — стек, 003 — фронт в окремому репо.
- `../Prepround/backend/.claude/agents/` — агенти.

Агентів, spec і беклог сюди не копіюємо: цикл агентів запускається із сесії в `Prepround`.

## Правило контракту між репо (рішення 003, п. 4)

Зміна ендпоінта, параметрів чи DTO в одній картці оновлює і бекенд у `Prepround`, і `src/app/core/api.service.ts` / `models.ts` тут. Мовчки ламати фронт не можна.

## Конвенції

- Angular 22 зі стандартними налаштуваннями CLI: standalone, сигнали, zoneless, Vitest, SCSS. Без NgRx і без UI-бібліотеки.
- Теми Aurora, Daylight, Terminal і «Авто» (темна система → Aurora, світла → Daylight) — це набори токенів під `[data-theme]` у `src/styles/` (`styles.scss` лише підключає частини). Кольори в компонентах беруться лише з токенів (`var(--…)`). Тему й акцент вибирає `PrefsService` і зберігає під ключем `prepround.prefs.v1` через `STORAGE`; `public/theme-init.js` цей ключ лише читає, щоб тема стала до старту Angular. Верстка спершу під телефон.
- Усі HTTP-виклики й маппінг DTO → модель живуть лише в `src/app/core/api.service.ts`, моделі — в `src/app/core/models.ts`.
- Адресу API код бере лише через токен `API_BASE_URL` (`src/app/core/config.ts`). Для dev server і тестів значення лежить у `src/environments/environment.ts`. Продакшн-збірка (`npm run build`, Cloudflare Pages) бере `src/environments/environment.production.ts` через `fileReplacements` в `angular.json` (PRP-022, ADR 005).
- Локальні дані (історія, «вже бачені») зберігаються лише через токен `STORAGE` (`src/app/core/storage.ts`). Ключі мають версію: `prepround.history.v1`.
- Текст із контенту не вставляємо через `[innerHTML]` як є: inline-код у бектиках і блок `code` рендерить окремий pipe, який спершу екранує текст.
- Нічого з каталогу (галузі, рівні, напрями, стеки, теми) у `src` не хардкодимо, крім тестів і фікстур: усе приходить з API.

## Порти

- Dev server: `http://localhost:4300` (дозволений у CORS бекенду).
- API: лише `https://localhost:7120`. Не `http://localhost:5120`: там `307`, а браузер не пропускає CORS-preflight через редирект.

## Команди (з кореня репо)

```bash
npm install                 # один раз
npm start                   # http://localhost:4300
npm run build               # production → dist/web
npx ng test --watch=false   # Vitest
```

## Git

Комітить власник. Агенти не роблять `git commit` / `push`.
