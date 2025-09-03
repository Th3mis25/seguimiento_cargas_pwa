// Configuración global de la aplicación.
// Este archivo puede ser reemplazado en el despliegue para ajustar la URL de la API.
window.APP_CONFIG = {
  // URL del Web App de Google Apps Script.
  API_BASE: 'https://script.google.com/macros/s/AKfycbzwh8M5J7n0OUVHzROjd7TaDdfb5lMAMwm_3oRhUbIL53JSQZkijcy-6v3yPrTgUNMK/exec',
  // Usuarios autorizados para iniciar sesión en la app.
  AUTH_USERS: [
    { user: 'admin', password: '1234' }
  ],
  // Token sencillo para proteger llamadas a la API.
  API_TOKEN: 'demo-token'
};
