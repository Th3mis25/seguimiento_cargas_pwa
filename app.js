(function (global) {
  'use strict';

  const DEFAULT_LOCALE = 'es-MX';
  const STORAGE_TOKEN_KEY = 'seguimiento_cargas_token';
  const STORAGE_USER_KEY = 'seguimiento_cargas_user';
  const DATE_HEADER_REGEX = /(fecha|cita|llegada|salida|hora)/i;
  const COLUMN_CONFIG = [
    { key: 'trip', label: 'Trip' },
    { key: 'ejecutivo', label: 'Ejecutivo' },
    { key: 'caja', label: 'Caja' },
    { key: 'referencia', label: 'Referencia' },
    { key: 'cliente', label: 'Cliente' },
    { key: 'destino', label: 'Destino' },
    { key: 'estatus', label: 'Estatus' },
    { key: 'segmento', label: 'Segmento' },
    { key: 'trmx', label: 'TR-MX' },
    { key: 'trusa', label: 'TR-USA' },
    { key: 'citaCarga', label: 'Cita carga' },
    { key: 'llegadaCarga', label: 'Llegada carga' },
    { key: 'citaEntrega', label: 'Cita entrega' },
    { key: 'llegadaEntrega', label: 'Llegada entrega' },
    { key: 'comentarios', label: 'Comentarios' },
    { key: 'docs', label: 'Docs' },
    { key: 'tracking', label: 'Tracking' }
  ];
  const DATE_FIELD_KEYS = ['citaCarga', 'llegadaCarga', 'citaEntrega', 'llegadaEntrega'];
  const DATE_FIELD_SET = new Set(DATE_FIELD_KEYS);
  const COLUMN_LABEL_TO_KEY = COLUMN_CONFIG.reduce(function (acc, column) {
    if (column && column.label) {
      acc[String(column.label).trim().toLowerCase()] = column.key;
    }
    return acc;
  }, {});
  const DEFAULT_USER = {
    id: 'admin',
    username: 'admin',
    password: 'admin123',
    displayName: 'Administrador'
  };

  function pad2(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return '00';
    }
    const abs = Math.abs(Math.trunc(num));
    return abs < 10 ? `0${abs}` : String(abs);
  }

  function parseYear(value) {
    const year = parseInt(value, 10);
    if (!Number.isFinite(year)) {
      return NaN;
    }
    if (String(value).length === 2) {
      return year >= 70 ? 1900 + year : 2000 + year;
    }
    return year;
  }

  function parseDateParts(input) {
    if (input == null || input === '') {
      return null;
    }

    if (input instanceof Date && !isNaN(input.getTime())) {
      return {
        year: input.getFullYear(),
        month: input.getMonth() + 1,
        day: input.getDate(),
        hour: input.getHours(),
        minute: input.getMinutes()
      };
    }

    if (typeof input === 'number' && Number.isFinite(input)) {
      const date = new Date(input);
      if (!isNaN(date.getTime())) {
        return {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          hour: date.getHours(),
          minute: date.getMinutes()
        };
      }
    }

    const value = String(input).trim();
    if (!value) {
      return null;
    }

    const isoMatch = value.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})[T\s]([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?$/i);
    if (isoMatch) {
      return {
        year: parseYear(isoMatch[1]),
        month: parseInt(isoMatch[2], 10),
        day: parseInt(isoMatch[3], 10),
        hour: parseInt(isoMatch[4], 10),
        minute: parseInt(isoMatch[5], 10)
      };
    }

    const dmyMatch = value.match(/^([0-9]{1,2})[\/\-.]([0-9]{1,2})[\/\-.]([0-9]{2,4})(?:[ T]([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?(?:\s*([AP])M)?)?$/i);
    if (dmyMatch) {
      let hour = dmyMatch[4] != null ? parseInt(dmyMatch[4], 10) : 0;
      const minute = dmyMatch[5] != null ? parseInt(dmyMatch[5], 10) : 0;
      const meridiem = dmyMatch[7] ? dmyMatch[7].toUpperCase() : '';
      if (meridiem === 'P' && hour < 12) {
        hour += 12;
      }
      if (meridiem === 'A' && hour === 12) {
        hour = 0;
      }
      return {
        year: parseYear(dmyMatch[3]),
        month: parseInt(dmyMatch[2], 10),
        day: parseInt(dmyMatch[1], 10),
        hour: hour,
        minute: minute
      };
    }

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
        hour: parsed.getHours(),
        minute: parsed.getMinutes()
      };
    }

    return null;
  }

  function partsToDate(parts) {
    if (!parts) {
      return null;
    }
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    const hour = Number.isFinite(parts.hour) ? Number(parts.hour) : 0;
    const minute = Number.isFinite(parts.minute) ? Number(parts.minute) : 0;
    const second = Number.isFinite(parts.second) ? Number(parts.second) : 0;
    const date = new Date(year, month - 1, day, hour, minute, second, 0);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  function parseDateValue(input) {
    if (input == null || input === '') {
      return null;
    }
    const parts = parseDateParts(input);
    if (!parts) {
      return null;
    }
    return partsToDate(parts);
  }

  function getDateSortValue(value) {
    const date = parseDateValue(value);
    if (!date) {
      return Number.POSITIVE_INFINITY;
    }
    const time = date.getTime();
    if (!Number.isFinite(time)) {
      return Number.POSITIVE_INFINITY;
    }
    return time;
  }

  function resolveLocale(locale) {
    if (typeof locale !== 'string' || !locale.trim()) {
      return DEFAULT_LOCALE;
    }
    return locale;
  }

  function fmtDate(value, locale) {
    const parts = parseDateParts(value);
    if (!parts) {
      if (value == null) return '';
      return String(value);
    }

    const normalizedLocale = resolveLocale(locale).toLowerCase();
    let separator = '/';
    let order = ['day', 'month', 'year'];

    if (normalizedLocale.startsWith('en')) {
      order = ['month', 'day', 'year'];
      separator = '/';
    } else if (normalizedLocale.startsWith('de')) {
      order = ['day', 'month', 'year'];
      separator = '.';
    } else if (normalizedLocale.includes('-')) {
      const language = normalizedLocale.split('-')[0];
      if (language === 'en') {
        order = ['month', 'day', 'year'];
        separator = '/';
      }
    }

    const dateSegments = order.map(function (key) {
      const valueKey = parts[key];
      if (key === 'year') {
        return String(valueKey).padStart(4, '0');
      }
      return pad2(valueKey);
    });

    const formattedDate = dateSegments.join(separator);
    const formattedTime = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
    return `${formattedDate} ${formattedTime}`.trim();
  }

  function toDateInputValue(value) {
    const parts = parseDateParts(value);
    if (!parts) {
      return '';
    }
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return '';
    }
    const hour = Number.isFinite(parts.hour) ? Number(parts.hour) : 0;
    const minute = Number.isFinite(parts.minute) ? Number(parts.minute) : 0;
    return (
      year +
      '-' + pad2(month) +
      '-' + pad2(day) +
      'T' + pad2(hour) +
      ':' + pad2(minute)
    );
  }

  function toApiDateValue(value) {
    if (value == null || value === '') {
      return '';
    }
    const parts = parseDateParts(value);
    if (!parts) {
      return '';
    }
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return '';
    }
    const hour = Number.isFinite(parts.hour) ? Number(parts.hour) : 0;
    const minute = Number.isFinite(parts.minute) ? Number(parts.minute) : 0;
    const second = Number.isFinite(parts.second) ? Number(parts.second) : 0;
    return (
      year +
      '-' + pad2(month) +
      '-' + pad2(day) +
      'T' + pad2(hour) +
      ':' + pad2(minute) +
      ':' + pad2(second)
    );
  }

  function getColumnKeyFromHeader(headerLabel) {
    if (headerLabel == null) {
      return null;
    }
    const normalized = String(headerLabel).trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(COLUMN_LABEL_TO_KEY, normalized)) {
      return COLUMN_LABEL_TO_KEY[normalized];
    }
    return null;
  }

  const DAILY_VIEW_ALLOWED_STATUS_SET = new Set(
    ['drop', 'live', 'qro yard', 'mty yard', 'loading', 'in transit mx'].map(function (status) {
      return status.toLowerCase();
    })
  );

  function matchesDailyLoadsView(row, context) {
    if (!row || !context || !context.columnMap) {
      return false;
    }
    const columnMap = context.columnMap;
    const citaCargaIndex = columnMap.citaCarga;
    const estatusIndex = columnMap.estatus;
    if (citaCargaIndex == null || estatusIndex == null) {
      return false;
    }
    const rawStatus = row[estatusIndex];
    const rawDate = row[citaCargaIndex];
    if (rawStatus == null || rawStatus === '' || rawDate == null || rawDate === '') {
      return false;
    }
    const normalizedStatus = String(rawStatus).trim().toLowerCase();
    if (!DAILY_VIEW_ALLOWED_STATUS_SET.has(normalizedStatus)) {
      return false;
    }
    const citaDate = parseDateValue(rawDate);
    if (!citaDate) {
      return false;
    }
    const now = context.now instanceof Date ? context.now : new Date();
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return citaDate < startOfTomorrow;
  }

  const TABLE_VIEWS = [
    {
      id: 'all',
      label: 'Todas las cargas',
      filter: function () {
        return true;
      }
    },
    {
      id: 'daily-loads',
      label: 'Cargas diarias',
      filter: matchesDailyLoadsView
    }
  ];

  function columnLetter(index) {
    let result = '';
    let i = index;
    while (i >= 0) {
      result = String.fromCharCode((i % 26) + 65) + result;
      i = Math.floor(i / 26) - 1;
    }
    return result;
  }

  function isDateHeader(label) {
    if (label == null) {
      return false;
    }
    const text = String(label).trim();
    if (!text) {
      return false;
    }
    return DATE_HEADER_REGEX.test(text);
  }

  function getStoredValue(key) {
    try {
      if (global.localStorage) {
        return global.localStorage.getItem(key);
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  function setStoredValue(key, value) {
    try {
      if (!global.localStorage) {
        return;
      }
      if (value === undefined || value === null) {
        global.localStorage.removeItem(key);
        return;
      }
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      global.localStorage.setItem(key, payload);
    } catch (err) {
      // Ignore storage errors (private mode, etc.)
    }
  }

  function normalizeUsers(config) {
    const result = [];
    if (!config) {
      return result;
    }

    function pushUser(raw) {
      if (!raw) return;
      const username = raw.usuario || raw.username || raw.user || raw.email;
      const password = raw.password || raw.pass || raw.clave;
      if (!username || !password) return;
      const displayName = raw.nombre || raw.displayName || raw.name || username;
      result.push({
        id: String(username).trim().toLowerCase(),
        username: String(username).trim(),
        password: String(password),
        displayName: String(displayName)
      });
    }

    if (Array.isArray(config.users)) {
      config.users.forEach(pushUser);
    }

    if (config.usuario && config.password) {
      pushUser(config);
    }

    const seen = new Set();
    return result.filter(function (user) {
      if (!user) return false;
      if (seen.has(user.id)) return false;
      seen.add(user.id);
      return true;
    });
  }

  function loadStoredUser() {
    const raw = getStoredValue(STORAGE_USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  async function fetchSecureConfig(url) {
    if (!url) {
      return {};
    }
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Secure config not available');
      }
      return await response.json();
    } catch (err) {
      return {};
    }
  }

  function normalizeObjectRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    const configuredColumns = COLUMN_CONFIG.filter(function (column) {
      return rows.some(function (row) {
        return row && Object.prototype.hasOwnProperty.call(row, column.key);
      });
    });

    const knownKeys = configuredColumns.map(function (column) {
      return column.key;
    });

    const extraKeys = [];
    rows.forEach(function (row) {
      if (!row || typeof row !== 'object') {
        return;
      }
      Object.keys(row).forEach(function (key) {
        if (knownKeys.indexOf(key) === -1 && extraKeys.indexOf(key) === -1) {
          extraKeys.push(key);
        }
      });
    });

    const headers = configuredColumns
      .map(function (column) { return column.label; })
      .concat(extraKeys);

    const values = rows.map(function (row) {
      const baseValues = configuredColumns.map(function (column) {
        return row && Object.prototype.hasOwnProperty.call(row, column.key)
          ? row[column.key]
          : '';
      });
      const extraValues = extraKeys.map(function (key) {
        return row && Object.prototype.hasOwnProperty.call(row, key)
          ? row[key]
          : '';
      });
      return baseValues.concat(extraValues);
    });

    return [headers].concat(values);
  }

  async function fetchSheetData(apiBase, token) {
    if (!apiBase) {
      throw new Error('Falta configurar la URL del Apps Script.');
    }
    const url = new URL(apiBase);
    if (token) {
      url.searchParams.set('token', token);
    }
    url.searchParams.set('t', Date.now().toString());
    try {
      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const payload = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        const error = payload && payload.error ? payload.error : `Error ${response.status}`;
        const err = new Error(error);
        err.status = response.status;
        throw err;
      }
      if (!payload || !Array.isArray(payload.data)) {
        return [];
      }
      if (payload.data.length === 0) {
        return [];
      }

      const firstRow = payload.data[0];
      if (Array.isArray(firstRow)) {
        return payload.data;
      }

      if (firstRow && typeof firstRow === 'object') {
        return normalizeObjectRows(payload.data);
      }

      return [];
    } catch (err) {
      if (err instanceof Error) {
        if (!err.message || err.message === 'Failed to fetch') {
          const friendly = new Error('No se pudo conectar con el Apps Script.');
          friendly.cause = err;
          throw friendly;
        }
        throw err;
      }
      throw new Error('No se pudo conectar con el Apps Script.');
    }
  }

  async function submitUpdateRequest(apiBase, token, payload) {
    if (!apiBase) {
      throw new Error('Falta configurar la URL del Apps Script.');
    }
    const url = new URL(apiBase);
    if (token) {
      url.searchParams.set('token', token);
    }
    const params = new URLSearchParams();
    Object.keys(payload || {}).forEach(function (key) {
      const value = payload[key];
      if (value == null) {
        params.append(key, '');
      } else {
        params.append(key, String(value));
      }
    });
    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json'
        },
        body: params.toString()
      });
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        const errorMessage = result && result.error ? result.error : `Error ${response.status}`;
        const err = new Error(errorMessage);
        err.status = response.status;
        throw err;
      }
      if (result && result.error) {
        const err = new Error(result.error);
        err.status = response.status;
        throw err;
      }
      return result;
    } catch (err) {
      if (err instanceof Error) {
        if (!err.message || err.message === 'Failed to fetch') {
          const friendly = new Error('No se pudo conectar con el Apps Script.');
          friendly.cause = err;
          throw friendly;
        }
        throw err;
      }
      throw new Error('No se pudo conectar con el Apps Script.');
    }
  }

  function initApp() {
    if (!global.document) {
      return;
    }

    const doc = global.document;
    const appRoot = doc.querySelector('[data-app]');
    if (!appRoot) {
      return;
    }

    const refs = {
      tableHead: doc.querySelector('[data-table-head]'),
      tableBody: doc.querySelector('[data-table-body]'),
      viewMenu: doc.querySelector('[data-view-menu]'),
      status: doc.querySelector('[data-status]'),
      refreshButton: doc.querySelector('[data-action="refresh"]'),
      logoutButton: doc.querySelector('[data-action="logout"]'),
      changeTokenButton: doc.querySelector('[data-action="change-token"]'),
      lastUpdated: doc.querySelector('[data-last-updated]'),
      currentUser: doc.querySelector('[data-current-user]'),
      loginModal: doc.querySelector('[data-login-modal]'),
      loginForm: doc.querySelector('[data-login-form]'),
      loginError: doc.querySelector('[data-login-error]'),
      loginTokenField: doc.querySelector('[data-token-field]'),
      backdrop: doc.querySelector('[data-backdrop]'),
      editModal: doc.querySelector('[data-edit-modal]'),
      editForm: doc.querySelector('[data-edit-form]'),
      editError: doc.querySelector('[data-edit-error]'),
      cancelEditButton: doc.querySelector('[data-action="cancel-edit"]')
    };

    const state = {
      config: global.APP_CONFIG || { API_BASE: '', SECURE_CONFIG_URL: '' },
      token: '',
      users: [],
      data: [],
      locale: (global.navigator && global.navigator.language) || DEFAULT_LOCALE,
      currentUser: null,
      loading: false,
      secureConfigLoaded: false,
      editingRecord: null,
      currentViewId: TABLE_VIEWS[0] ? TABLE_VIEWS[0].id : 'all'
    };

    function setStatus(message, type) {
      const el = refs.status;
      if (!el) return;
      if (!message) {
        el.textContent = '';
        el.className = 'sheet-app__status';
        el.hidden = true;
        return;
      }
      const statusClass = 'sheet-app__status' + (type ? ` is-${type}` : '');
      el.className = statusClass;
      el.hidden = false;
      el.textContent = message;
    }

    function getActiveView() {
      const currentId = state.currentViewId;
      for (let i = 0; i < TABLE_VIEWS.length; i++) {
        const view = TABLE_VIEWS[i];
        if (view && view.id === currentId) {
          return view;
        }
      }
      return TABLE_VIEWS[0];
    }

    function renderViewMenu() {
      const container = refs.viewMenu;
      if (!container) {
        return;
      }
      container.innerHTML = '';
      const fragment = doc.createDocumentFragment();
      const label = doc.createElement('span');
      label.className = 'sheet-grid__views-label';
      label.textContent = 'Vistas:';
      fragment.appendChild(label);
      TABLE_VIEWS.forEach(function (view) {
        if (!view) {
          return;
        }
        const button = doc.createElement('button');
        button.type = 'button';
        button.className =
          'sheet-grid__view-button' + (view.id === state.currentViewId ? ' is-active' : '');
        button.setAttribute('data-view-id', view.id);
        button.setAttribute('aria-pressed', view.id === state.currentViewId ? 'true' : 'false');
        button.textContent = view.label;
        fragment.appendChild(button);
      });
      container.appendChild(fragment);
    }

    function setCurrentView(viewId) {
      const exists = TABLE_VIEWS.some(function (view) {
        return view && view.id === viewId;
      });
      const nextId = exists ? viewId : state.currentViewId;
      if (!nextId) {
        return;
      }
      if (state.currentViewId === nextId) {
        renderViewMenu();
        return;
      }
      state.currentViewId = nextId;
      renderViewMenu();
      renderTable();
    }

    function handleViewMenuClick(event) {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') {
        return;
      }
      const button = target.closest('[data-view-id]');
      if (!button) {
        return;
      }
      event.preventDefault();
      const viewId = button.getAttribute('data-view-id');
      if (viewId) {
        setCurrentView(viewId);
      }
    }

    function showBackdrop() {
      if (!refs.backdrop) {
        return;
      }
      refs.backdrop.classList.remove('hidden');
      refs.backdrop.classList.add('is-visible');
    }

    function hideBackdropIfNoModalVisible() {
      if (!refs.backdrop) {
        return;
      }
      const loginVisible = refs.loginModal && refs.loginModal.classList.contains('is-visible');
      const editVisible = refs.editModal && refs.editModal.classList.contains('is-visible');
      if (!loginVisible && !editVisible) {
        refs.backdrop.classList.remove('is-visible');
        refs.backdrop.classList.add('hidden');
      }
    }

    function setEditFormDisabled(isDisabled) {
      if (!refs.editForm) {
        return;
      }
      const elements = refs.editForm.querySelectorAll('input, textarea, button');
      elements.forEach(function (element) {
        element.disabled = Boolean(isDisabled);
      });
    }

    function updateLastUpdated(date) {
      if (!refs.lastUpdated) return;
      if (!date) {
        refs.lastUpdated.textContent = 'Última actualización: —';
        return;
      }
      const formatted = fmtDate(date, state.locale);
      refs.lastUpdated.textContent = `Última actualización: ${formatted}`;
    }

    function updateUserBadge() {
      if (!refs.currentUser) return;
      if (!state.currentUser) {
        refs.currentUser.textContent = '';
        return;
      }
      refs.currentUser.textContent = `Usuario: ${state.currentUser.displayName || state.currentUser.username}`;
    }

    function toggleLoading(isLoading) {
      state.loading = isLoading;
      if (refs.refreshButton) {
        refs.refreshButton.disabled = Boolean(isLoading);
      }
      if (isLoading) {
        appRoot.classList.add('is-loading');
      } else {
        appRoot.classList.remove('is-loading');
      }
    }

    function clearTable() {
      if (refs.tableHead) refs.tableHead.innerHTML = '';
      if (refs.tableBody) refs.tableBody.innerHTML = '';
    }

    function renderTable() {
      if (!refs.tableHead || !refs.tableBody) {
        return;
      }

      clearTable();

      if (!Array.isArray(state.data) || state.data.length === 0) {
        setStatus('No hay datos disponibles en la hoja.', 'info');
        return;
      }

      const headers = state.data[0] || [];
      const dataRows = state.data.slice(1);
      let columnCount = headers.length;
      for (let i = 0; i < dataRows.length; i++) {
        if (Array.isArray(dataRows[i]) && dataRows[i].length > columnCount) {
          columnCount = dataRows[i].length;
        }
      }

      const columnMap = {};
      const dateColumnIndices = [];
      headers.forEach(function (header, index) {
        const key = getColumnKeyFromHeader(header);
        if (key) {
          columnMap[key] = index;
        }
        if (isDateHeader(header)) {
          dateColumnIndices.push(index);
        }
      });

      const rowsWithIndex = dataRows.map(function (row, index) {
        return {
          row: row,
          dataIndex: index + 1
        };
      });

      const activeView = getActiveView();
      const filterContext = {
        columnMap: columnMap,
        headers: headers,
        now: new Date()
      };
      let rowsToRender = rowsWithIndex;
      if (activeView && typeof activeView.filter === 'function') {
        rowsToRender = rowsWithIndex.filter(function (entry) {
          try {
            return activeView.filter(entry.row, filterContext);
          } catch (err) {
            return false;
          }
        });
      }

      if (dateColumnIndices.length > 0 && rowsToRender.length > 1) {
        const sortableEntries = rowsToRender.map(function (entry) {
          const row = Array.isArray(entry.row) ? entry.row : [];
          const sortValues = dateColumnIndices.map(function (columnIndex) {
            if (columnIndex >= row.length) {
              return Number.POSITIVE_INFINITY;
            }
            return getDateSortValue(row[columnIndex]);
          });
          return {
            entry: entry,
            sortValues: sortValues
          };
        });

        sortableEntries.sort(function (a, b) {
          for (let i = 0; i < dateColumnIndices.length; i++) {
            const aValue = a.sortValues[i];
            const bValue = b.sortValues[i];
            if (aValue < bValue) {
              return -1;
            }
            if (aValue > bValue) {
              return 1;
            }
          }
          return a.entry.dataIndex - b.entry.dataIndex;
        });

        rowsToRender = sortableEntries.map(function (item) {
          return item.entry;
        });
      }

      const headerRow = doc.createElement('tr');

      for (let c = 0; c < columnCount; c++) {
        const th = doc.createElement('th');
        const headerLabel = headers[c];
        const label = headerLabel != null && headerLabel !== '' ? headerLabel : columnLetter(c);
        th.textContent = label;
        if (isDateHeader(label)) {
          th.classList.add('is-date');
        }
        headerRow.appendChild(th);
      }

      refs.tableHead.appendChild(headerRow);

      const fragment = doc.createDocumentFragment();
      rowsToRender.forEach(function (entry) {
        const row = Array.isArray(entry.row) ? entry.row : [];
        const tr = doc.createElement('tr');

        for (let c = 0; c < columnCount; c++) {
          const td = doc.createElement('td');
          const headerLabel = headers[c];
          let value = row && row[c] != null ? row[c] : '';
          const normalizedHeader = headerLabel == null ? '' : String(headerLabel).trim().toLowerCase();
          const isTripColumn = normalizedHeader === 'trip';
          if (isDateHeader(headerLabel) && value !== '') {
            const formatted = fmtDate(value, state.locale);
            value = formatted || value;
            td.classList.add('is-date');
          }
          if (value === null || value === undefined || value === '') {
            td.classList.add('is-empty');
            td.textContent = '';
          } else if (isTripColumn) {
            const displayValue = typeof value === 'string' ? value : String(value);
            if (displayValue) {
              const button = doc.createElement('button');
              button.type = 'button';
              button.className = 'table-link-button';
              button.setAttribute('data-action', 'open-edit');
              button.setAttribute('data-row-index', String(entry.dataIndex));
              button.setAttribute('aria-label', `Editar registro del trip ${displayValue}`);
              button.title = 'Editar registro';
              button.textContent = displayValue;
              td.appendChild(button);
            } else {
              td.classList.add('is-empty');
              td.textContent = '';
            }
          } else {
            td.textContent = typeof value === 'string' ? value : String(value);
          }
          tr.appendChild(td);
        }

        fragment.appendChild(tr);
      });

      refs.tableBody.appendChild(fragment);

      if (rowsToRender.length === 0) {
        setStatus('No hay registros para la vista seleccionada.', 'info');
      } else {
        setStatus('Datos sincronizados correctamente.', 'success');
      }
    }

    function getRowDataForIndex(dataIndex) {
      if (!Array.isArray(state.data) || state.data.length <= dataIndex) {
        return null;
      }
      const headers = state.data[0];
      const row = state.data[dataIndex];
      if (!Array.isArray(headers) || !Array.isArray(row)) {
        return null;
      }
      const columnMap = {};
      headers.forEach(function (header, index) {
        const key = getColumnKeyFromHeader(header);
        if (key) {
          columnMap[key] = index;
        }
      });
      const values = {};
      COLUMN_CONFIG.forEach(function (column) {
        const idx = columnMap[column.key];
        if (idx != null) {
          const cellValue = row[idx];
          values[column.key] = cellValue == null ? '' : cellValue;
        } else {
          values[column.key] = '';
        }
      });
      return {
        headers: headers,
        values: values,
        columnMap: columnMap
      };
    }

    function showLoginModal() {
      showBackdrop();
      if (refs.loginModal) {
        refs.loginModal.classList.remove('hidden');
        refs.loginModal.classList.add('is-visible');
      }
      if (refs.loginForm) {
        refs.loginForm.reset();
        if (refs.loginError) {
          refs.loginError.textContent = '';
        }
        const storedUser = loadStoredUser();
        const usernameInput = refs.loginForm.querySelector('input[name="username"]');
        if (usernameInput && storedUser && storedUser.username) {
          usernameInput.value = storedUser.username;
        }
        const tokenInput = refs.loginForm.querySelector('input[name="token"]');
        if (tokenInput) {
          tokenInput.value = state.token || '';
        }
        if (refs.loginTokenField) {
          if (state.token) {
            refs.loginTokenField.classList.add('is-hidden');
          } else {
            refs.loginTokenField.classList.remove('is-hidden');
          }
        }
        const passwordInput = refs.loginForm.querySelector('input[name="password"]');
        if (passwordInput) {
          passwordInput.value = '';
        }
        if (usernameInput) {
          usernameInput.focus();
        }
      }
    }

    function hideLoginModal() {
      if (refs.loginModal) {
        refs.loginModal.classList.remove('is-visible');
        refs.loginModal.classList.add('hidden');
      }
      if (refs.loginError) {
        refs.loginError.textContent = '';
      }
      hideBackdropIfNoModalVisible();
    }

    function openEditModal(dataIndex) {
      if (!refs.editForm || !refs.editModal) {
        return;
      }
      if (!state.currentUser) {
        showLoginModal();
        return;
      }
      const rowData = getRowDataForIndex(dataIndex);
      if (!rowData) {
        setStatus('No fue posible cargar el registro seleccionado.', 'error');
        return;
      }
      const values = rowData.values || {};
      const originalTripValue = values.trip == null ? '' : String(values.trip).trim();
      if (!originalTripValue) {
        setStatus('El registro seleccionado no tiene número de trip.', 'error');
        return;
      }
      state.editingRecord = {
        dataIndex: dataIndex,
        originalTrip: originalTripValue,
        values: values
      };
      refs.editForm.reset();
      setEditFormDisabled(false);
      Object.keys(values).forEach(function (key) {
        const input = refs.editForm.querySelector('[name="' + key + '"]');
        if (!input) {
          return;
        }
        const rawValue = values[key];
        let preparedValue;
        if (DATE_FIELD_SET.has(key)) {
          preparedValue = toDateInputValue(rawValue);
        } else if (rawValue == null) {
          preparedValue = '';
        } else {
          preparedValue = String(rawValue);
        }
        if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
          input.value = preparedValue || '';
        }
      });
      if (refs.editError) {
        refs.editError.textContent = '';
      }
      showBackdrop();
      refs.editModal.classList.remove('hidden');
      refs.editModal.classList.add('is-visible');
      const tripInput = refs.editForm.querySelector('[name="trip"]');
      if (tripInput) {
        tripInput.focus();
        if (typeof tripInput.select === 'function') {
          tripInput.select();
        }
      }
    }

    function closeEditModal() {
      if (refs.editModal) {
        refs.editModal.classList.remove('is-visible');
        refs.editModal.classList.add('hidden');
      }
      if (refs.editError) {
        refs.editError.textContent = '';
      }
      setEditFormDisabled(false);
      if (refs.editForm) {
        refs.editForm.reset();
      }
      state.editingRecord = null;
      hideBackdropIfNoModalVisible();
    }

    function handleTableBodyClick(event) {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') {
        return;
      }
      const trigger = target.closest('[data-action="open-edit"]');
      if (!trigger) {
        return;
      }
      event.preventDefault();
      const rowIndexAttr = trigger.getAttribute('data-row-index');
      const dataIndex = rowIndexAttr == null ? NaN : parseInt(rowIndexAttr, 10);
      if (Number.isNaN(dataIndex)) {
        return;
      }
      openEditModal(dataIndex);
    }

    async function handleEditSubmit(event) {
      event.preventDefault();
      if (!refs.editForm) {
        return;
      }
      if (!state.editingRecord) {
        return;
      }
      const formData = new global.FormData(refs.editForm);
      const tripValue = String(formData.get('trip') || '').trim();
      const ejecutivoValue = String(formData.get('ejecutivo') || '').trim();
      if (!tripValue || !/^\d+$/.test(tripValue)) {
        if (refs.editError) {
          refs.editError.textContent = 'Ingresa un número de trip válido.';
        }
        const tripInput = refs.editForm.querySelector('[name="trip"]');
        if (tripInput) {
          tripInput.focus();
        }
        return;
      }
      if (!ejecutivoValue) {
        if (refs.editError) {
          refs.editError.textContent = 'El campo Ejecutivo es obligatorio.';
        }
        const ejecutivoInput = refs.editForm.querySelector('[name="ejecutivo"]');
        if (ejecutivoInput) {
          ejecutivoInput.focus();
        }
        return;
      }
      if (!state.editingRecord.originalTrip) {
        if (refs.editError) {
          refs.editError.textContent = 'No se encontró el trip original del registro.';
        }
        return;
      }
      if (!state.config || !state.config.API_BASE) {
        const message = 'Falta configurar la URL del Apps Script.';
        if (refs.editError) {
          refs.editError.textContent = message;
        }
        setStatus(message, 'error');
        return;
      }
      if (!state.token) {
        const message = 'Sesión expirada. Inicia sesión nuevamente.';
        if (refs.editError) {
          refs.editError.textContent = message;
        }
        setStatus(message, 'error');
        closeEditModal();
        showLoginModal();
        return;
      }

      function getTrimmed(name) {
        const value = formData.get(name);
        return value == null ? '' : String(value).trim();
      }

      const payload = {
        action: 'update',
        originalTrip: state.editingRecord.originalTrip,
        trip: tripValue,
        ejecutivo: ejecutivoValue,
        caja: getTrimmed('caja'),
        referencia: getTrimmed('referencia'),
        cliente: getTrimmed('cliente'),
        destino: getTrimmed('destino'),
        estatus: getTrimmed('estatus'),
        segmento: getTrimmed('segmento'),
        trmx: getTrimmed('trmx'),
        trusa: getTrimmed('trusa'),
        citaCarga: toApiDateValue(formData.get('citaCarga')),
        llegadaCarga: toApiDateValue(formData.get('llegadaCarga')),
        citaEntrega: toApiDateValue(formData.get('citaEntrega')),
        llegadaEntrega: toApiDateValue(formData.get('llegadaEntrega')),
        comentarios: (function () {
          const value = formData.get('comentarios');
          return value == null ? '' : String(value);
        })(),
        docs: getTrimmed('docs'),
        tracking: getTrimmed('tracking')
      };

      if (refs.editError) {
        refs.editError.textContent = '';
      }
      setEditFormDisabled(true);
      setStatus('Guardando cambios…', 'info');

      try {
        await submitUpdateRequest(state.config.API_BASE, state.token, payload);
        closeEditModal();
        await loadData();
        if (!refs.status || !refs.status.classList.contains('is-error')) {
          setStatus('Registro actualizado correctamente.', 'success');
        }
      } catch (err) {
        const message = err && err.message ? err.message : 'Error al actualizar el registro.';
        if (err && err.status === 401) {
          state.token = '';
          setStoredValue(STORAGE_TOKEN_KEY, null);
          state.currentUser = null;
          updateUserBadge();
          clearTable();
          updateLastUpdated(null);
          closeEditModal();
          setStatus('Sesión expirada. Inicia sesión nuevamente.', 'error');
          showLoginModal();
          return;
        }
        if (refs.editError) {
          refs.editError.textContent = message;
        }
        setStatus(message, 'error');
      } finally {
        setEditFormDisabled(false);
      }
    }

    function handleLoginSubmit(event) {
      event.preventDefault();
      if (!refs.loginForm) return;
      const formData = new global.FormData(refs.loginForm);
      const username = String(formData.get('username') || '').trim();
      const password = String(formData.get('password') || '');
      const tokenInput = String(formData.get('token') || '').trim();

      if (!username || !password) {
        if (refs.loginError) {
          refs.loginError.textContent = 'Ingresa usuario y contraseña.';
        }
        return;
      }

      let tokenToUse = state.token;
      if (!tokenToUse && tokenInput) {
        tokenToUse = tokenInput;
      }

      if (!tokenToUse) {
        if (refs.loginError) {
          refs.loginError.textContent = 'Ingresa el token proporcionado por el Apps Script.';
        }
        return;
      }

      const match = state.users.find(function (user) {
        return user.id === username.toLowerCase();
      }) || (state.users.length === 0 && username.toLowerCase() === DEFAULT_USER.id ? DEFAULT_USER : null);

      if (!match || match.password !== password) {
        if (refs.loginError) {
          refs.loginError.textContent = 'Credenciales inválidas. Verifica usuario y contraseña.';
        }
        return;
      }

      state.currentUser = match;
      state.token = tokenToUse;
      setStoredValue(STORAGE_TOKEN_KEY, tokenToUse);
      setStoredValue(STORAGE_USER_KEY, { username: match.username, displayName: match.displayName });
      updateUserBadge();
      hideLoginModal();
      setStatus(`Sesión iniciada como ${match.displayName}.`, 'success');
      loadData();
    }

    function handleLogout() {
      closeEditModal();
      state.currentUser = null;
      updateUserBadge();
      setStatus('Sesión cerrada. Vuelve a iniciar sesión para ver la hoja.', 'info');
      clearTable();
      updateLastUpdated(null);
      showLoginModal();
    }

    function handleChangeToken() {
      const promptValue = global.prompt('Introduce el token actualizado del Apps Script:', state.token || '');
      if (promptValue == null) {
        return;
      }
      const trimmed = String(promptValue).trim();
      if (!trimmed) {
        setStatus('El token no puede estar vacío.', 'error');
        return;
      }
      state.token = trimmed;
      setStoredValue(STORAGE_TOKEN_KEY, trimmed);
      if (state.currentUser) {
        setStatus('Token actualizado. Sincronizando datos…', 'info');
        loadData();
      } else {
        setStatus('Token actualizado. Inicia sesión para continuar.', 'success');
      }
    }

    async function loadData() {
      if (!state.currentUser) {
        showLoginModal();
        return;
      }
      if (!state.token) {
        setStatus('No se encontró el token. Actualízalo para continuar.', 'error');
        showLoginModal();
        return;
      }
      toggleLoading(true);
      setStatus('Cargando datos desde la hoja…', 'info');
      try {
        const rows = await fetchSheetData(state.config.API_BASE, state.token);
        state.data = rows;
        renderTable();
        updateLastUpdated(new Date());
      } catch (err) {
        const message = err && err.message ? err.message : 'Error al cargar los datos.';
        setStatus(message, 'error');
        if (err && err.status === 401) {
          state.token = '';
          setStoredValue(STORAGE_TOKEN_KEY, null);
          showLoginModal();
        }
      } finally {
        toggleLoading(false);
      }
    }

    async function bootstrap() {
      const secureConfig = await fetchSecureConfig(state.config.SECURE_CONFIG_URL);
      state.secureConfigLoaded = true;
      const configToken = secureConfig.API_TOKEN || secureConfig.apiToken || null;
      const storedToken = getStoredValue(STORAGE_TOKEN_KEY);
      state.token = (configToken || storedToken || '').trim();
      if (state.token) {
        setStoredValue(STORAGE_TOKEN_KEY, state.token);
      }

      const normalizedUsers = normalizeUsers(secureConfig);
      if (normalizedUsers.length > 0) {
        state.users = normalizedUsers;
      } else {
        state.users = [DEFAULT_USER];
      }

      showLoginModal();
    }

    if (refs.loginForm) {
      refs.loginForm.addEventListener('submit', handleLoginSubmit);
    }
    if (refs.tableBody) {
      refs.tableBody.addEventListener('click', handleTableBodyClick);
    }
    if (refs.editForm) {
      refs.editForm.addEventListener('submit', handleEditSubmit);
    }
    if (refs.cancelEditButton) {
      refs.cancelEditButton.addEventListener('click', function () {
        closeEditModal();
      });
    }
    if (refs.refreshButton) {
      refs.refreshButton.addEventListener('click', function () {
        loadData();
      });
    }
    if (refs.logoutButton) {
      refs.logoutButton.addEventListener('click', handleLogout);
    }
    if (refs.changeTokenButton) {
      refs.changeTokenButton.addEventListener('click', handleChangeToken);
    }
    if (refs.viewMenu) {
      refs.viewMenu.addEventListener('click', handleViewMenuClick);
    }

    renderViewMenu();

    bootstrap();

    if ('serviceWorker' in global.navigator) {
      global.navigator.serviceWorker.register('./sw.js').catch(function () {
        // ignore registration errors
      });
    }
  }

  if (typeof window !== 'undefined' && window.document) {
    window.addEventListener('DOMContentLoaded', initApp);
  }

  const exportsObject = { fmtDate: fmtDate, DEFAULT_LOCALE: DEFAULT_LOCALE };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObject;
  } else {
    global.App = Object.assign({}, global.App || {}, exportsObject);
  }
})(typeof window !== 'undefined' ? window : globalThis);
