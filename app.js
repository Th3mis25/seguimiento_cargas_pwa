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
