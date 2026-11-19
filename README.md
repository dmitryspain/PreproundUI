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

The API address lives in `src/environments/environment.ts`. Port 4300 is allowed in the backend's CORS settings.

Run the API with the `https` launch profile and call only `https://localhost:7120`, not `http://localhost:5120`:
there the API answers `307`, and the browser rejects a CORS preflight that gets redirected.
