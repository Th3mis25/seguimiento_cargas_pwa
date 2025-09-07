# Tablero de seguimiento PWA

Aplicación PWA para seguimiento de cargas en tiempo real, conectada a Google Sheets.

## Cómo correr localmente
- Clonar el repo: `git clone https://github.com/TuUsuario/seguimiento_cargas_pwa.git`
- Abrir `index.html` con Live Server (VS Code extension).
- Configura la URL de tu Google Apps Script en `config.js` o mediante la variable de entorno `API_BASE` al desplegar.

## Configuración
- URL de Google Apps Script: defínela en `config.js`.
- Usuarios autorizados y el token de API deben provenir de un backend seguro.
- Nombre de la hoja: `Tabla_1`
- Columnas esperadas:
  - Trip, Caja, Referencia, Cliente, Destino, Estatus, Segmento, TR-MX, TR-USA, Cita carga, Llegada carga, Cita entrega, Llegada entrega, Comentarios, Docs, Tracking
- Las fechas deben enviarse en formato `DD/MM/YYYY HH:mm:ss` (ejemplo: `26/08/2025 22:00:00`).

## Ejemplo de JSON de muestra
```json
[
  {"Trip":"229605","Caja":"8484","Referencia":"8151-8155-JN743","Cliente":"Yanfeng","Destino":"Huntsville, AL","Estatus":"Mty yard","Segmento":"OTR","TR-MX":"PATIO08","TR-USA":"","Cita carga":"26/08/2025 22:00:00","Llegada carga":"26/08/2025 9:59:00"},
  {"Trip":"229606","Caja":"8485","Referencia":"8151-8155-JN746","Cliente":"Yanfeng","Destino":"Huntsville, AL","Estatus":"Drop","Segmento":"OTR","TR-MX":"","TR-USA":"","Cita carga":"27/08/2025 21:00:00","Llegada carga":""}
]

```

## Despliegue

Para suministrar la URL de la API en producción puedes generar el archivo `config.js` a partir de una variable de entorno:

```bash
export API_BASE="https://tu-web-app.example.com"
echo "window.APP_CONFIG = { API_BASE: '${API_BASE}' };" > config.js
```

Los valores sensibles (`AUTH_USERS`, `API_TOKEN`) deben servirse desde un
endpoint protegido o un archivo JSON (por ejemplo `/secure-config.json`) o inyectarse mediante
variables de entorno en el backend.

### Distribución del token `API_TOKEN`

1. **Google Apps Script**: en el editor de Apps Script ve a *Project Settings* 
   y agrega una *Script property* llamada `API_TOKEN`. El código del Web App 
   lo leerá con `PropertiesService.getScriptProperties().getProperty('API_TOKEN')` 
   para validar las peticiones entrantes.
2. **Endpoint de configuración**: el servidor que expone `/secure-config.json` 
   debe leer el mismo valor desde la variable de entorno `API_TOKEN` e incluirlo 
   en la respuesta junto con los usuarios autorizados.
3. **Despliegue**: durante el despliegue genera el token una sola vez y 
   distribúyelo tanto a las *Script properties* como a la variable de entorno 
   del servidor. Ningún token debe mantenerse en el repositorio.

Para desarrollo puedes ejecutar el endpoint localmente:

```bash
API_TOKEN="mi-token" node scripts/secure-config-server.js
```

