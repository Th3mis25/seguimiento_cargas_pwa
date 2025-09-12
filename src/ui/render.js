import { HEADERS, COL } from '../api.js';
import { fmtDate, parseDate } from '../utils/date.js';

export const STATUS_OPTIONS = [
  'Live','Drop','Cancelled','Loading','Qro yard','Mty yard',
  'In transit MX','Nuevo Laredo yard','In transit USA','At destination','Delivered'
];

export function fillStatusSelect(sel, current='', allowEmpty=false){
  if(!sel) return;
  sel.innerHTML = (allowEmpty?'<option value=""></option>':'') +
    STATUS_OPTIONS.map(s=>`<option value="${s}">${s}</option>`).join('');
  if(current) sel.value = current;
}

export function toast(msg, type=''){
  const el = document.querySelector('#toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.remove('success','error');
  if(type){
    el.classList.add(type);
  }
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),1800);
}

export function renderRows(rows){
  const tb = document.querySelector('#loadsTable tbody');
  if(!tb) return;
  tb.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    HEADERS.forEach(h => {
      const td = document.createElement('td');
      let val = r[h] || '';
      if([COL.citaCarga, COL.llegadaCarga, COL.citaEntrega, COL.llegadaEntrega].includes(h)){
        val = fmtDate(val);
      }
      td.textContent = val;
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}
