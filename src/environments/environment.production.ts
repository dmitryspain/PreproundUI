// Replaces environment.ts in the production build only (`fileReplacements` in angular.json),
// so the dev server and the tests keep the local API.
export const environment = {
  // The Render service (ADR 005). A renamed service changes only this line.
  apiBaseUrl: 'https://prepround-api.onrender.com/api',
};
