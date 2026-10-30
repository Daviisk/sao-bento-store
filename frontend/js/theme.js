(()=> {
  'use strict';
  // Reloads should return to the storefront top, not restore an old mid-page position.
  const navigation=performance.getEntriesByType?.('navigation')?.[0];
  const resetAfterReload=navigation?.type==='reload'&&!location.hash;
  try { if ('scrollRestoration' in history) history.scrollRestoration='manual'; } catch {}
  const forceTop=()=>{
    if(!resetAfterReload)return;
    window.scrollTo({top:0,left:0,behavior:'instant'});
    document.documentElement.scrollTop=0;
    if(document.body)document.body.scrollTop=0;
  };
  forceTop();
  if(resetAfterReload){
    window.addEventListener('pageshow',()=>{
      forceTop();
      requestAnimationFrame(()=>{forceTop();requestAnimationFrame(forceTop);});
    },{once:true});
    document.addEventListener('DOMContentLoaded',()=>{
      forceTop();
      requestAnimationFrame(()=>{forceTop();requestAnimationFrame(forceTop);});
    },{once:true});
  }
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
