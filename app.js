/* =========================
   CONFIG
========================= */

// PON AQUÍ tu URL del Web App de Apps Script
const API_BASE = 'https://script.google.com/macros/s/AKfycbxHX-S1fBH4Ty1ySDtPsJoVbYxtuUldyenmXEINL9_0oj58tE8m-9a2t6XpNKwtmjjd/exec';

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

function fmtDate(v){
  if(!v) return '';
  const d = new Date(v);
  if(isNaN(d)) return String(v);
  return d.toLocaleString('en-US',{
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hour12:true
  }).replace(',', '');
}
function badgeForStatus(s){
  if(!s) return '';
  const n = String(s).toLowerCase();
  if(n.includes('delivered'))   return `<span class="badge green">✔ ${s}</span>`;
  if(n.includes('in transit'))  return `<span class="badge blue">🚚 ${s}</span>`;
  if(n.includes('cancel'))      return `<span class="badge red">❌ ${s}</span>`;
  if(['loading','qro yard','mty yard'].some(k=>n.includes(k)))
                               return `<span class="badge yellow">📦 ${s}</span>`;
  return `<span class="badge">${s}</span>`;
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
  if(raw.length && !Array.isArray(raw[0])) return raw;

  // Caso 2: son arrays -> los mapeamos con HEADERS
  return raw.map(arrayRowToObj);
}

async function fetchData(){
  const tb = $('#loadsTable tbody');
  tb.innerHTML = `<tr><td colspan="17" style="padding:16px">Cargando…</td></tr>`;

  try{
    const res  = await fetch(API_BASE,{ cache:'no-store' });
    const json = await res.json();
    console.log('API response:', json); // <— mira la consola del navegador

    let data = json.data ?? json.rows ?? [];
    data = normalizeData(data);

    return data;
  }catch(err){
    console.error('fetch error', err);
    tb.innerHTML = `<tr><td colspan="17" style="padding:16px;color:#ffb4b4">
      Error al cargar datos: ${err.message}
    </td></tr>`;
    return [];
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
  const tb = $('#loadsTable tbody');
  tb.innerHTML = '';

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
    return true;
  });

  if(!filtered.length){
    tb.innerHTML = `<tr><td colspan="17" style="padding:16px">Sin resultados.</td></tr>`;
    return;
  }

  for(const r of filtered){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r[COL.trip]||''}</td>
      <td>${r[COL.caja]||''}</td>
      <td>${r[COL.referencia]||''}</td>
      <td>${r[COL.cliente]||''}</td>
      <td>${r[COL.destino]||''}</td>
      <td>${badgeForStatus(r[COL.estatus])}</td>
      <td>${r[COL.segmento]||''}</td>
      <td>${r[COL.trmx]||''}</td>
      <td>${r[COL.trusa]||''}</td>
      <td class="nowrap">${fmtDate(r[COL.citaCarga])}</td>
      <td class="nowrap">${fmtDate(r[COL.llegadaCarga])}</td>
      <td class="nowrap">${fmtDate(r[COL.citaEntrega])}</td>
      <td class="nowrap">${fmtDate(r[COL.llegadaEntrega])}</td>
      <td>${r[COL.comentarios]||''}</td>
      <td>${r[COL.docs]||''}</td>
      <td>${r[COL.tracking]?`<a class="link" href="${r[COL.tracking]}" target="_blank" rel="noopener">Abrir</a>`:''}</td>
      <td class="action-bar">
        <button class="btn-mini" data-act="copy" data-trip="${r[COL.trip]}">📋 Copiar</button>
        <a class="btn-mini" target="_blank" rel="noopener" href="${buildWaShareUrl(r)}">🟢 WhatsApp</a>
        <button class="btn-mini" data-act="delivered" data-trip="${r[COL.trip]}">✅ Entregado</button>
      </td>
    `;
    tb.appendChild(tr);
  }
}

async function main(){
  let cache = await fetchData();
  renderRows(cache);

  $('#refreshBtn').addEventListener('click', async ()=>{
    cache = await fetchData(); renderRows(cache);
  });
  $('#statusFilter').addEventListener('change', ()=>renderRows(cache));
  $('#searchBox').addEventListener('input', ()=>renderRows(cache));

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
      await updateDelivered(trip); cache = await fetchData(); renderRows(cache);
    }
  });

  if('serviceWorker' in navigator){
    try{ await navigator.serviceWorker.register('./sw.js'); }catch{}
  }
}
main();
