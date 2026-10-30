(()=> {
  'use strict';
  // Prevent Chrome from restoring a mid-page scroll position after reload.
  try { if ('scrollRestoration' in history) history.scrollRestoration='manual'; } catch {}
  const root=document.documentElement;
  // The store has one visual identity, including for returning visitors.
  root.dataset.theme='light';
  root.style.colorScheme='only light';
  try { localStorage.removeItem('sao-bento.theme'); } catch {}
  const applyLight=()=>{
    document.querySelectorAll('[data-logo-light]').forEach(logo=>{
      logo.src=logo.dataset.logoLight;
    });
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.content='#f4efe4';
  };
  applyLight();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyLight,{once:true});
})();
