// Configuración global de la aplicación.
// Este archivo puede ser reemplazado en el despliegue para ajustar la URL de la API.
window.APP_CONFIG = {
  // URL del Web App de Google Apps Script.
  API_BASE: 'https://script.google.com/macros/s/AKfycbyDBNKnJgRyUqWTOEI8rbLQalgLQp6HSOaOIDw60QecSinQtZUtCUgdkGQwpiNV8nd0/exec',
  // Endpoint seguro que expone AUTH_USERS y API_TOKEN.
  SECURE_CONFIG_URL: ''
};

// Valores sensibles como AUTH_USERS y API_TOKEN deben obtenerse desde un
// backend seguro o inyectarse como variables de entorno en el despliegue.
