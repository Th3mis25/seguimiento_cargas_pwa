const API_BASE = (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE) || '';
const SECURE_CONFIG = { authUsers: [], apiToken: '' };

export { API_BASE, SECURE_CONFIG };

export async function loadSecureConfig(){
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

export const HEADERS = [
  'Ejecutivo','Trip','Caja','Referencia','Cliente','Destino','Estatus','Segmento',
  'TR-MX','TR-USA','Cita carga','Llegada carga','Cita entrega','Llegada entrega',
  'Comentarios','Docs','Tracking'
];

export const COL = {
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

function arrayRowToObj(row){
  const obj = {};
  for(let i=0;i<HEADERS.length;i++){
    obj[HEADERS[i]] = row[i] ?? '';
  }
  return obj;
}

function normalizeData(raw){
  if(!Array.isArray(raw)) return [];

  if(raw.length && !Array.isArray(raw[0])){
    return raw.map(row => {
      const obj = {};
      for(const h of HEADERS){
        const key = Object.keys(row).find(k => k.trim().toLowerCase() === h.toLowerCase());
        obj[h] = key ? row[key] : '';
      }
      return obj;
    });
  }

  return raw.map(arrayRowToObj);
}

export async function fetchData(){
  const tb = document.querySelector('#loadsTable tbody');
  if(tb) tb.innerHTML = `<tr><td colspan="18" style="padding:16px">Cargando…</td></tr>`;

  try{
    const token = SECURE_CONFIG.apiToken || '';
    const url = token ? `${API_BASE}?token=${encodeURIComponent(token)}` : API_BASE;
    const res  = await fetch(url,{ cache:'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if(json.error) throw new Error(json.error);
    let data = json.data ?? json.rows ?? [];
    data = normalizeData(data);
    return data;
  }catch(err){
    console.error('fetch error', err);
    if(tb) tb.innerHTML = `<tr><td colspan="18" style="padding:16px;color:#ffb4b4">No se pudieron cargar los datos. ${err.message}. Intenta recargar.</td></tr>`;
    return [];
  }
}

export async function addRecord(data){
  try{
    const token = SECURE_CONFIG.apiToken || '';
    const body = new URLSearchParams({ action:'add', token, ...data });
    const res = await fetch(API_BASE,{ method:'POST', body });
    let json;
    const ct = res.headers.get('content-type') || '';
    if(!ct.includes('application/json')) throw new Error('Missing application/json header');
    json = await res.json();
    if(!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
    return true;
  }catch(err){
    console.error('addRecord error', err);
    return false;
  }
}

export async function updateRecord(data){
  try{
    const token = SECURE_CONFIG.apiToken || '';
    const body = new URLSearchParams({ action:'update', token, ...data });
    const res = await fetch(API_BASE,{ method:'POST', body });
    let json;
    const ct = res.headers.get('content-type') || '';
    if(!ct.includes('application/json')) throw new Error('Missing application/json header');
    json = await res.json();
    if(!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
    return true;
  }catch(err){
    console.error('updateRecord error', err);
    return false;
  }
}
