// Configuración global de la aplicación.
// Este archivo puede ser reemplazado en el despliegue para ajustar la URL de la API.
window.APP_CONFIG = {
  // URL del Web App de Google Apps Script.
  API_BASE: 'https://script.google.com/macros/s/AKfycby7nU6winC3yKXQp6PiNnFT2CHB4fytlCJcZ2ZexzbUlIUgfYxjZP6mnfGKAOqZf8A7/exec',
  // Usuarios autorizados para iniciar sesión en la app.
  AUTH_USERS: [
    { user: 'admin', password: '1234' },
    { user: 'VPADRONR', password: 'VP@trc.008' }
  ],
  // Token sencillo para proteger llamadas a la API.
  API_TOKEN: 'demo-token'
};
