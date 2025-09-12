import { loadSecureConfig, fetchData } from './src/api.js';
import { renderRows, fillStatusSelect } from './src/ui/render.js';
import { initAuth } from './src/auth.js';

async function main(){
  await loadSecureConfig();
  const data = await fetchData();
  renderRows(data);
  const statusSel = document.querySelector('#addForm select[name="estatus"]');
  fillStatusSelect(statusSel, '', true);
}

if (typeof document !== 'undefined'){
  initAuth(main);
}
