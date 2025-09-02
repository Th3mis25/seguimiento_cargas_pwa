/* =========================
   CONFIG
========================= */

// URL base del Web App de Apps Script.
// Se obtiene de `config.js` para poder configurarse al desplegar.
const API_BASE = (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE) || '';

// Cabeceras EXACTAS en el orden de tu hoja (las que quieres ver en la app)
const HEADERS = [
  'Trip','Caja','Referencia','Cliente','Destino','Estatus','Segmento',
  'TR-MX','TR-USA','Cita carga','Llegada carga','Cita entrega','Llegada entrega',
  'Comentarios','Docs','Tracking'
];

// Mapa de claves internas
const COL = {
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
    m = v.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/);
    if(m){
      // eliminar zona horaria para tratarlo como hora local
      const cleaned = v.replace(/(?:Z|[+-]\d{2}:?\d{2})$/,'');
      return new Date(cleaned);
    }
  }

  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function fmtDate(v, locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'es-MX'){
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
  module.exports = { fmtDate };
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
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function fillStatusSelect(sel, current='', allowEmpty=false){
  if(!sel) return;
  sel.innerHTML = (allowEmpty?'<option value=""></option>':'') +
    STATUS_OPTIONS.map(s=>`<option value="${s}">${s}</option>`).join('');
  if(current) sel.value = current;
}
function toast(msg){
  const el = $('#toast'); el.textContent = msg;
  el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1800);
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
  tb.innerHTML = `<tr><td colspan="17" style="padding:16px">Cargando…</td></tr>`;

  try{
    const res  = await fetch(API_BASE,{ cache:'no-store' });
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
    tb.innerHTML = `<tr><td colspan="17" style="padding:16px;color:#ffb4b4">
      No se pudieron cargar los datos. ${escapeHtml(err.message)}. Intenta recargar.
    </td></tr>`;
    return [];
  }
}

async function addRecord(data){
  try{
    const body = new URLSearchParams({ action:'add', ...data });
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
    if(!res.ok || json.error){
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    toast('Registro agregado');
    return true;
  }catch(err){
    console.error('addRecord error', err);
    toast('Error al agregar: ' + err.message);
    return false;
  }
}

async function updateRecord(data){
  try{
    const body = new URLSearchParams({ action:'update', ...data });
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
    if(!res.ok || json.error){
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    toast('Registro actualizado');
    return true;
  }catch(err){
    console.error('updateRecord error', err);
    toast('Error al actualizar: ' + err.message);
    return false;
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
  form.caja.value = row[COL.caja] || '';
  form.referencia.value = row[COL.referencia] || '';
  form.cliente.value = row[COL.cliente] || '';
  form.destino.value = row[COL.destino] || '';
  fillStatusSelect(form.estatus, row[COL.estatus], true);
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

function renderRows(rows, hiddenCols=[]){
  setColumnVisibility([8,11,12,14], true); // mostrar por defecto

  const statusFilter = $('#statusFilter').value;
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
    if(q){
      const hay = [
        COL.trip, COL.caja, COL.referencia, COL.cliente, COL.destino,
        COL.estatus, COL.segmento, COL.trmx, COL.trusa, COL.tracking
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
    td.colSpan = 17;
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
        renderRows(cache);
      }else{
        ev.target.value = r[COL.estatus] || '';
      }
    });
    statusTd.appendChild(sel);
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
  $('#statusFilter').value = '';
  $('#searchBox').value = '';
  $('#startDate').value = '';
  $('#endDate').value = '';
  renderRows(rows);
}

function renderDaily(rows){
  const today = new Date();
  today.setUTCHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);
  const allowed = ['in transit mx','live','drop','loading','mty yard','qro yard'];
  const filtered = rows.filter(r=>{
    const status = String(r[COL.estatus]||'').trim().toLowerCase();
    if(!allowed.includes(status)) return false;
    const cita = parseDate(r[COL.citaCarga]);
    if(!cita) return false;
    return cita >= today && cita < tomorrow;
  });
  $('#statusFilter').value = '';
  $('#searchBox').value = '';
  $('#startDate').value = '';
  $('#endDate').value = '';
  renderRows(filtered, [8,11,12,14]);
}

async function main(){
  cache = await fetchData();
  populateStatusFilter(cache);
  renderRows(cache);

  fillStatusSelect($('#addForm select[name="estatus"]'), '', true);
  fillStatusSelect($('#editForm select[name="estatus"]'), '', true);

  $('#refreshBtn').addEventListener('click', async ()=>{
    cache = await fetchData();
    populateStatusFilter(cache);
    renderRows(cache);
  });
  $('#statusFilter').addEventListener('change', ()=>renderRows(cache));
  $('#searchBox').addEventListener('input', ()=>renderRows(cache));
  $('#startDate').addEventListener('change', ()=>renderRows(cache));
  $('#endDate').addEventListener('change', ()=>renderRows(cache));

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
      estatus: form.estatus.value.trim(),
      cliente: form.cliente.value.trim(),
      citaCarga: toGASDate(form.citaCarga.value)
    };
    const ok = await addRecord(data);
    if(ok){
      const row = {};
      row[COL.trip] = data.trip;
      row[COL.estatus] = data.estatus;
      row[COL.cliente] = data.cliente;
      row[COL.citaCarga] = data.citaCarga;
      cache.push(row);
      populateStatusFilter(cache);
      renderRows(cache);
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
    const data = {
      originalTrip: form.originalTrip.value,
      trip: form.trip.value.trim(),
      caja: form.caja.value.trim(),
      referencia: form.referencia.value.trim(),
      cliente: form.cliente.value.trim(),
      destino: form.destino.value.trim(),
      estatus: form.estatus.value.trim(),
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
    if(ok){
      const row = cache.find(r => String(r[COL.trip])===String(form.originalTrip.value));
      if(row){
        row[COL.trip] = data.trip;
        row[COL.caja] = data.caja;
        row[COL.referencia] = data.referencia;
        row[COL.cliente] = data.cliente;
        row[COL.destino] = data.destino;
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
      populateStatusFilter(cache);
      renderRows(cache);
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

  if('serviceWorker' in navigator){
    try{ await navigator.serviceWorker.register('./sw.js'); }catch{}
  }
}
if (typeof document !== 'undefined') {
  main();
}
