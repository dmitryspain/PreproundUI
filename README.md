# PreproundWeb

Web client of Prepround, interview preparation quizzes: pick a stack, levels and topics, take a timed test and see
which topics need more work. Built with Angular 22 (standalone components, signals, zoneless, Vitest, SCSS).

The backend (ASP.NET Core API) and the question bank live in a separate repository, `Prepround`, checked out next
to this one (`../Prepround`). How to run the API is described in its README.

## Prerequisites

- Node 22.23.5 (see `.node-version`)
- The Prepround API running on `https://localhost:7120`
- A trusted ASP.NET Core dev certificate (`dotnet dev-certs https --trust`), otherwise the browser rejects requests
  to the API

## Commands

```bash
npm install                 # once
npm start                   # dev server on http://localhost:4300
npm run build               # production build to dist/web
npx ng test --watch=false   # unit tests (Vitest)
```

## API address

The API address for the dev server and the tests lives in `src/environments/environment.ts`. Port 4300 is allowed in
the backend's CORS settings.

Run the API with the `https` launch profile and call only `https://localhost:7120`, not `http://localhost:5120`:
there the API answers `307`, and the browser rejects a CORS preflight that gets redirected.

## Deploy

The site runs on Cloudflare Pages at `https://prepround.pages.dev` (ADR 005 in the `Prepround` repository,
`backend/.claude/pm/decisions/005-mvp-hosting.md`). Every push to `master` deploys it.

- **Project:** `prepround`, GitHub repository `dmitryspain/PreproundUI`, branch `master`.
- **Build:** command `npm run build`, output directory `dist/web/browser`. Pages takes the Node version from
  `.node-version`, so `NODE_VERSION` is not needed.
- **API address:** the production build swaps `src/environments/environment.ts` for
  `src/environments/environment.production.ts` (`fileReplacements` in `angular.json`), and the production API address
  lives there.
- **SPA routes:** nothing to configure. Without a `404.html` in the output, Pages serves `index.html` for any path, so
  do not add `404.html` or `_redirects`.
