/*
  Funciones específicas para la versión móvil de la aplicación.
  Este archivo mantiene separado el código de escritorio y evita
  dependencias cruzadas con la versión principal.
*/

(function(){
  function initMobileMenu(){
    const menu = document.querySelector('.mobile-menu');
    const toggle = document.getElementById('menuToggle');
    if(!menu || !toggle) return;
    toggle.addEventListener('click', ()=> menu.classList.toggle('open'));
  }

  function isMobile(){
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  }

  if(typeof document !== 'undefined'){
    initMobileMenu();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  }

  window.MobileApp = {
    initMobileMenu,
    isMobile
  };
})();
