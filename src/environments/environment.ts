export const environment = {
  // HTTPS only: under the API's https profile its plain HTTP port answers 307,
  // and the browser does not follow a redirect on a CORS preflight.
  apiBaseUrl: 'https://localhost:7120/api',
  // Languages of the interface in the order of the switch, and the one used when neither a saved choice
  // nor the browser names one of them (ADR 006). Read only through LANGUAGES / DEFAULT_LANGUAGE.
  languages: ['uk', 'en'] as const,
  defaultLanguage: 'en' as const,
};
