# Tablero de seguimiento PWA

Aplicación PWA para seguimiento de cargas en tiempo real, conectada a Google Sheets.

## Cómo correr localmente
- Clonar el repo: `git clone https://github.com/TuUsuario/seguimiento_cargas_pwa.git`
- Copiar el archivo de ejemplo: `cp secure-config.example.json secure-config.json` y colocar el token que vayas a usar. El archivo real queda fuera del control de versiones.
- Abrir `index.html` con Live Server (VS Code extension).
- Configura la URL de tu Google Apps Script en `config.js` o mediante la variable de entorno `API_BASE` al desplegar.

## Configuración
- URL de Google Apps Script: defínela en `config.js` o establece `API_BASE` como variable de entorno.
- Token de API: proporciónalo mediante `secure-config.json` (no versionado) o con la variable de entorno `API_TOKEN`/un endpoint seguro.
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

Para suministrar la URL de la API en producción puedes generar el archivo `config.js` a partir de una variable de entorno o bien definir `API_BASE` usando un archivo de entorno ejecutado antes del script:

```bash
export API_BASE="https://tu-web-app.example.com"
cat <<'JS' > runtime-env.js
window.__ENV = {
  API_BASE: '${API_BASE}'
};
JS
```

Incluye el archivo `runtime-env.js` antes de `<script src="./config.js"></script>` en tu `index.html` del entorno desplegado.

### Distribución del token `API_TOKEN`

`config.js` obtiene el token en el siguiente orden:
1. Variable de entorno `API_TOKEN` expuesta en `window.__ENV` (o en `process.env` si usas un bundler).
2. Un endpoint seguro definido en `window.__ENV.SECURE_CONFIG_URL` o `process.env.SECURE_CONFIG_URL` que devuelva `{ "API_TOKEN": "..." }`.
3. El archivo local `secure-config.json` (generado a partir de `secure-config.example.json` y excluido del repositorio).

#### Opciones recomendadas para mantener el token fuera del repositorio

- **Archivo local no versionado**: duplica `secure-config.example.json`, renómbralo a `secure-config.json` y coloca ahí tu token. El archivo ya está listado en `.gitignore`.
- **Variables de entorno durante el despliegue**:
  1. Exporta los secretos en tu pipeline:
     ```bash
     export API_TOKEN="super-token-secreto"
     export API_BASE="https://tu-web-app.example.com"
     cat <<'JS' > runtime-env.js
     window.__ENV = {
       API_BASE: '${API_BASE}',
       API_TOKEN: '${API_TOKEN}'
     };
     JS
     ```
  2. Asegúrate de servir `runtime-env.js` antes de `config.js` (puedes copiarlo junto al `index.html` generado por CI/CD y referenciarlo con `<script src="./runtime-env.js"></script>`).
- **Endpoint seguro**: hospeda un servicio autenticado que devuelva `{"API_TOKEN":"..."}` y expón su URL mediante `window.__ENV.SECURE_CONFIG_URL`. El token nunca se guardará en archivos estáticos.

Recuerda alinear el valor de `API_TOKEN` en tu Google Apps Script (`Project Settings` → `Script properties`) con el que uses en el cliente para evitar errores de autenticación.
