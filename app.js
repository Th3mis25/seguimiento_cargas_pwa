/* =========================
   CONFIG
========================= */

// URL base del Web App de Apps Script.
// Se obtiene de `config.js` para poder configurarse al desplegar.
const API_BASE = (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE) || '';

// Configuración sensible cargada desde un endpoint seguro.
// La URL debe definirse en `window.APP_CONFIG.SECURE_CONFIG_URL`.
const SECURE_CONFIG_URL = (typeof window !== 'undefined' && window.APP_CONFIG?.SECURE_CONFIG_URL) || '';
const SECURE_CONFIG = { apiToken: '', users: [], usuario: '', password: '', displayName: '' };
const DEFAULT_ALLOWED_USERS = Object.freeze([
  { username: 'admin', password: 'admin123', displayName: 'Administrador' }
]);
const SECURE_CONFIG_TOKEN_ERROR_MSG = 'No se obtuvo el token de API. Define API_TOKEN en tu entorno o crea secure-config.json a partir de secure-config.sample.json.';
const SECURE_CONFIG_LOAD_ERROR_MSG = 'No se pudo cargar la configuración segura. Define API_TOKEN, revisa SECURE_CONFIG_URL o verifica que secure-config.json exista y tenga permisos de lectura.';
const SECURE_TOKEN_STORAGE_KEY = 'seguimientoSecureToken';
let secureConfigErrorShown = false;

const ERROR_REPORT_LIMIT = 20;
const errorReports = [];
let errorReportFormatter = null;

function normalizeErrorDetail(error){
  if(!error) return '';
  if(typeof error === 'string') return error;
  if(error && typeof error.message === 'string' && error.message.trim()){
    return error.message.trim();
  }
  try{
    return String(error);
  }catch(_err){
    return '';
  }
}

function formatErrorReportTimestamp(timestamp){
  const date = new Date(timestamp);
  if(Number.isNaN(date.getTime())){
    return '';
  }
  if(!errorReportFormatter){
    try{
      errorReportFormatter = new Intl.DateTimeFormat('es-MX', { dateStyle:'short', timeStyle:'medium' });
    }catch(_err){
      errorReportFormatter = null;
    }
  }
  if(errorReportFormatter){
    try{
      return errorReportFormatter.format(date);
    }catch(_err){
      /* ignore formatter errors */
    }
  }
  const pad = v => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function renderErrorReports(){
  if(typeof document === 'undefined') return;
  const container = document.getElementById('errorNotifications');
  if(!container) return;
  let list = container.querySelector('.error-notifications__list');
  if(!list){
    list = document.createElement('div');
    list.className = 'error-notifications__list';
    list.setAttribute('role', 'list');
    container.appendChild(list);
  }
  if(!errorReports.length){
    list.innerHTML = '';
    container.hidden = true;
    return;
  }
  const visible = errorReports.slice(-ERROR_REPORT_LIMIT).reverse();
  const items = visible.map(entry => {
    const detail = entry.detail ? `<span class="error-notifications__detail">Detalle: ${escapeHtml(entry.detail)}</span>` : '';
    const stack = entry.stack
      ? `<details class="error-notifications__stack"><summary>Detalles técnicos</summary><pre>${escapeHtml(entry.stack)}</pre></details>`
      : '';
    const timestamp = entry.timestamp ? `<span class="error-notifications__time">${escapeHtml(formatErrorReportTimestamp(entry.timestamp))}</span>` : '';
    return `<article class="error-notifications__item" role="listitem">${timestamp}<p class="error-notifications__message">${escapeHtml(entry.message)}</p>${detail}${stack}</article>`;
  }).join('');
  list.innerHTML = items;
  container.hidden = false;
}

function reportError(message, error, options = {}){
  const opts = options || {};
  const detail = typeof opts.detail === 'string' ? opts.detail : normalizeErrorDetail(error);
  const stack = typeof opts.stack === 'string'
    ? opts.stack
    : (error && error.stack ? String(error.stack) : '');
  const entry = {
    message: message || 'Ocurrió un error inesperado.',
    detail,
    stack,
    timestamp: Date.now()
  };
  errorReports.push(entry);
  if(errorReports.length > ERROR_REPORT_LIMIT){
    errorReports.splice(0, errorReports.length - ERROR_REPORT_LIMIT);
  }
  if(typeof console !== 'undefined' && typeof console.error === 'function'){
    if(error !== undefined){
      console.error(message, error);
    }else{
      console.error(message);
    }
  }
  const toastMessage = opts.toastMessage === false
    ? ''
    : (typeof opts.toastMessage === 'string'
      ? opts.toastMessage
      : detail && detail !== message
        ? `${message} (${detail})`
        : message);
  if(toastMessage && typeof toast === 'function'){
    const toastType = opts.toastType || 'error';
    toast(toastMessage, toastType);
  }
  renderErrorReports();
  return entry;
}

if(typeof document !== 'undefined'){
  const initRender = () => renderErrorReports();
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initRender, { once:true });
  }else{
    initRender();
  }
}

function buildApiUrlWithToken(baseUrl, token){
  if(!baseUrl || !token) return baseUrl;
  try{
    const context = typeof window !== 'undefined' && window.location
      ? window.location.origin
      : 'http://localhost';
    const url = new URL(baseUrl, context);
    if(!url.searchParams.has('token')){
      url.searchParams.set('token', token);
    }
    return url.toString();
  }catch(err){
    const tokenParam = `token=${encodeURIComponent(token)}`;
    const hashIndex = baseUrl.indexOf('#');
    const hasHash = hashIndex >= 0;
    const beforeHash = hasHash ? baseUrl.slice(0, hashIndex) : baseUrl;
    const hash = hasHash ? baseUrl.slice(hashIndex) : '';
    if(/(^|[?&])token=/.test(beforeHash)){
      return baseUrl;
    }
    const joiner = beforeHash.includes('?') ? '&' : '?';
    return `${beforeHash}${joiner}${tokenParam}${hash}`;
  }
}

function createApiFormBody(payload, token){
  const body = new URLSearchParams(payload);
  if(token && !body.has('token')){
    body.set('token', token);
  }
  return body;
}

function readStoredSecureToken(){
  if(typeof localStorage === 'undefined') return '';
  try{
    const stored = localStorage.getItem(SECURE_TOKEN_STORAGE_KEY);
    return typeof stored === 'string' ? stored.trim() : '';
  }catch(err){
    console.warn('readStoredSecureToken error', err);
    return '';
  }
}

function persistStoredSecureToken(token){
  if(typeof localStorage === 'undefined') return;
  try{
    if(token){
      localStorage.setItem(SECURE_TOKEN_STORAGE_KEY, token);
    }else{
      localStorage.removeItem(SECURE_TOKEN_STORAGE_KEY);
    }
  }catch(err){
    console.warn('persistStoredSecureToken error', err);
  }
}

function setSecureConfigInputValue(token){
  if(typeof document === 'undefined') return;
  const input = document.getElementById('secureConfigToken');
  if(input && document.activeElement !== input){
    input.value = token || '';
  }
}

function showSecureConfigWarning(message){
  if(typeof document === 'undefined') return;
  const el = document.getElementById('secureConfigMessage');
  if(!el) return;
  const textEl = document.getElementById('secureConfigMessageText');
  if(textEl) textEl.textContent = message;
  else el.textContent = message;
  const stored = readStoredSecureToken();
  setSecureConfigInputValue(stored || SECURE_CONFIG.apiToken || '');
  el.hidden = false;
  el.style.display = 'block';
}

function hideSecureConfigWarning(){
  if(typeof document === 'undefined') return;
  const el = document.getElementById('secureConfigMessage');
  if(!el) return;
  const textEl = document.getElementById('secureConfigMessageText');
  if(textEl) textEl.textContent = '';
  else el.textContent = '';
  el.hidden = true;
  el.style.display = 'none';
  secureConfigErrorShown = false;
}

function notifySecureConfigIssue(message = SECURE_CONFIG_TOKEN_ERROR_MSG, error = null){
  const finalMessage = message || SECURE_CONFIG_TOKEN_ERROR_MSG;
  if(typeof document !== 'undefined'){
    showSecureConfigWarning(finalMessage);
  }
  secureConfigErrorShown = true;
  reportError(finalMessage, error, { toastType:'error', toastMessage: finalMessage });
}

/* =========================
   OFFLINE QUEUE
========================= */

const OFFLINE_DB_NAME = 'seguimientoOfflineQueue';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE_NAME = 'pendingRequests';
let offlineDbPromise = null;
let offlineQueueInitialized = false;
let pendingQueueCount = 0;
let syncState = 'idle';
let syncStatusMessage = '';
let syncInProgress = false;
let syncRetryTimer = null;

function isOffline(){
  if(typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean'){
    return false;
  }
  return navigator.onLine === false;
}

function isLikelyNetworkError(err){
  if(!err) return false;
  if(err.name === 'NetworkError' || err.isNetworkError === true){
    return true;
  }
  const message = typeof err.message === 'string' ? err.message : String(err);
  if(err instanceof TypeError && /failed to fetch|network ?error|load failed|network request failed/i.test(message)){
    return true;
  }
  if(err.cause && err.cause !== err){
    return isLikelyNetworkError(err.cause);
  }
  return false;
}

function getSyncStatusElement(){
  if(typeof document === 'undefined') return null;
  return document.getElementById('syncStatus');
}

function renderSyncStatus(){
  const el = getSyncStatusElement();
  if(!el) return;

  let message = syncStatusMessage;
  if(!message){
    switch(syncState){
      case 'idle':
        message = 'Sincronizado';
        break;
      case 'offline':
        message = pendingQueueCount > 0
          ? `Sin conexión. ${pendingQueueCount} cambio${pendingQueueCount === 1 ? '' : 's'} pendiente${pendingQueueCount === 1 ? '' : 's'}.`
          : 'Sin conexión. Los cambios se sincronizarán al reconectar.';
        break;
      case 'queued':
        message = `Sin conexión. ${pendingQueueCount} cambio${pendingQueueCount === 1 ? '' : 's'} pendiente${pendingQueueCount === 1 ? '' : 's'}.`;
        break;
      case 'syncing':
        message = pendingQueueCount > 0
          ? `Sincronizando… ${pendingQueueCount} pendiente${pendingQueueCount === 1 ? '' : 's'}.`
          : 'Sincronizando…';
        break;
      case 'error':
        message = 'Error de sincronización. Reintentando…';
        break;
      default:
        message = '';
    }
  }

  if(!message){
    el.hidden = true;
    el.removeAttribute('data-state');
    el.textContent = '';
    return;
  }

  el.hidden = false;
  el.dataset.state = syncState;
  el.textContent = message;
}

function setSyncStatus(state, options = {}){
  syncState = state;
  if(Object.prototype.hasOwnProperty.call(options, 'message')){
    syncStatusMessage = options.message || '';
  }else{
    syncStatusMessage = '';
  }
  if(typeof options.pendingCount === 'number' && Number.isFinite(options.pendingCount)){
    pendingQueueCount = Math.max(0, options.pendingCount);
  }
  renderSyncStatus();
}

function scheduleSyncRetry(delay = 5000){
  if(typeof setTimeout !== 'function') return;
  if(syncRetryTimer) return;
  syncRetryTimer = setTimeout(() => {
    syncRetryTimer = null;
    processOfflineQueue();
  }, delay);
}

function resetSyncRetryTimer(){
  if(syncRetryTimer){
    clearTimeout(syncRetryTimer);
    syncRetryTimer = null;
  }
}

async function getOfflineDb(){
  if(typeof window === 'undefined' || !('indexedDB' in window)){
    return null;
  }
  if(offlineDbPromise){
    return offlineDbPromise;
  }
  offlineDbPromise = new Promise(resolve => {
    try{
      const request = window.indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
      request.onerror = () => {
        reportError('No se pudo abrir la base de datos offline.', request.error);
        resolve(null);
      };
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if(!db.objectStoreNames.contains(OFFLINE_STORE_NAME)){
          db.createObjectStore(OFFLINE_STORE_NAME, { keyPath:'id', autoIncrement:true });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          try{ db.close(); }
          catch(_err){ /* ignore close errors */ }
          offlineDbPromise = null;
        };
        db.onclose = () => {
          offlineDbPromise = null;
        };
        resolve(db);
      };
    }catch(err){
      reportError('No se pudo inicializar la base de datos offline.', err);
      resolve(null);
    }
  });
  return offlineDbPromise;
}

async function countPendingRequests(dbInstance){
  const db = dbInstance || await getOfflineDb();
  if(!db) return 0;
  return new Promise((resolve, reject) => {
    try{
      const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly');
      const store = tx.objectStore(OFFLINE_STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    }catch(err){
      reject(err);
    }
  }).catch(err => {
    reportError('No se pudieron contar las operaciones pendientes sin conexión.', err);
    return 0;
  });
}

async function enqueueOfflineRequest(type, data){
  const db = await getOfflineDb();
  if(!db){
    return { success:false, error:new Error('IndexedDB no disponible') };
  }
  const payload = JSON.parse(JSON.stringify(data));
  try{
    await new Promise((resolve, reject) => {
      try{
        const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
        const store = tx.objectStore(OFFLINE_STORE_NAME);
        store.add({ type, payload, createdAt: Date.now() });
      }catch(err){
        reject(err);
      }
    });
    const count = await countPendingRequests(db);
    pendingQueueCount = count;
    return { success:true, count };
  }catch(err){
    reportError('No se pudo guardar la operación sin conexión.', err, {
      toastMessage: 'No se pudo guardar la operación sin conexión.'
    });
    return { success:false, error:err };
  }
}

async function getAllOfflineRequests(dbInstance){
  const db = dbInstance || await getOfflineDb();
  if(!db) return [];
  return new Promise((resolve, reject) => {
    try{
      const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly');
      const store = tx.objectStore(OFFLINE_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }catch(err){
      reject(err);
    }
  }).catch(err => {
    reportError('No se pudieron leer las operaciones pendientes sin conexión.', err);
    return [];
  });
}

async function deleteOfflineRequest(id, dbInstance){
  const db = dbInstance || await getOfflineDb();
  if(!db) return false;
  try{
    await new Promise((resolve, reject) => {
      try{
        const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
        const store = tx.objectStore(OFFLINE_STORE_NAME);
        store.delete(id);
      }catch(err){
        reject(err);
      }
    });
    return true;
  }catch(err){
    reportError('No se pudo eliminar una operación pendiente sin conexión.', err);
    return false;
  }
}

async function processOfflineQueue(){
  if(syncInProgress) return;
  resetSyncRetryTimer();
  if(isOffline()){
    setSyncStatus(pendingQueueCount > 0 ? 'queued' : 'offline', { pendingCount: pendingQueueCount });
    return;
  }

  const db = await getOfflineDb();
  if(!db){
    setSyncStatus('idle', { pendingCount: pendingQueueCount });
    return;
  }

  let pending;
  try{
    pending = await getAllOfflineRequests(db);
  }catch(err){
    reportError('No se pudieron leer las operaciones pendientes sin conexión.', err);
    setSyncStatus('error', { message:'No se pudo leer la cola offline.' });
    scheduleSyncRetry();
    return;
  }

  pendingQueueCount = Array.isArray(pending) ? pending.length : 0;
  if(!pendingQueueCount){
    setSyncStatus(isOffline() ? 'offline' : 'idle', { pendingCount: 0 });
    return;
  }

  syncInProgress = true;
  setSyncStatus('syncing', { pendingCount: pendingQueueCount });

  try{
    let remaining = pendingQueueCount;
    for(const entry of pending){
      const action = entry?.type === 'update' ? 'update' : 'add';
      try{
        await sendRecordRequest(action, entry?.payload || {});
        await deleteOfflineRequest(entry?.id, db);
        remaining = Math.max(0, remaining - 1);
        pendingQueueCount = remaining;
        setSyncStatus(remaining > 0 ? 'syncing' : 'syncing', { pendingCount: remaining });
      }catch(err){
        const isNetworkIssue = isOffline() || isLikelyNetworkError(err);
        const errorMessage = err && err.message ? err.message : 'Error desconocido';
        const syncMessage = isNetworkIssue
          ? 'Sin conexión con el servicio. Reintentaremos la sincronización automáticamente.'
          : `Error de sincronización: ${errorMessage}`;
        const reportMessage = isNetworkIssue
          ? `Error de sincronización: ${errorMessage}`
          : syncMessage;

        reportError(reportMessage, err, { toastMessage: isNetworkIssue ? false : syncMessage });

        pendingQueueCount = await countPendingRequests(db);

        if(isNetworkIssue){
          const state = isOffline()
            ? (pendingQueueCount > 0 ? 'queued' : 'offline')
            : 'queued';
          setSyncStatus(state, {
            pendingCount: pendingQueueCount,
            message: 'Sin conexión con el servicio. Reintentaremos la sincronización automáticamente.'
          });
          scheduleSyncRetry();
          return;
        }

        setSyncStatus('error', {
          message: `Error de sincronización: ${errorMessage}`,
          pendingCount: pendingQueueCount
        });
        scheduleSyncRetry();
        return;
      }
    }
  }finally{
    syncInProgress = false;
  }

  pendingQueueCount = await countPendingRequests(db);
  if(pendingQueueCount > 0){
    setSyncStatus('syncing', { pendingCount: pendingQueueCount });
    scheduleSyncRetry();
    return;
  }

  setSyncStatus('idle', { pendingCount: 0 });
  if(typeof toast === 'function'){
    toast('Cambios sincronizados', 'success');
  }
}

async function initializeOfflineQueue(){
  if(offlineQueueInitialized) return;
  offlineQueueInitialized = true;

  const db = await getOfflineDb();
  if(db){
    pendingQueueCount = await countPendingRequests(db);
  }else{
    pendingQueueCount = 0;
  }

  if(isOffline()){
    setSyncStatus(pendingQueueCount > 0 ? 'queued' : 'offline', { pendingCount: pendingQueueCount });
  }else if(pendingQueueCount > 0){
    setSyncStatus('syncing', { pendingCount: pendingQueueCount });
  }else{
    setSyncStatus('idle', { pendingCount: 0 });
  }

  if(typeof window !== 'undefined'){
    window.addEventListener('online', () => {
      if(pendingQueueCount > 0){
        setSyncStatus('syncing', { pendingCount: pendingQueueCount });
      }else{
        setSyncStatus('idle', { pendingCount: 0 });
      }
      processOfflineQueue();
    });
    window.addEventListener('offline', () => {
      setSyncStatus(pendingQueueCount > 0 ? 'queued' : 'offline', { pendingCount: pendingQueueCount });
    });
  }

  if(!isOffline()){
    processOfflineQueue();
  }
}

function normalizeAllowedUsers(rawUsers){
  const normalized = [];
  if(!rawUsers) return normalized;

  const pushUser = (username, password, displayName) => {
    const cleanUsername = typeof username === 'string' ? username.trim() : String(username ?? '').trim();
    const rawPassword = typeof password === 'string' ? password : String(password ?? '');
    const cleanPassword = rawPassword.trim();
    if(!cleanUsername || !cleanPassword) return;
    const cleanDisplay = typeof displayName === 'string' && displayName.trim() ? displayName.trim() : cleanUsername;
    normalized.push({
      username: cleanUsername,
      password: cleanPassword,
      displayName: cleanDisplay,
      normalizedUsername: cleanUsername.toLowerCase()
    });
  };

  if(Array.isArray(rawUsers)){
    rawUsers.forEach(entry => {
      if(!entry) return;
      if(typeof entry === 'string'){
        const trimmed = entry.trim();
        if(!trimmed) return;
        const sep = trimmed.indexOf(':');
        if(sep > 0){
          const user = trimmed.slice(0, sep);
          const pass = trimmed.slice(sep + 1);
          pushUser(user, pass, user);
        }
        return;
      }
      if(typeof entry === 'object'){
        const user = entry.username ?? entry.user ?? entry.usuario ?? entry.nombreUsuario ?? '';
        const pass = entry.password ?? entry.pass ?? entry.clave ?? entry.contrasena ?? entry['contraseña'] ?? '';
        const display = entry.displayName ?? entry.name ?? entry.nombre ?? entry.alias ?? user;
        pushUser(user, pass, display);
      }
    });
    return normalized;
  }

  if(typeof rawUsers === 'object'){
    Object.entries(rawUsers).forEach(([key, value]) => {
      if(value == null) return;
      if(typeof value === 'string'){
        pushUser(key, value, key);
      }else if(typeof value === 'object'){
        const user = value.username ?? value.user ?? value.usuario ?? value.nombreUsuario ?? key;
        const pass = value.password ?? value.pass ?? value.clave ?? value.contrasena ?? value['contraseña'] ?? '';
        const display = value.displayName ?? value.name ?? value.nombre ?? value.alias ?? key;
        pushUser(user, pass, display);
      }
    });
  }

  return normalized;
}

function getConfiguredUsers(){
  const secureUsers = Array.isArray(SECURE_CONFIG.users) ? SECURE_CONFIG.users : [];
  const secureSingleUsers = normalizeAllowedUsers([
    {
      username: SECURE_CONFIG.usuario ?? '',
      password: SECURE_CONFIG.password ?? '',
      displayName: SECURE_CONFIG.displayName ?? ''
    }
  ]);

  let configUsers = [];
  if(typeof window !== 'undefined' && window.APP_CONFIG){
    const raw = window.APP_CONFIG.ALLOWED_USERS ?? window.APP_CONFIG.allowedUsers ?? null;
    if(raw){
      configUsers = normalizeAllowedUsers(raw);
    }

    const configSingleUsers = normalizeAllowedUsers([
      {
        username: window.APP_CONFIG.usuario ?? window.APP_CONFIG.username ?? window.APP_CONFIG.user ?? '',
        password: window.APP_CONFIG.password ?? window.APP_CONFIG.pass ?? '',
        displayName: window.APP_CONFIG.nombre ?? window.APP_CONFIG.displayName ?? window.APP_CONFIG.name ?? ''
      }
    ]);

    if(configSingleUsers.length){
      configUsers = [...configUsers, ...configSingleUsers];
    }
  }
  const map = new Map();
  const addUser = user => {
    if(!user) return;
    const username = typeof user.username === 'string' ? user.username.trim() : '';
    const password = typeof user.password === 'string' ? user.password.trim() : String(user.password ?? '').trim();
    if(!username || !password) return;
    const normalizedUsername = typeof user.normalizedUsername === 'string'
      ? user.normalizedUsername
      : username.toLowerCase();
    if(!normalizedUsername) return;
    if(!map.has(normalizedUsername)){
      map.set(normalizedUsername, {
        username,
        password,
        displayName: typeof user.displayName === 'string' && user.displayName.trim()
          ? user.displayName.trim()
          : username,
        normalizedUsername
      });
    }
  };
  [...secureSingleUsers, ...secureUsers, ...configUsers].forEach(addUser);
  if(!map.size){
    normalizeAllowedUsers(DEFAULT_ALLOWED_USERS).forEach(addUser);
  }
  return Array.from(map.values());
}

function matchAllowedUser(username, password, allowedUsers = null){
  const userList = Array.isArray(allowedUsers) ? allowedUsers : getConfiguredUsers();
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const candidatePassword = String(password || '').trim();
  if(!userList.length) return null;
  if(!normalizedUsername || !candidatePassword) return null;
  for(const user of userList){
    if(!user) continue;
    const storedUsername = typeof user.normalizedUsername === 'string'
      ? user.normalizedUsername
      : (typeof user.username === 'string' ? user.username.trim().toLowerCase() : '');
    if(!storedUsername || storedUsername !== normalizedUsername) continue;
    const storedPassword = typeof user.password === 'string'
      ? user.password.trim()
      : String(user.password ?? '').trim();
    if(storedPassword === candidatePassword){
      return {
        username: typeof user.username === 'string' ? user.username : username,
        displayName: typeof user.displayName === 'string' && user.displayName.trim()
          ? user.displayName.trim()
          : (typeof user.username === 'string' ? user.username : username)
      };
    }
  }
  return null;
}

async function loadSecureConfig(){
  const storedToken = readStoredSecureToken();
  const previousUsers = Array.isArray(SECURE_CONFIG.users) ? [...SECURE_CONFIG.users] : [];
  const previousSingleUser = {
    usuario: SECURE_CONFIG.usuario,
    password: SECURE_CONFIG.password,
    displayName: SECURE_CONFIG.displayName
  };

  if(!SECURE_CONFIG_URL){
    if(storedToken){
      SECURE_CONFIG.apiToken = storedToken;
      setSecureConfigInputValue(storedToken);
    }
    SECURE_CONFIG.users = previousUsers;
    SECURE_CONFIG.usuario = previousSingleUser.usuario;
    SECURE_CONFIG.password = previousSingleUser.password;
    SECURE_CONFIG.displayName = previousSingleUser.displayName;
    return;
  }

  SECURE_CONFIG.apiToken = '';
  SECURE_CONFIG.users = [];
  SECURE_CONFIG.usuario = '';
  SECURE_CONFIG.password = '';
  SECURE_CONFIG.displayName = '';

  try{
    const res = await fetch(SECURE_CONFIG_URL, { cache:'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const rawToken = json.API_TOKEN ?? json.apiToken;
    const token = typeof rawToken === 'string' ? rawToken.trim() : '';

    if(!token){
      const err = new Error(SECURE_CONFIG_TOKEN_ERROR_MSG);
      err.code = 'NO_API_TOKEN';
      throw err;
    }

    const rawUsers = json.users ?? json.allowedUsers ?? json.ALLOWED_USERS ?? json.usuarios ?? null;
    const singleUser = {
      username: json.usuario ?? json.username ?? json.user ?? '',
      password: json.password ?? json.pass ?? json.clave ?? json.contrasena ?? json['contraseña'] ?? '',
      displayName: json.nombre ?? json.displayName ?? json.name ?? ''
    };
    SECURE_CONFIG.users = normalizeAllowedUsers(rawUsers);
    const normalizedSingleUser = normalizeAllowedUsers([singleUser]);
    if(normalizedSingleUser.length){
      const [{ username, password, displayName }] = normalizedSingleUser;
      SECURE_CONFIG.usuario = username;
      SECURE_CONFIG.password = password;
      SECURE_CONFIG.displayName = displayName;
    }
    SECURE_CONFIG.apiToken = token;
    persistStoredSecureToken(token);
    setSecureConfigInputValue(token);
    hideSecureConfigWarning();
  }catch(err){
    if(storedToken){
      console.warn('Falling back to stored API token', err);
      SECURE_CONFIG.apiToken = storedToken;
      setSecureConfigInputValue(storedToken);
      hideSecureConfigWarning();
      if(!SECURE_CONFIG.users.length){
        SECURE_CONFIG.users = previousUsers;
      }
      if(!SECURE_CONFIG.usuario && previousSingleUser.usuario){
        SECURE_CONFIG.usuario = previousSingleUser.usuario;
        SECURE_CONFIG.password = previousSingleUser.password;
        SECURE_CONFIG.displayName = previousSingleUser.displayName;
      }
      return;
    }
    throw err;
  }
}

async function ensureSecureConfigLoaded(){
  if(!secureConfigLoadPromise){
    secureConfigLoadPromise = loadSecureConfig().catch(err => {
      secureConfigLoadPromise = null;
      throw err;
    });
  }
  return secureConfigLoadPromise;
}

function toggleAuthSections(isAuthenticated){
  if(typeof document === 'undefined') return;
  const loginPanel = document.querySelector('.login-panel');
  const appContent = document.getElementById('appContent');
  if(loginPanel){
    loginPanel.hidden = !!isAuthenticated;
  }
  if(appContent){
    appContent.hidden = !isAuthenticated;
  }
  if(document.body){
    document.body.classList.toggle(AUTH_BODY_CLASS, !!isAuthenticated);
  }
}

function focusLoginInput(){
  if(typeof document === 'undefined') return;
  const loginForm = document.getElementById('loginForm');
  const firstInput = loginForm?.querySelector('input');
  firstInput?.focus();
}

function focusSearchBox(){
  if(typeof document === 'undefined') return;
  const search = document.getElementById('searchBox');
  search?.focus();
}

function registerServiceWorker(){
  if(typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }catch(_err){
    /* ignore service worker errors */
  }
}

function setupThemeControls(themeToggle){
  if(typeof document === 'undefined') return;
  if(typeof localStorage !== 'undefined' && localStorage.getItem('theme') === 'light'){
    document.body.classList.add('theme-light');
    if(themeToggle) themeToggle.checked = true;
  }

  themeToggle?.addEventListener('change', (e) => {
    const isLight = e.target.checked;
    document.body.classList.toggle('theme-light', isLight);
    if(typeof localStorage !== 'undefined'){
      if(isLight) localStorage.setItem('theme','light');
      else localStorage.removeItem('theme');
    }
  });
}

async function bootstrapApp(){
  if(bootstrapPromise){
    return bootstrapPromise;
  }
  bootstrapPromise = (async () => {
    registerServiceWorker();

    setupSecureConfigForm();

    try{
      await ensureSecureConfigLoaded();
    }catch(err){
      const detail = err && err.message && err.message !== SECURE_CONFIG_TOKEN_ERROR_MSG ? ` Detalle: ${err.message}` : '';
      const message = err && err.message === SECURE_CONFIG_TOKEN_ERROR_MSG
        ? err.message
        : `${SECURE_CONFIG_LOAD_ERROR_MSG}${detail}`;
      notifySecureConfigIssue(message, err);
    }

    const mainEl = document.querySelector('main.container');
    const sideMenu = document.querySelector('.side-menu');
    const menuToggle = document.getElementById('menuToggle');
    const themeToggle = document.getElementById('themeToggle');

    setupThemeControls(themeToggle);

    menuToggle?.addEventListener('click', () => {
      sideMenu?.classList.toggle('open');
    });

    if(sideMenu){
      sideMenu.style.display = '';
      if(window.innerWidth > 768){
        sideMenu.classList.add('open');
      }
    }

    if(mainEl) mainEl.style.display = '';

    await initializeOfflineQueue();

    if(!mainInitialized){
      main();
      mainInitialized = true;
    }
  })();

  bootstrapPromise.catch(err => {
    reportError('No se pudo completar la inicialización de la aplicación.', err);
  });

  return bootstrapPromise;
}

const DEFAULT_LOCALE = 'es-MX';

// Cabeceras EXACTAS en el orden de tu hoja (las que quieres ver en la app)
const HEADERS = [
  'Ejecutivo','Trip','Caja','Referencia','Cliente','Destino','Estatus','Segmento',
  'TR-MX','TR-USA','Cita carga','Llegada carga','Cita entrega','Llegada entrega',
  'Comentarios','Docs','Tracking'
];
const REQUIRED_HEADERS = ['Trip','Ejecutivo','Estatus','Cliente','Cita carga'];

// Mapa de claves internas
const COL = {
  ejecutivo:       'Ejecutivo',
  trip:            'Trip',
  caja:            'Caja',
  referencia:      'Referencia',
  cliente:         'Cliente',
  destino:         'Destino',
  estatus:         'Estatus',
  segmento:        'Segmento',
  trmx:            'TR-MX',
  trusa:           'TR-USA',
  citaCarga:       'Cita carga',
  llegadaCarga:    'Llegada carga',
  citaEntrega:     'Cita entrega',
  llegadaEntrega:  'Llegada entrega',
  comentarios:     'Comentarios',
  docs:            'Docs',
  tracking:        'Tracking'
};

const STATUS_OPTIONS = [
  'Live','Drop','Cancelled','Loading','Qro yard','Mty yard',
  'In transit MX','Nuevo Laredo yard','In transit USA','At destination','Delivered'
];

const $ = s => document.querySelector(s);
let cache = [];
let currentView = 'daily';
let mainInitialized = false;
let pendingStatusChange = null;
const UNAUTHORIZED_MSG = 'No autorizado – revisa el token de acceso';
let lastFetchUnauthorized = false;
let lastFetchErrorMessage = '';
let secureConfigLoadPromise = null;
let bootstrapPromise = null;
let hasAuthenticated = false;
const AUTH_BODY_CLASS = 'is-authenticated';
const LOGIN_INVALID_MESSAGE = 'Usuario o contraseña inválidos';

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[c]));
}

function parseDate(v){
  if(!v) return null;

  if(v instanceof Date){
    return isNaN(v) ? null : v;
  }

  if(typeof v === 'string'){
    // Formato "d/m/yyyy hh:mm[:ss]" con opcional AM/PM
    let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i);
    if(m){
      const [,day,month,year,h='0',min='0',s='0',ampm] = m;
      let hour = parseInt(h,10);
      if(ampm){
        const isPM = ampm.toUpperCase() === 'PM';
        if(isPM && hour < 12) hour += 12;
        if(!isPM && hour === 12) hour = 0;
      }
      return new Date(
        parseInt(year,10),
        parseInt(month,10)-1,
        parseInt(day,10),
        hour,
        parseInt(min,10),
        parseInt(s,10)
      );
    }

    // Formato ISO con o sin zona horaria
    m = v.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/);
    if(m){
      const tz = m[3];
      if(tz){
        // Si trae información de zona horaria, dejamos que Date la interprete
        return new Date(v);
      }
      // Sin zona horaria explícita -> interpretar como hora local
      const [year,month,day] = m[1].split('-').map(Number);
      const [hour,minute,second='0'] = m[2].split(':');
      return new Date(year, month-1, Number(day), Number(hour), Number(minute), Number(second));
    }
  }

  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function fmtDate(v, locale = DEFAULT_LOCALE){
  if(!v) return '';

  const d = parseDate(v);
  if(!d) return String(v);

  const dateStr = d.toLocaleDateString(locale, {
    year:'numeric', month:'2-digit', day:'2-digit'
  });
  const timeStr = d.toLocaleTimeString(locale, {
    hour:'2-digit', minute:'2-digit', hour12:false
  });
  return `${dateStr} ${timeStr}`;
}
if(typeof module !== 'undefined' && module.exports){
  module.exports = { fmtDate, DEFAULT_LOCALE };
}
function toGASDate(v){
  if(!v) return '';
  let d;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if(m){
    const [,Y,M,D,H,Min,S] = m;
    d = new Date(Number(Y), Number(M)-1, Number(D), Number(H), Number(Min), Number(S||0));
  }else{
    d = parseDate(v);
  }
  if(!d) return '';
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function fillStatusSelect(sel, current='', allowEmpty=false){
  if(!sel) return;
  sel.innerHTML = (allowEmpty?'<option value=""></option>':'') +
    STATUS_OPTIONS.map(s=>`<option value="${s}">${s}</option>`).join('');
  if(current) sel.value = current;
}
function toast(msg, type=''){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('success','error');
  if(type){
    el.classList.add(type);
  }
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),1800);
}

// convierte fila tipo array -> objeto con HEADERS
function arrayRowToObj(row){
  const obj = {};
  for(let i=0;i<HEADERS.length;i++){
    obj[HEADERS[i]] = row[i] ?? '';
  }
  return obj;
}

function validateTrip(trip, original=''){
  if(!/^\d+$/.test(trip)){
    toast('El Trip debe contener solo números','error');
    return false;
  }
  if(Number(trip) < 225000){
    toast('El Trip debe ser mayor o igual a 225000','error');
    return false;
  }
  const exists = cache.some(r => String(r[COL.trip]) === trip && String(r[COL.trip]) !== String(original));
  if(exists){
    toast('El Trip ya existe','error');
    return false;
  }
  return true;
}

function normalizeData(raw){
  // devuelve siempre array de objetos con claves = HEADERS / nombres reales
  if(!Array.isArray(raw)) return [];

  // Caso 1: ya son objetos
  if(raw.length && !Array.isArray(raw[0])) {
    return raw.map(row => {
      const obj = {};
      for (const h of HEADERS) {
        const key = Object.keys(row).find(
          k => k.trim().toLowerCase() === h.toLowerCase()
        );
        obj[h] = key ? row[key] : '';
      }
      return obj;
    });
  }

  // Caso 2: son arrays -> los mapeamos con HEADERS
  return raw.map(arrayRowToObj);
}

async function fetchData(){
  const tb = $('#loadsTable tbody');
  tb.innerHTML = `<tr><td colspan="18" style="padding:16px">Cargando…</td></tr>`;

  if(!API_BASE){
    const message = 'API_BASE no configurada';
    lastFetchUnauthorized = false;
    lastFetchErrorMessage = message;
    tb.innerHTML = `<tr><td colspan="18" style="padding:16px;color:#ffb4b4">${message}. Revisa la configuración de la aplicación, tu conexión a internet y que el token sea válido antes de recargar.</td></tr>`;
    return [];
  }

  try{
    lastFetchErrorMessage = '';
    const token = SECURE_CONFIG.apiToken || '';
    const url = buildApiUrlWithToken(API_BASE, token);
    const res  = await fetch(url,{ cache:'no-store' });
    if(res.status === 401 || res.status === 403){
      lastFetchUnauthorized = true;
      lastFetchErrorMessage = UNAUTHORIZED_MSG;
      notifySecureConfigIssue(UNAUTHORIZED_MSG);
      tb.innerHTML = `<tr><td colspan="18" style="padding:16px;color:#ffb4b4">${UNAUTHORIZED_MSG}</td></tr>`;
      return [];
    }
    lastFetchUnauthorized = false;
    if(!res.ok){
      const error = new Error(`HTTP ${res.status}`);
      error.name = 'HttpError';
      error.httpStatus = res.status;
      error.url = API_BASE;
      throw error;
    }
    const json = await res.json();
    if(json.error){
      throw new Error(json.error);
    }
    let data = json.data ?? json.rows ?? [];
    data = normalizeData(data);

    hideSecureConfigWarning();
    lastFetchErrorMessage = '';
    return data;
  }catch(err){
    lastFetchUnauthorized = false;
    const baseInstruction = 'Revisa tu conexión a internet y que el token sea válido antes de recargar.';
    const plainApiUrl = API_BASE || 'la URL configurada';
    const escapedApiUrl = escapeHtml(plainApiUrl);
    const rawMessage = err && typeof err.message === 'string' ? err.message : '';
    let userMessage = `No se pudieron cargar los datos desde ${escapedApiUrl}.`;
    let plainMessage = `No se pudieron cargar los datos desde ${plainApiUrl}.`;
    const httpStatusMatch = rawMessage.match(/^HTTP\s+(\d+)/i);
    const isHttpError = (err && err.name === 'HttpError') || Boolean(httpStatusMatch);
    if(isHttpError){
      const statusValue = typeof err?.httpStatus === 'number' ? err.httpStatus : (httpStatusMatch ? httpStatusMatch[1] : '');
      const statusLabel = statusValue !== '' ? ` ${escapeHtml(String(statusValue))}` : '';
      userMessage = `No se pudieron cargar los datos desde ${escapedApiUrl}. El servicio respondió con un error HTTP${statusLabel}.`;
      plainMessage = `No se pudieron cargar los datos desde ${plainApiUrl}. El servicio respondió con un error HTTP${statusValue || ''}.`;
    }else if(/cors|blocked by cors policy/i.test(rawMessage)){
      userMessage = `No se pudieron cargar los datos desde ${escapedApiUrl}. Es posible que el navegador haya bloqueado la solicitud por políticas de CORS.`;
      plainMessage = `No se pudieron cargar los datos desde ${plainApiUrl}. Es posible que el navegador haya bloqueado la solicitud por políticas de CORS.`;
    }else if(/dns|enotfound|getaddrinfo|name not resolved|err_name_not_resolved/i.test(rawMessage)){
      userMessage = `No se pudieron cargar los datos desde ${escapedApiUrl}. No se pudo resolver el dominio (error DNS).`;
      plainMessage = `No se pudieron cargar los datos desde ${plainApiUrl}. No se pudo resolver el dominio (error DNS).`;
    }else if(err instanceof TypeError){
      userMessage = `No se pudieron cargar los datos desde ${escapedApiUrl}. No se pudo establecer la conexión con el servicio.`;
      plainMessage = `No se pudieron cargar los datos desde ${plainApiUrl}. No se pudo establecer la conexión con el servicio.`;
    }
    const detail = rawMessage ? ` Detalle: ${escapeHtml(rawMessage)}.` : '';
    lastFetchErrorMessage = rawMessage || plainMessage;
    tb.innerHTML = `<tr><td colspan="18" style="padding:16px;color:#ffb4b4">${userMessage}${detail} ${baseInstruction} URL consultada: ${escapedApiUrl}.</td></tr>`;
    const reportDetail = rawMessage ? `${rawMessage} (URL: ${plainApiUrl})` : `URL consultada: ${plainApiUrl}`;
    const toastMessage = rawMessage ? `No se pudieron cargar los datos: ${rawMessage}` : plainMessage;
    reportError(plainMessage, err, { detail: reportDetail, toastMessage });
    return [];
  }
}

function setupSecureConfigForm(){
  if(typeof document === 'undefined') return;
  const form = document.getElementById('secureConfigForm');
  const input = document.getElementById('secureConfigToken');
  const clearBtn = document.getElementById('secureConfigClear');
  if(!form || !input) return;

  const saved = readStoredSecureToken();
  if(saved && !input.value){
    input.value = saved;
  }

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const token = input.value.trim();
    if(!token){
      toast('Proporciona un token válido', 'error');
      input.focus();
      return;
    }
    SECURE_CONFIG.apiToken = token;
    persistStoredSecureToken(token);
    const refreshed = await fetchData();
    if(lastFetchUnauthorized){
      return;
    }
    if(lastFetchErrorMessage){
      showSecureConfigWarning(`No se pudo validar el token. ${lastFetchErrorMessage}`);
      secureConfigErrorShown = true;
      toast(`No se pudo validar el token: ${lastFetchErrorMessage}`, 'error');
      return;
    }
    cache = refreshed;
    populateStatusFilter(cache);
    populateEjecutivoFilter(cache);
    renderCurrent();
    hideSecureConfigWarning();
    toast('Token actualizado', 'success');
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    persistStoredSecureToken('');
    SECURE_CONFIG.apiToken = '';
    secureConfigErrorShown = false;
    notifySecureConfigIssue(SECURE_CONFIG_TOKEN_ERROR_MSG);
    input.focus();
  });
}

async function sendRecordRequest(action, data){
  if(!API_BASE){
    const configError = new Error('API_BASE no configurada');
    configError.name = 'ConfigError';
    throw configError;
  }

  const token = SECURE_CONFIG.apiToken || '';
  const payload = { action, ...data };
  const bodyParams = createApiFormBody(payload, token);
  const bodyString = typeof bodyParams.toString === 'function'
    ? bodyParams.toString()
    : String(bodyParams || '');
  const url = buildApiUrlWithToken(API_BASE, token);

  let res;
  try{
    res = await fetch(url, {
      method:'POST',
      body: bodyString,
      mode:'cors',
      redirect:'follow',
      credentials:'omit',
      cache:'no-store',
      headers:{
        'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
        'Accept':'application/json'
      }
    });
  }catch(err){
    if(isLikelyNetworkError(err)){
      const networkError = new Error('No se pudo conectar con el servicio.');
      networkError.name = 'NetworkError';
      networkError.isNetworkError = true;
      if(err && typeof err === 'object'){
        networkError.cause = err;
      }
      throw networkError;
    }
    throw err;
  }
  let json;
  try{
    const ct = res.headers.get('content-type') || '';
    if(!ct.includes('application/json')){
      throw new Error('Missing application/json header');
    }
    json = await res.json();
  }catch(err){
    if(err.message === 'Missing application/json header') throw err;
    throw new Error('Invalid JSON');
  }
  if(res.status === 401){
    throw new Error(json.error || 'Unauthorized');
  }
  if(res.status === 400){
    throw new Error(json.error || 'Bad Request');
  }
  if(res.status >= 500){
    throw new Error(json.error || 'Server error');
  }
  if(!res.ok || json.error){
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

async function addRecord(data, options = {}){
  const opts = options || {};
  if(!opts.skipQueue && isOffline()){
    const queued = await enqueueOfflineRequest('add', data);
    if(queued.success){
      setSyncStatus(queued.count > 0 ? 'queued' : 'offline', { pendingCount: queued.count });
      if(typeof toast === 'function'){
        toast('Sin conexión. El registro se sincronizará al reconectar.', 'warning');
      }
      return true;
    }
    setSyncStatus('error', { message:'Sin conexión y no se pudo guardar la operación offline.' });
    return false;
  }

  try{
    await sendRecordRequest('add', data);
    if(!opts.silent && typeof toast === 'function'){
      toast('Registro agregado');
    }
    return true;
  }catch(err){
    if(!opts.skipQueue && (isOffline() || isLikelyNetworkError(err))){
      const queued = await enqueueOfflineRequest('add', data);
      if(queued.success){
        const state = isOffline() ? (queued.count > 0 ? 'queued' : 'offline') : 'queued';
        setSyncStatus(state, { pendingCount: queued.count });
        if(typeof toast === 'function'){
          toast('Sin conexión. El registro se sincronizará al reconectar.', 'warning');
        }
        if(!isOffline()){
          scheduleSyncRetry();
        }
        return true;
      }
      setSyncStatus('error', { message:'No se pudo guardar el registro sin conexión.' });
      return false;
    }
    const detailMessage = err && err.message ? err.message : 'Error desconocido';
    reportError('Error al agregar el registro.', err, {
      toastMessage: `Error al agregar: ${detailMessage}`
    });
    return false;
  }
}

async function updateRecord(data, options = {}){
  const opts = options || {};
  if(!opts.skipQueue && isOffline()){
    const queued = await enqueueOfflineRequest('update', data);
    if(queued.success){
      setSyncStatus(queued.count > 0 ? 'queued' : 'offline', { pendingCount: queued.count });
      if(typeof toast === 'function'){
        toast('Sin conexión. Los cambios se sincronizarán al reconectar.', 'warning');
      }
      return true;
    }
    setSyncStatus('error', { message:'Sin conexión y no se pudo guardar la operación offline.' });
    return false;
  }

  try{
    await sendRecordRequest('update', data);
    if(!opts.silent && typeof toast === 'function'){
      toast('Registro actualizado');
    }
    return true;
  }catch(err){
    if(!opts.skipQueue && (isOffline() || isLikelyNetworkError(err))){
      const queued = await enqueueOfflineRequest('update', data);
      if(queued.success){
        const state = isOffline() ? (queued.count > 0 ? 'queued' : 'offline') : 'queued';
        setSyncStatus(state, { pendingCount: queued.count });
        if(typeof toast === 'function'){
          toast('Sin conexión. Los cambios se sincronizarán al reconectar.', 'warning');
        }
        if(!isOffline()){
          scheduleSyncRetry();
        }
        return true;
      }
      setSyncStatus('error', { message:'No se pudieron guardar los cambios sin conexión.' });
      return false;
    }
    const detailMessage = err && err.message ? err.message : 'Error desconocido';
    reportError('Error al actualizar el registro.', err, {
      toastMessage: `Error al actualizar: ${detailMessage}`
    });
    return false;
  }
}

async function handleBulkUpload(file){
  if(!file) return;
  const statusEl = document.getElementById('bulkUploadStatus');
  if(statusEl) statusEl.textContent = 'Leyendo archivo...';
  try{
    const reader = new FileReader();
    const data = await new Promise((resolve, reject)=>{
      reader.onerror = () => reject(reader.error);
      reader.onload = e => {
        try{
          let workbook;
          const name = file.name.toLowerCase();
          if(name.endsWith('.csv')){
            workbook = XLSX.read(e.target.result, { type:'binary' });
          }else{
            const bytes = new Uint8Array(e.target.result);
            workbook = XLSX.read(bytes, { type:'array' });
          }
          const firstSheet = workbook.SheetNames[0];
          const rows = XLSX.utils.sheet_to_json(
            workbook.Sheets[firstSheet],
            { defval:'', raw:false, cellDates:true }
          );
          resolve(rows);
        }catch(err){ reject(err); }
      };
      if(file.name.toLowerCase().endsWith('.csv')) reader.readAsBinaryString(file);
      else reader.readAsArrayBuffer(file);
    });

    if(!Array.isArray(data) || !data.length){
      if(statusEl) statusEl.textContent = 'Archivo vacío';
      return;
    }

    const headers = Object.keys(data[0]).map(h => h.trim().toLowerCase());
    const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h.toLowerCase()));
    if(missing.length){
      if(statusEl) statusEl.textContent = 'Faltan columnas: ' + missing.join(', ');
      return;
    }

    let count = 0;
    for(const row of data){
      const obj = {};
      for(const h of HEADERS){
        const key = Object.keys(row).find(k => k.trim().toLowerCase() === h.toLowerCase());
        obj[h] = key ? row[key] : '';
      }
      const payload = {
        trip: headers.includes('trip') ? obj[COL.trip] : '',
        ejecutivo: headers.includes('ejecutivo') ? obj[COL.ejecutivo] : '',
        estatus: headers.includes('estatus') ? obj[COL.estatus] : '',
        cliente: headers.includes('cliente') ? obj[COL.cliente] : '',
        referencia: headers.includes('referencia') ? obj[COL.referencia] : '',
        destino: headers.includes('destino') ? obj[COL.destino] : '',
        citaCarga: headers.includes('cita carga') ? toGASDate(obj[COL.citaCarga]) : '',
        llegadaCarga: headers.includes('llegada carga') ? toGASDate(obj[COL.llegadaCarga]) : '',
        citaEntrega: headers.includes('cita entrega') ? toGASDate(obj[COL.citaEntrega]) : '',
        llegadaEntrega: headers.includes('llegada entrega') ? toGASDate(obj[COL.llegadaEntrega]) : ''
      };
      const ok = await addRecord(payload);
      if(!ok){
        if(statusEl) statusEl.textContent = `Error en fila ${count+1}`;
        return;
      }
      count++;
      if(statusEl) statusEl.textContent = `Importados ${count}/${data.length}`;
    }
    if(statusEl) statusEl.textContent = `Importación completa (${count})`;
    const refreshed = await fetchData();
    if(lastFetchUnauthorized){
      if(statusEl) statusEl.textContent = UNAUTHORIZED_MSG;
      return;
    }
    cache = refreshed;
    populateStatusFilter(cache);
    populateEjecutivoFilter(cache);
    renderCurrent();
  }catch(err){
    const detailMessage = err && err.message ? err.message : 'Error desconocido';
    reportError('Error durante la importación masiva.', err, {
      toastMessage: `Error en la importación: ${detailMessage}`
    });
    if(statusEl) statusEl.textContent = `Error: ${detailMessage}`;
  }
}

function buildCopyMsg(r){
  const lines = [];
  lines.push(`Caja: ${r[COL.caja]||''}`);
  lines.push(`Referencia: ${r[COL.referencia]||''}`);
  lines.push(`TR-USA: ${r[COL.trusa]||''}`);
  if(r[COL.citaEntrega]) lines.push(`Cita de entrega: ${fmtDate(r[COL.citaEntrega])}`);
  lines.push(`Tracking: ${r[COL.tracking]||''}`);
  return lines.join('\n');
}
function buildWaShareUrl(r){
  return `https://wa.me/?text=${encodeURIComponent(buildCopyMsg(r))}`;
}

function toLocalInputValue(v){
  const d = parseDate(v);
  if(!d) return '';
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openEditModal(trip){
  const row = cache.find(r => String(r[COL.trip])===String(trip));
  if(!row) return;
  const form = $('#editForm');
  form.originalTrip.value = row[COL.trip] || '';
  form.trip.value = row[COL.trip] || '';
  form.ejecutivo.value = row[COL.ejecutivo] || '';
  form.caja.value = row[COL.caja] || '';
  form.referencia.value = row[COL.referencia] || '';
  form.cliente.value = row[COL.cliente] || '';
  form.destino.value = row[COL.destino] || '';
  form.segmento.value = row[COL.segmento] || '';
  form.trmx.value = row[COL.trmx] || '';
  form.trusa.value = row[COL.trusa] || '';
  form.citaCarga.value = toLocalInputValue(row[COL.citaCarga]);
  form.llegadaCarga.value = toLocalInputValue(row[COL.llegadaCarga]);
  form.citaEntrega.value = toLocalInputValue(row[COL.citaEntrega]);
  form.llegadaEntrega.value = toLocalInputValue(row[COL.llegadaEntrega]);
  form.comentarios.value = row[COL.comentarios] || '';
  form.docs.value = row[COL.docs] || '';
  form.tracking.value = row[COL.tracking] || '';
  $('#editModal').classList.add('show');
}

function setColumnVisibility(indices, show){
  const display = show ? '' : 'none';
  const table = $('#loadsTable');
  table.querySelectorAll('tr').forEach(row => {
    indices.forEach(i => {
      const cell = row.children[i];
      if(cell) cell.style.display = display;
    });
  });
}

function populateStatusFilter(rows){
  const select = $('#statusFilter');
  const current = select.value;
  const statuses = Array.from(new Set(rows.map(r => r[COL.estatus]).filter(Boolean)));
  statuses.sort((a,b)=>a.localeCompare(b));
  select.innerHTML = '<option value="">Todos</option>' + statuses.map(s=>`<option>${escapeHtml(s)}</option>`).join('');
  if(statuses.includes(current)) select.value = current;
}

function populateEjecutivoFilter(rows){
  const select = $('#ejecutivoFilter');
  const current = select.value;
  const ejecutivos = Array.from(new Set(rows.map(r => r[COL.ejecutivo]).filter(Boolean)));
  ejecutivos.sort((a,b)=>a.localeCompare(b));
  select.innerHTML = '<option value="">Todos</option>' + ejecutivos.map(e=>`<option>${escapeHtml(e)}</option>`).join('');
  if(ejecutivos.includes(current)) select.value = current;
}

function renderRows(rows, hiddenCols=[]){
  if(lastFetchUnauthorized){
    return;
  }
  setColumnVisibility([9,12,13,15], true); // mostrar por defecto

  const statusFilter = $('#statusFilter').value;
  const ejecutivoFilter = $('#ejecutivoFilter').value;
  const q = $('#searchBox').value.trim().toLowerCase();
  const startVal = $('#startDate').value;
  const endVal = $('#endDate').value;
  const tb = $('#loadsTable tbody');
  tb.innerHTML = '';

  // Interpretar fechas de filtro como locales para no desplazar horarios
  const startDate = startVal ? (()=>{
    const [y,m,d] = startVal.split('-').map(Number);
    return new Date(y, m-1, d, 0,0,0,0);
  })() : null;
  const endDate = endVal ? (()=>{
    const [y,m,d] = endVal.split('-').map(Number);
    return new Date(y, m-1, d, 23,59,59,999);
  })() : null;

  const filtered = rows.filter(r=>{
    const s = String(r[COL.estatus]||'');
    if(statusFilter && s !== statusFilter) return false;
    const e = String(r[COL.ejecutivo]||'');
    if(ejecutivoFilter && e !== ejecutivoFilter) return false;
    if(q){
      const hay = [
        COL.trip, COL.caja, COL.referencia, COL.cliente, COL.destino,
        COL.estatus, COL.segmento, COL.trmx, COL.trusa, COL.tracking,
        COL.ejecutivo
      ].some(k => String(r[k]||'').toLowerCase().includes(q));
      if(!hay) return false;
    }
    if(startDate || endDate){
      const cita = parseDate(r[COL.citaCarga]);
      if(!cita) return false;
      if(startDate && cita < startDate) return false;
      if(endDate && cita > endDate) return false;
    }
    return true;
  });

  // Ordenar cronológicamente por "Cita carga" para que las horas aparezcan en
  // secuencia al aplicar el filtro de fechas. Si alguna fila no tiene fecha,
  // se coloca al final.
  filtered.sort((a,b)=>{
    const da = parseDate(a[COL.citaCarga]);
    const db = parseDate(b[COL.citaCarga]);
    if(da && db) return da - db;
    if(da) return -1;
    if(db) return 1;
    return 0;
  });

  if(!filtered.length){
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 18;
    td.style.padding = '16px';
    td.textContent = 'Sin resultados.';
    tr.appendChild(td);
    tb.appendChild(tr);
    return;
  }

  const addTextCell = (tr, text, className)=>{
    const td = document.createElement('td');
    if(className) td.className = className;
    td.textContent = text || '';
    tr.appendChild(td);
    return td;
  };

  for(const r of filtered){
    const tr = document.createElement('tr');
    tr.dataset.trip = r[COL.trip];

    const statusVal = (r[COL.estatus] || '').trim().toLowerCase();
    const citaDate = parseDate(r[COL.citaCarga]);
    const now = new Date();
    if(citaDate && citaDate < now && (statusVal === 'live' || statusVal === 'drop')){
      tr.classList.add('expired');
    }

    addTextCell(tr, r[COL.ejecutivo]);

    const tripTd = document.createElement('td');
    tripTd.classList.add('nowrap');
    const tripSpan = document.createElement('span');
    tripSpan.className = 'trip-edit';
    tripSpan.textContent = r[COL.trip];
    tripTd.appendChild(tripSpan);
    tr.appendChild(tripTd);

    addTextCell(tr, r[COL.caja], 'nowrap');
    addTextCell(tr, r[COL.referencia]);
    addTextCell(tr, r[COL.cliente]);
    addTextCell(tr, r[COL.destino]);

    const statusTd = document.createElement('td');
    const wrapper = document.createElement('div');
    wrapper.className = 'status-wrapper';

    const statusText = document.createElement('span');
    statusText.className = 'status-text';
    statusText.textContent = r[COL.estatus] || '';
    if(statusVal === 'delivered'){
      statusText.classList.add('badge','green');
    }else if(['in transit mx','in transit usa'].includes(statusVal)){
      statusText.classList.add('badge','blue');
    }else if(statusVal === 'cancelled'){
      statusText.classList.add('badge','red');
    }else if(statusVal === 'nuevo laredo yard'){
      statusText.classList.add('badge','purple');
    }else if(['loading','qro yard','mty yard'].includes(statusVal)){
      statusText.classList.add('badge','yellow');
    }
    wrapper.appendChild(statusText);

    const sel = document.createElement('select');
    sel.className = 'status-select';
    fillStatusSelect(sel, r[COL.estatus]);
    sel.addEventListener('change', async ev=>{
      const newStatus = ev.target.value;
      const statusLower = newStatus.trim().toLowerCase();
      const llegadaVacia = !String(r[COL.llegadaEntrega] || '').trim();
      if(['at destination','delivered'].includes(statusLower) && llegadaVacia){
        pendingStatusChange = { row: r, select: ev.target, newStatus };
        $('#arrivalForm input[name="llegadaEntrega"]').value = '';
        $('#arrivalModal').classList.add('show');
        return;
      }
      const data = {
        originalTrip: r[COL.trip],
        trip: r[COL.trip],
        caja: r[COL.caja] || '',
        referencia: r[COL.referencia] || '',
        cliente: r[COL.cliente] || '',
        destino: r[COL.destino] || '',
        ejecutivo: r[COL.ejecutivo] || '',
        estatus: newStatus,
        segmento: r[COL.segmento] || '',
        trmx: r[COL.trmx] || '',
        trusa: r[COL.trusa] || '',
        citaCarga: r[COL.citaCarga] || '',
        llegadaCarga: r[COL.llegadaCarga] || '',
        citaEntrega: r[COL.citaEntrega] || '',
        llegadaEntrega: r[COL.llegadaEntrega] || '',
        comentarios: r[COL.comentarios] || '',
        docs: r[COL.docs] || '',
        tracking: r[COL.tracking] || ''
      };
      const ok = await updateRecord(data);
      if(ok){
        r[COL.estatus] = newStatus;
        populateStatusFilter(cache);
        renderCurrent();
      }else{
        ev.target.value = r[COL.estatus] || '';
      }
    });
    wrapper.appendChild(sel);
    statusTd.appendChild(wrapper);
    tr.appendChild(statusTd);

    addTextCell(tr, r[COL.segmento]);
    addTextCell(tr, r[COL.trmx]);
    addTextCell(tr, r[COL.trusa]);

    const citaTd = addTextCell(tr, fmtDate(r[COL.citaCarga]), 'nowrap');
    const llegadaDate = parseDate(r[COL.llegadaCarga]);
    if(citaDate && llegadaDate && llegadaDate > citaDate){
      citaTd.classList.add('late');
    }

    addTextCell(tr, fmtDate(r[COL.llegadaCarga]), 'nowrap');
    addTextCell(tr, fmtDate(r[COL.citaEntrega]), 'nowrap');
    addTextCell(tr, fmtDate(r[COL.llegadaEntrega]), 'nowrap');
    addTextCell(tr, r[COL.comentarios]);
    addTextCell(tr, r[COL.docs]);

    const trackTd = document.createElement('td');
    const linkUrl = r[COL.tracking];
    if(linkUrl){
      const link = document.createElement('a');
      link.className = 'link';
      link.href = linkUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Abrir';
      trackTd.appendChild(link);
    }
    tr.appendChild(trackTd);

    const actionTd = document.createElement('td');
    actionTd.className = 'action-bar';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-icon';
    copyBtn.dataset.act = 'copy';
    copyBtn.dataset.trip = r[COL.trip];
    const copyImg = document.createElement('img');
    copyImg.src = 'assets/icon-notes.png';
    copyImg.alt = 'Copiar';
    copyBtn.appendChild(copyImg);
    copyBtn.title = 'Copiar';
    actionTd.appendChild(copyBtn);

    const waLink = document.createElement('a');
    waLink.className = 'btn-icon';
    waLink.target = '_blank';
    waLink.rel = 'noopener';
    waLink.href = buildWaShareUrl(r);
    waLink.title = 'WhatsApp';
    const waImg = document.createElement('img');
    waImg.src = 'assets/WP-logo.png';
    waImg.alt = 'WhatsApp';
    waLink.appendChild(waImg);
    actionTd.appendChild(waLink);


    tr.appendChild(actionTd);
    tb.appendChild(tr);
  }

  if(hiddenCols.length){
    setColumnVisibility(hiddenCols, false);
  }
}

function hasActiveFilters(){
  return $('#statusFilter').value || $('#ejecutivoFilter').value ||
         $('#searchBox').value.trim() || $('#startDate').value || $('#endDate').value;
}

function clearFilters(){
  $('#statusFilter').value = '';
  $('#ejecutivoFilter').value = '';
  $('#searchBox').value = '';
  $('#clearSearch').style.display = 'none';
  $('#startDate').value = '';
  $('#endDate').value = '';
}

function setActiveTopBtn(btn){
  document.querySelectorAll('.top-btn').forEach(b=>{
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });
  if(btn){
    btn.classList.add('active');
    btn.setAttribute('aria-current', 'page');
  }
}

function setDefaultDate(){
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0];
  $('#startDate').value = localDate;
  $('#endDate').value = localDate;
}

function renderGeneral(rows){
  currentView = 'general';
  if(hasActiveFilters()) clearFilters();
  renderRows(rows);
}

function renderDaily(rows){
  currentView = 'daily';
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const hideStatuses = ['nuevo laredo yard','in transit usa','at destination','delivered'];
  const filtered = rows.filter(r=>{
    const status = String(r[COL.estatus]||'').trim().toLowerCase();
    const cita = parseDate(r[COL.citaCarga]);
    if(!cita) return false;
    // Mostrar cancelados solo si la cita corresponde al día actual
    if(status === 'cancelled') return cita >= today && cita < tomorrow;
    if(cita >= today && cita < tomorrow) return true;
    if(cita < today && !hideStatuses.includes(status)) return true;
    return false;
  });
  renderRows(filtered, [9,12,13,15]);
}

function getCurrentWeekRange(){
  const start = new Date();
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Ajusta para que lunes sea el inicio
  start.setDate(start.getDate() + diff);
  start.setHours(0,0,0,0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

function renderProgramaSemanal(rows){
  currentView = 'programaSemanal';
  const { start, end } = getCurrentWeekRange();
  const filtered = rows.filter(r=>{
    const cita = parseDate(r[COL.citaCarga]);
    if(!cita) return false;
    return cita >= start && cita < end;
  });
  renderRows(filtered);
}

function renderEntregasHoy(rows){
  currentView = 'entregasHoy';
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const filtered = rows.filter(r=>{
    const status = String(r[COL.estatus]||'').trim().toLowerCase();
    if(status === 'delivered' || status === 'cancelled') return false;
    const cita = parseDate(r[COL.citaEntrega]);
    if(!cita) return false;
    if(cita >= today && cita < tomorrow) return true;
    if(cita < today) return true;
    return false;
  });
  renderRows(filtered, [8,10,11,15]);
}

function renderInventarioNlar(rows){
  currentView = 'inventarioNlar';
  if(hasActiveFilters()) clearFilters();
  const filtered = rows.filter(r=>String(r[COL.estatus]||'').trim().toLowerCase()==='nuevo laredo yard');
  renderRows(filtered);
}

function renderCurrent(){
  if(currentView === 'daily') renderDaily(cache);
  else if(currentView === 'programaSemanal') renderProgramaSemanal(cache);
  else if(currentView === 'entregasHoy') renderEntregasHoy(cache);
  else if(currentView === 'inventarioNlar') renderInventarioNlar(cache);
  else renderRows(cache);
}

async function main(){
  const initialData = await fetchData();
  const canRenderData = !lastFetchUnauthorized && !lastFetchErrorMessage;

  if(canRenderData){
    cache = initialData;
  }

  populateStatusFilter(cache);
  populateEjecutivoFilter(cache);

  if(canRenderData){
    renderDaily(cache);
    setActiveTopBtn($('#dailyMenu'));
  }

  fillStatusSelect($('#addForm select[name="estatus"]'), '', true);

  $('#refreshBtn').addEventListener('click', async ()=>{
    const refreshed = await fetchData();
    if(lastFetchUnauthorized){
      return;
    }
    cache = refreshed;
    populateStatusFilter(cache);
    populateEjecutivoFilter(cache);
    renderCurrent();
  });
  $('#statusFilter').addEventListener('change', renderCurrent);
  $('#ejecutivoFilter').addEventListener('change', renderCurrent);
  const searchBox = $('#searchBox');
  const clearSearch = $('#clearSearch');
  searchBox.addEventListener('input', () => {
    clearSearch.style.display = searchBox.value ? 'block' : 'none';
    renderCurrent();
  });
  clearSearch.addEventListener('click', () => {
    searchBox.value = '';
    clearSearch.style.display = 'none';
    renderCurrent();
  });
  $('#startDate').addEventListener('change', renderCurrent);
  $('#endDate').addEventListener('change', renderCurrent);
  ['#startDate','#endDate'].forEach(sel=>{
    const el = $(sel);
    el.addEventListener('click',()=>{
      if(el.showPicker) el.showPicker();
    });
  });
  $('#homeBtn')?.addEventListener('click', ()=>{
    clearFilters();
    renderDaily(cache);
    setActiveTopBtn($('#dailyMenu'));
  });

  $('#bulkUploadBtn').addEventListener('click', ()=>{
    const file = $('#bulkUpload').files[0];
    if(file) handleBulkUpload(file);
  });

  $('#addBtn').addEventListener('click', ()=>{
    $('#addModal').classList.add('show');
  });
  $('#cancelAdd').addEventListener('click', ()=>{
    $('#addModal').classList.remove('show');
  });
  ['#addForm input[name="trip"]', '#editForm input[name="trip"]'].forEach(sel=>{
    const el = $(sel);
    if(el){
      el.addEventListener('input',()=>{
        el.value = el.value.replace(/\D/g,'');
      });
    }
  });
  $('#addForm').addEventListener('submit', async ev=>{
    ev.preventDefault();
    const form = ev.target;
    const trip = form.trip.value.trim();
    if(!validateTrip(trip)) return;
    const data = {
      trip,
      ejecutivo: form.ejecutivo.value.trim(),
      caja: form.caja.value.trim(),
      estatus: form.estatus.value.trim(),
      referencia: form.referencia.value.trim(),
      cliente: form.cliente.value.trim(),
      destino: form.destino.value.trim(),
      citaCarga: toGASDate(form.citaCarga.value)
    };
    const ok = await addRecord(data);
    if(ok){
      const row = {};
      row[COL.trip] = data.trip;
      row[COL.ejecutivo] = data.ejecutivo;
      row[COL.caja] = data.caja;
      row[COL.estatus] = data.estatus;
      row[COL.referencia] = data.referencia;
      row[COL.cliente] = data.cliente;
      row[COL.destino] = data.destino;
      row[COL.citaCarga] = data.citaCarga;
      cache.push(row);
      populateStatusFilter(cache);
      populateEjecutivoFilter(cache);
      renderCurrent();
      form.reset();
      $('#addModal').classList.remove('show');
    }
  });
  $('#cancelEdit').addEventListener('click', ()=>{
    $('#editModal').classList.remove('show');
  });
  $('#editForm').addEventListener('submit', async ev=>{
    ev.preventDefault();
    const form = ev.target;
    const row = cache.find(r => String(r[COL.trip])===String(form.originalTrip.value));
    const trip = form.trip.value.trim();
    if(!validateTrip(trip, form.originalTrip.value)) return;
    const data = {
      originalTrip: form.originalTrip.value,
      trip,
      caja: form.caja.value.trim(),
      referencia: form.referencia.value.trim(),
      cliente: form.cliente.value.trim(),
      destino: form.destino.value.trim(),
      ejecutivo: form.ejecutivo.value.trim(),
      estatus: row ? row[COL.estatus] : '',
      segmento: form.segmento.value.trim(),
      trmx: form.trmx.value.trim(),
      trusa: form.trusa.value.trim(),
      citaCarga: toGASDate(form.citaCarga.value),
      llegadaCarga: toGASDate(form.llegadaCarga.value),
      citaEntrega: toGASDate(form.citaEntrega.value),
      llegadaEntrega: toGASDate(form.llegadaEntrega.value),
      comentarios: form.comentarios.value.trim(),
      docs: form.docs.value.trim(),
      tracking: form.tracking.value.trim()
    };
    const ok = await updateRecord(data);
    if(ok && row){
      row[COL.trip] = data.trip;
      row[COL.caja] = data.caja;
      row[COL.referencia] = data.referencia;
      row[COL.cliente] = data.cliente;
      row[COL.destino] = data.destino;
      row[COL.ejecutivo] = data.ejecutivo;
      row[COL.estatus] = data.estatus;
      row[COL.segmento] = data.segmento;
      row[COL.trmx] = data.trmx;
      row[COL.trusa] = data.trusa;
      row[COL.citaCarga] = data.citaCarga;
      row[COL.llegadaCarga] = data.llegadaCarga;
      row[COL.citaEntrega] = data.citaEntrega;
      row[COL.llegadaEntrega] = data.llegadaEntrega;
      row[COL.comentarios] = data.comentarios;
      row[COL.docs] = data.docs;
      row[COL.tracking] = data.tracking;
    }
    if(ok){
      populateStatusFilter(cache);
      populateEjecutivoFilter(cache);
      renderCurrent();
      $('#editModal').classList.remove('show');
    }
  });
  $('#cancelArrival').addEventListener('click', ()=>{
    $('#arrivalModal').classList.remove('show');
    $('#arrivalForm').reset();
    if(pendingStatusChange){
      pendingStatusChange.select.value = pendingStatusChange.row[COL.estatus] || '';
      pendingStatusChange = null;
    }
  });
  $('#arrivalForm').addEventListener('submit', async ev=>{
    ev.preventDefault();
    if(!pendingStatusChange) return;
    const arrival = ev.target.llegadaEntrega.value;
    const { row, select, newStatus } = pendingStatusChange;
    const data = {
      originalTrip: row[COL.trip],
      trip: row[COL.trip],
      caja: row[COL.caja] || '',
      referencia: row[COL.referencia] || '',
      cliente: row[COL.cliente] || '',
      destino: row[COL.destino] || '',
      ejecutivo: row[COL.ejecutivo] || '',
      estatus: newStatus,
      segmento: row[COL.segmento] || '',
      trmx: row[COL.trmx] || '',
      trusa: row[COL.trusa] || '',
      citaCarga: row[COL.citaCarga] || '',
      llegadaCarga: row[COL.llegadaCarga] || '',
      citaEntrega: row[COL.citaEntrega] || '',
      llegadaEntrega: toGASDate(arrival),
      comentarios: row[COL.comentarios] || '',
      docs: row[COL.docs] || '',
      tracking: row[COL.tracking] || ''
    };
    const ok = await updateRecord(data);
    if(ok){
      row[COL.estatus] = newStatus;
      row[COL.llegadaEntrega] = data.llegadaEntrega;
      populateStatusFilter(cache);
      renderCurrent();
    }else{
      select.value = row[COL.estatus] || '';
    }
    ev.target.reset();
    $('#arrivalModal').classList.remove('show');
    pendingStatusChange = null;
  });
  $('#generalMenu').addEventListener('click', ev => {
    setActiveTopBtn(ev.currentTarget);
    renderGeneral(cache);
  });
  $('#dailyMenu').addEventListener('click', ev => {
    setActiveTopBtn(ev.currentTarget);
    if (hasActiveFilters()) clearFilters();
    renderDaily(cache);
  });
  $('#weeklyMenu').addEventListener('click', ev => {
    setActiveTopBtn(ev.currentTarget);
    if (hasActiveFilters()) clearFilters();
    renderProgramaSemanal(cache);
  });
  $('#deliveryMenu').addEventListener('click', ev => {
    setActiveTopBtn(ev.currentTarget);
    if (hasActiveFilters()) clearFilters();
    renderEntregasHoy(cache);
  });
  $('#nlarMenu').addEventListener('click', ev => {
    setActiveTopBtn(ev.currentTarget);
    if (hasActiveFilters()) clearFilters();
    renderInventarioNlar(cache);
  });

  $('#loadsTable').addEventListener('click', async ev=>{
    const btn = ev.target.closest('button[data-act]');
    const link = ev.target.closest('a:not(.trip-edit)');
    if(btn){
      const act = btn.dataset.act; const trip = btn.dataset.trip;
      if(act==='copy'){
        const msg = buildCopyMsg(cache.find(r => String(r[COL.trip])===String(trip))||{});
        try{ await navigator.clipboard.writeText(msg); toast('Texto copiado'); }
        catch{
          const ta=document.createElement('textarea'); ta.value=msg; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); ta.remove(); toast('Texto copiado');
        }
      }
      return;
    }
    if(link) return;
    const tripEl = ev.target.closest('.trip-edit');
    if(tripEl){
      const tr = tripEl.closest('tr');
      if(tr) openEditModal(tr.dataset.trip);
    }
  });
}
if (typeof document !== 'undefined') {
  const initAuthAndApp = () => {
    const loginForm = document.getElementById('loginForm');

    if(!loginForm){
      toggleAuthSections(true);
      bootstrapApp();
      return;
    }

    toggleAuthSections(false);
    focusLoginInput();

    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      if(hasAuthenticated) return;

      const formData = new FormData(loginForm);
      const username = String(formData.get('username') ?? '').trim();
      const rawPassword = formData.get('password');
      const passwordValue = typeof rawPassword === 'string' ? rawPassword : String(rawPassword ?? '');
      const sanitizedPassword = passwordValue.trim();

      if(!username || !sanitizedPassword){
        if(typeof toast === 'function'){
          toast('Ingresa usuario y contraseña válidos', 'error');
        }
        loginForm.reportValidity();
        return;
      }

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if(submitBtn) submitBtn.disabled = true;

      try{
        try{
          await ensureSecureConfigLoaded();
        }catch(err){
          reportError('No se pudo cargar la configuración segura.', err, {
            toastMessage: 'No se pudo cargar la configuración segura.'
          });
        }

        const allowedUsers = getConfiguredUsers();
        const matchedUser = matchAllowedUser(username, sanitizedPassword, allowedUsers);

        if(allowedUsers.length && !matchedUser){
          if(typeof toast === 'function'){
            toast(LOGIN_INVALID_MESSAGE, 'error');
          }
          const passwordInput = loginForm.querySelector('input[name="password"]');
          if(passwordInput){
            passwordInput.value = '';
            passwordInput.focus();
          }
          return;
        }

        hasAuthenticated = true;
        toggleAuthSections(true);
        loginForm.reset();

        if(typeof toast === 'function'){
          const displayName = matchedUser?.displayName || matchedUser?.username || username;
          toast(displayName ? `Bienvenido, ${displayName}!` : 'Inicio de sesión correcto', 'success');
        }

        await bootstrapApp();
        focusSearchBox();
      }catch(err){
        reportError('No se pudo iniciar la aplicación tras iniciar sesión.', err, {
          toastMessage: 'No se pudo iniciar la aplicación'
        });
        hasAuthenticated = false;
        toggleAuthSections(false);
        focusLoginInput();
      }finally{
        if(submitBtn) submitBtn.disabled = false;
      }
    });
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initAuthAndApp, { once: true });
  }else{
    initAuthAndApp();
  }
}
