export let isLoggedIn = false;

export function initAuth(onLogin){
  const loginScreen = document.getElementById('loginScreen');
  const mainEl = document.querySelector('main.container');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginForm = document.getElementById('loginForm');

  function showLogin(){
    if(loginScreen) loginScreen.style.display = 'flex';
    if(mainEl) mainEl.style.display = 'none';
    if(logoutBtn) logoutBtn.style.display = 'none';
  }

  function showApp(){
    if(loginScreen) loginScreen.style.display = 'none';
    if(mainEl) mainEl.style.display = '';
    if(logoutBtn) logoutBtn.style.display = 'inline-block';
    if(onLogin) onLogin();
  }

  loginForm?.addEventListener('submit', ev => {
    ev.preventDefault();
    isLoggedIn = true;
    localStorage.setItem('isLoggedIn','true');
    showApp();
  });

  logoutBtn?.addEventListener('click', () => {
    isLoggedIn = false;
    localStorage.removeItem('isLoggedIn');
    showLogin();
  });

  if(localStorage.getItem('isLoggedIn') === 'true'){
    isLoggedIn = true;
    showApp();
  }else{
    showLogin();
  }
}
