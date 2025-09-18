// Configuración global de la aplicación.
// Este archivo puede ser reemplazado en el despliegue para ajustar la URL de la API
// y la forma en la que se obtiene el token seguro.
(function configureApp(global){
  const runtimeEnv = global && typeof global.__ENV === 'object' ? global.__ENV : {};
  const processEnv = typeof process !== 'undefined' && process ? process.env || {} : {};

  const readEnvValue = key => {
    const runtimeValue = runtimeEnv[key];
    if(typeof runtimeValue === 'string' && runtimeValue.trim()){
      return runtimeValue.trim();
    }
    const processValue = processEnv[key];
    if(typeof processValue === 'string' && processValue.trim()){
      return processValue.trim();
    }
    return '';
  };

  // URL predeterminada del Web App activo de Apps Script.
  const DEFAULT_API_BASE = 'https://script.google.com/macros/s/AKfycbx0INv5e9-V2QKXtBvfbpLWCq_4lo66RXIsHfkafeUE1BvRXDxj-catjPxEtQo79Vin/exec';

  const apiBase = readEnvValue('API_BASE') || DEFAULT_API_BASE;
  const inlineToken = readEnvValue('API_TOKEN');
  const secureUrlOverride = readEnvValue('SECURE_CONFIG_URL');

  let secureConfigUrl = secureUrlOverride || 'secure-config.json';

  if(inlineToken){
    const json = JSON.stringify({ API_TOKEN: inlineToken });
    secureConfigUrl = `data:application/json,${encodeURIComponent(json)}`;
  }

  global.APP_CONFIG = {
    // URL del Web App de Google Apps Script.
    API_BASE: apiBase,
    // Archivo o endpoint seguro con los usuarios autorizados y el token de API.
    SECURE_CONFIG_URL: secureConfigUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
