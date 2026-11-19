export const environment = {
  // HTTPS only: under the API's https profile its plain HTTP port answers 307,
  // and the browser does not follow a redirect on a CORS preflight.
  apiBaseUrl: 'https://localhost:7120/api',
};
