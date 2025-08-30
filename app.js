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
  if(typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(v)){
    const [datePart, timePart] = v.split(' ');
    const [day, month, year] = datePart.split('/').map(n => parseInt(n, 10));
    const [hour, minute, second] = timePart.split(':').map(n => parseInt(n, 10));
    // Interpretamos la fecha como hora local, no UTC, para evitar desfases
    return new Date(year, month - 1, day, hour, minute, second);
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function fmtDate(v, locale = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'es-MX'){
  if(!v) return '';

  let d;

  if(typeof v === 'string' && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/.test(v)){
    const [datePart, timePart] = v.split(' ');
    const [day, month, year] = datePart.split('/').map(n => parseInt(n, 10));
    const [hour, minute, second] = timePart.split(':').map(n => parseInt(n, 10));
    // Crear fecha en zona local para mostrarla sin corrimientos de horario
    d = new Date(year, month - 1, day, hour, minute, second);
  }else{
    d = new Date(v);
  }

  if(isNaN(d)) return String(v);
  const dateStr = d.toLocaleDateString(locale, {
    year:'numeric', month:'2-digit', day:'2-digit'
  });
  const timeStr = d.toLocaleTimeString(locale, {
    hour:'2-digit', minute:'2-digit'
  });
  return `${dateStr} ${timeStr}`;
}
if(typeof module !== 'undefined' && module.exports){
  module.exports = { fmtDate };
}
function badgeForStatus(s){
  if(!s) return null;
  const n = String(s).toLowerCase();
  const span = document.createElement('span');
  span.classList.add('badge');
  let prefix = '';
  if(n.includes('delivered')){
    span.classList.add('green');
    prefix = '✔ ';
  }else if(n.includes('in transit')){
    span.classList.add('blue');
    prefix = '🚚 ';
  }else if(n.includes('cancel')){
    span.classList.add('red');
    prefix = '❌ ';
  }else if(['loading','qro yard','mty yard'].some(k=>n.includes(k))){
    span.classList.add('yellow');
    prefix = '📦 ';
  }
  span.textContent = prefix + s;
  return span;
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

async function updateDelivered(trip){
  try{
    const res = await fetch(API_BASE,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'delivered', trip })
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
    toast('Entrega registrada');
    return true;
  }catch(err){
    console.error('updateDelivered error', err);
    toast('Error al registrar entrega');
    return false;
  }
}

async function addRecord(data){
  try{
    const res = await fetch(API_BASE,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'add', ...data })
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
    toast('Error al agregar');
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

function renderRows(rows){
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

    addTextCell(tr, r[COL.trip]);
    addTextCell(tr, r[COL.caja]);
    addTextCell(tr, r[COL.referencia]);
    addTextCell(tr, r[COL.cliente]);
    addTextCell(tr, r[COL.destino]);

    const statusTd = document.createElement('td');
    const badge = badgeForStatus(r[COL.estatus]);
    if(badge) statusTd.appendChild(badge);
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

    const deliveredBtn = document.createElement('button');
    deliveredBtn.className = 'btn-mini';
    deliveredBtn.dataset.act = 'delivered';
    deliveredBtn.dataset.trip = r[COL.trip];
    deliveredBtn.textContent = '✅ Entregado';
    actionTd.appendChild(deliveredBtn);

    tr.appendChild(actionTd);
    tb.appendChild(tr);
  }
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
  renderRows(filtered);
}

async function main(){
  cache = await fetchData();
  renderRows(cache);

  $('#refreshBtn').addEventListener('click', async ()=>{
    cache = await fetchData(); renderRows(cache);
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
      citaCarga: form.citaCarga.value
    };
    const ok = await addRecord(data);
    if(ok){
      const row = {};
      row[COL.trip] = data.trip;
      row[COL.estatus] = data.estatus;
      row[COL.cliente] = data.cliente;
      row[COL.citaCarga] = data.citaCarga;
      cache.push(row);
      renderRows(cache);
      form.reset();
      $('#addModal').classList.remove('show');
    }
  });
  $('#dailyMenu').addEventListener('click', ()=>renderDaily(cache));

  $('#loadsTable').addEventListener('click', async ev=>{
    const btn = ev.target.closest('button[data-act]'); if(!btn) return;
    const act = btn.dataset.act; const trip = btn.dataset.trip;

    if(act==='copy'){
      const msg = buildCopyMsg(cache.find(r => String(r[COL.trip])===String(trip))||{});
      try{ await navigator.clipboard.writeText(msg); toast('Texto copiado'); }
      catch{
        const ta=document.createElement('textarea'); ta.value=msg; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); ta.remove(); toast('Texto copiado');
      }
    }
    if(act==='delivered'){
      const ok = await updateDelivered(trip);
      if(ok){
        const row = cache.find(r => String(r[COL.trip])===String(trip));
        if(row) row[COL.estatus] = 'Delivered';
        renderRows(cache);
      }
    }
  });

  if('serviceWorker' in navigator){
    try{ await navigator.serviceWorker.register('./sw.js'); }catch{}
  }
}
if (typeof document !== 'undefined') {
  main();
}
