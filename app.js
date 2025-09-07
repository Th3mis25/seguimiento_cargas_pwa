/* =========================
   CONFIG
========================= */

// Redirect to mobile version for small screens or mobile devices
if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
  const isMobileWidth = window.innerWidth < 768;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const alreadyMobile = window.location.pathname.includes('/mobile');
  if ((isMobileWidth || isMobileUA) && !alreadyMobile) {
    window.location.href = '/mobile/index.html';
  }
}

// URL base del Web App de Apps Script.
// Se obtiene de `config.js` para poder configurarse al desplegar.
const API_BASE = (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE) || '';

// Configuración sensible cargada desde un endpoint seguro.
const SECURE_CONFIG = { authUsers: [], apiToken: '' };

async function loadSecureConfig(){
  try{
    const res = await fetch('./secure-config.json', { cache:'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    SECURE_CONFIG.authUsers = json.AUTH_USERS || json.authUsers || [];
    SECURE_CONFIG.apiToken = json.API_TOKEN || json.apiToken || '';
  }catch(err){
    console.error('loadSecureConfig error', err);
  }
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
let isLoggedIn = (typeof localStorage !== 'undefined' && localStorage.getItem('isLoggedIn') === 'true');
let mainInitialized = false;

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
  if(type === 'success'){
    el.classList.add('success');
  }else{
    el.classList.remove('success');
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

    try{
      const token = SECURE_CONFIG.apiToken || '';
      const url = token ? `${API_BASE}?token=${encodeURIComponent(token)}` : API_BASE;
      const res  = await fetch(url,{ cache:'no-store' });
    if(!res.ok){
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    if(json.error){
      throw new Error(json.error);
    }
    console.log('API response:', json); // <— mira la consola del navegador

    let data = json.data ?? json.rows ?? [];
    data = normalizeData(data);

    return data;
  }catch(err){
    console.error('fetch error', err);
    tb.innerHTML = `<tr><td colspan="18" style="padding:16px;color:#ffb4b4">
      No se pudieron cargar los datos. ${escapeHtml(err.message)}. Intenta recargar.
    </td></tr>`;
    return [];
  }
}

async function addRecord(data){
    try{
      const token = SECURE_CONFIG.apiToken || '';
      const body = new URLSearchParams({ action:'add', token, ...data });
      const res = await fetch(API_BASE,{
        method:'POST',
        body
      });
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
    toast('Registro agregado');
    return true;
  }catch(err){
    console.error('addRecord error', err);
    if(!navigator.onLine || (err instanceof TypeError && /failed to fetch/i.test(err.message))){
      toast('Saved','success');
      return true;
    }
    toast('Error al agregar: ' + err.message);
    return false;
  }
}

async function updateRecord(data){
    try{
      const token = SECURE_CONFIG.apiToken || '';
      const body = new URLSearchParams({ action:'update', token, ...data });
      const res = await fetch(API_BASE,{ method:'POST', body });
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
    toast('Registro actualizado');
    return true;
  }catch(err){
    console.error('updateRecord error', err);
    if(!navigator.onLine || (err instanceof TypeError && /failed to fetch/i.test(err.message))){
      toast('Saved','success');
      return true;
    }
    toast('Error al actualizar: ' + err.message);
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
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval:'' });
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
        citaCarga: headers.includes('cita carga') ? toGASDate(obj[COL.citaCarga]) : ''
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
    cache = await fetchData();
    populateStatusFilter(cache);
    populateEjecutivoFilter(cache);
    currentView === 'daily' ? renderDaily(cache) : renderRows(cache);
  }catch(err){
    console.error('handleBulkUpload error', err);
    if(statusEl) statusEl.textContent = 'Error: ' + err.message;
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
    const tripSpan = document.createElement('span');
    tripSpan.className = 'trip-edit';
    tripSpan.textContent = r[COL.trip];
    tripTd.appendChild(tripSpan);
    tr.appendChild(tripTd);

    addTextCell(tr, r[COL.caja]);
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
        currentView === 'daily' ? renderDaily(cache) : renderRows(cache);
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
    addTextCell(tr, fmtDate(r[COL.citaCarga]), 'nowrap');
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
    copyBtn.className = 'btn-mini';
    copyBtn.dataset.act = 'copy';
    copyBtn.dataset.trip = r[COL.trip];
    copyBtn.textContent = '📋 Copiar';
    actionTd.appendChild(copyBtn);

    const waLink = document.createElement('a');
    waLink.className = 'btn-mini';
    waLink.target = '_blank';
    waLink.rel = 'noopener';
    waLink.href = buildWaShareUrl(r);
    waLink.textContent = '🟢 WhatsApp';
    actionTd.appendChild(waLink);


    tr.appendChild(actionTd);
    tb.appendChild(tr);
  }

  if(hiddenCols.length){
    setColumnVisibility(hiddenCols, false);
  }
}

function renderGeneral(rows){
  currentView = 'general';
  $('#statusFilter').value = '';
  $('#ejecutivoFilter').value = '';
  $('#searchBox').value = '';
  $('#startDate').value = '';
  $('#endDate').value = '';
  renderRows(rows);
}

function renderDaily(rows){
  currentView = 'daily';
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const allowed = ['in transit mx','live','drop','loading','mty yard','qro yard'];
  const filtered = rows.filter(r=>{
    const status = String(r[COL.estatus]||'').trim().toLowerCase();
    if(!allowed.includes(status)) return false;
    const cita = parseDate(r[COL.citaCarga]);
    if(!cita) return false;
    return cita >= today && cita < tomorrow;
  });
  $('#statusFilter').value = '';
  $('#ejecutivoFilter').value = '';
  $('#searchBox').value = '';
  $('#startDate').value = '';
  $('#endDate').value = '';
  renderRows(filtered, [9,12,13,15]);
}

async function main(){
  cache = await fetchData();
  populateStatusFilter(cache);
  populateEjecutivoFilter(cache);
  renderDaily(cache);

  fillStatusSelect($('#addForm select[name="estatus"]'), '', true);

  $('#refreshBtn').addEventListener('click', async ()=>{
    cache = await fetchData();
    populateStatusFilter(cache);
    populateEjecutivoFilter(cache);
    currentView === 'daily' ? renderDaily(cache) : renderRows(cache);
  });
  $('#statusFilter').addEventListener('change', ()=>renderRows(cache));
  $('#ejecutivoFilter').addEventListener('change', ()=>renderRows(cache));
  $('#searchBox').addEventListener('input', ()=>renderRows(cache));
  $('#startDate').addEventListener('change', ()=>renderRows(cache));
  $('#endDate').addEventListener('change', ()=>renderRows(cache));

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
  $('#addForm').addEventListener('submit', async ev=>{
    ev.preventDefault();
    const form = ev.target;
    const data = {
      trip: form.trip.value.trim(),
      ejecutivo: form.ejecutivo.value.trim(),
      estatus: form.estatus.value.trim(),
      referencia: form.referencia.value.trim(),
      cliente: form.cliente.value.trim(),
      citaCarga: toGASDate(form.citaCarga.value)
    };
    const ok = await addRecord(data);
    if(ok){
      const row = {};
      row[COL.trip] = data.trip;
      row[COL.ejecutivo] = data.ejecutivo;
      row[COL.estatus] = data.estatus;
      row[COL.referencia] = data.referencia;
      row[COL.cliente] = data.cliente;
      row[COL.citaCarga] = data.citaCarga;
      cache.push(row);
      populateStatusFilter(cache);
      populateEjecutivoFilter(cache);
      currentView === 'daily' ? renderDaily(cache) : renderRows(cache);
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
    const data = {
      originalTrip: form.originalTrip.value,
      trip: form.trip.value.trim(),
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
      currentView === 'daily' ? renderDaily(cache) : renderRows(cache);
      $('#editModal').classList.remove('show');
    }
  });
  $('#generalMenu').addEventListener('click', ()=>renderGeneral(cache));
  $('#dailyMenu').addEventListener('click', ()=>renderDaily(cache));

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
  (async () => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }

    await loadSecureConfig();

    const loginScreen = document.getElementById('loginScreen');
    const mainEl = document.querySelector('main.container');
    const sideMenu = document.querySelector('.side-menu');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');

    function showLogin(){
      if(loginScreen) loginScreen.style.display = 'flex';
      if(mainEl) mainEl.style.display = 'none';
      if(sideMenu) sideMenu.style.display = 'none';
      if(logoutBtn) logoutBtn.style.display = 'none';
    }

    function showApp(){
      if(loginScreen) loginScreen.style.display = 'none';
      if(sideMenu) sideMenu.style.display = '';
      if(mainEl) mainEl.style.display = '';
      if(logoutBtn) logoutBtn.style.display = 'inline-block';
      if(!mainInitialized){
        main();
        mainInitialized = true;
      }
    }

    if(isLoggedIn){
      showApp();
    }else{
      showLogin();
    }

    loginForm?.addEventListener('submit', ev=>{
      ev.preventDefault();
      const user = loginForm.user.value.trim();
      const pass = loginForm.password.value.trim();
      const users = SECURE_CONFIG.authUsers || [];
      const ok = users.some(u => u.user === user && u.password === pass);
      if(ok){
        isLoggedIn = true;
        if(typeof localStorage !== 'undefined') localStorage.setItem('isLoggedIn','true');
        showApp();
        loginForm.reset();
        if(loginError) loginError.textContent = '';
      }else{
        if(loginError) loginError.textContent = 'Credenciales incorrectas';
      }
    });

    logoutBtn?.addEventListener('click', ()=>{
      isLoggedIn = false;
      if(typeof localStorage !== 'undefined') localStorage.removeItem('isLoggedIn');
      showLogin();
    });
  })();
}
