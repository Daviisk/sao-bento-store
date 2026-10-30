import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';import {seedProducts} from '../backend/commerce.js';
const tick=()=>new Promise(r=>setImmediate(r));
async function page(t){const dom=new JSDOM(readFileSync('frontend/index.html','utf8'),{url:'https://sao-bento-store.vercel.app/',runScripts:'outside-only'}),w=dom.window;const calls=[];w.requestAnimationFrame=callback=>callback();w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.AbortSignal.timeout=()=>undefined;w.fetch=async(path,options={})=>{calls.push({path,body:options.body&&JSON.parse(options.body)});return {ok:true,json:async()=>path==='/api/commerce/catalog'?{products:seedProducts,categories:['Dobrões','Bolsas','Acessórios'],ordersConfigured:true}:path==='/api/session'?{csrfToken:'csrf-test'}:path.includes('/reviews/')?{reviews:[]}:path==='/api/commerce/orders'?{orderId:'order-id',orderCode:'SB1001',trackingUrl:'https://sao-bento-store.vercel.app/acompanhar#order=order-id&token=secret'}:{message:'Solicitação registrada',id:'test'}};};w.eval(readFileSync('frontend/js/storefront.js','utf8'));w.eval(readFileSync('frontend/js/shop-features.js','utf8'));await tick();await tick();t.after(()=>w.close());return {w,d:w.document,calls};}
test('live products remain single after search and category changes',async t=>{const {w,d}=await page(t);assert.equal(d.querySelectorAll('#grid .piece').length,4);const search=d.querySelector('#search');search.value='inox';search.dispatchEvent(new w.Event('input'));await new Promise(r=>setTimeout(r,5));assert.equal(d.querySelectorAll('#grid .piece').length,4);assert.equal([...d.querySelectorAll('#grid .piece')].filter(e=>!e.hidden).length,1);});
test('personalized items keep chosen finish and engraving through cart and submitted order',async t=>{const {w,d,calls}=await page(t);d.querySelector('[data-commerce-detail="produto_01"]').click();await tick();const f=d.querySelector('#custom-product');f.elements.variant.value='gravado';f.elements.engravingNotes.value='Mestre';const art=new w.File(['imagem'],'frente.png',{type:'image/png'});w.createImageBitmap=async()=>({width:400,height:400,close(){}});w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/webp;base64,AAAA';Object.defineProperty(f.elements.front,'files',{configurable:true,value:[art]});f.elements.quantity.value='2';f.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.match(d.querySelector('#custom-cart-lines').textContent,/Gravado · Obs\.: Mestre/);const order=d.querySelector('#request-order');order.elements.name.value='Cliente Teste';order.elements.phone.value='(62) 99999-9999';order.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();await tick();const sent=calls.find(c=>c.path==='/api/commerce/orders').body;assert.equal(sent.items[0].variantId,'gravado');assert.equal(sent.items[0].quantity,2);assert.equal(sent.items[0].engravingNotes,'Mestre');assert.equal(sent.items[0].front.name,'frente.webp');assert.match(d.querySelector('#drawer').textContent,/SB1001 recebido/);});
test('Trio kit adds three independently selected coins and one bag',async t=>{const {w,d}=await page(t);w.SBFeatures.kits();const f=d.querySelector('#kit-form');assert.equal(d.querySelectorAll('#kit-coins > fieldset').length,3);f.elements.coin1.value='produto_02';f.elements.coin1.dispatchEvent(new w.Event('change',{bubbles:true}));for(let i=0;i<3;i++){f.elements['variant'+i].value='none';f.elements['variant'+i].dispatchEvent(new w.Event('change',{bubbles:true}));}f.elements.bag.value='produto_04';f.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(d.querySelectorAll('.order-cart-line').length,4);assert.match(d.querySelector('#custom-cart-lines').textContent,/Dobrão de Inox/);assert.match(d.querySelector('#custom-cart-lines').textContent,/Bolsa de Couro Trio/);assert.match(d.querySelector('.order-total').textContent,/400/);});
test('bag gallery switches photo and opens accessible zoom dialog',async t=>{const {d}=await page(t);d.querySelector('[data-commerce-detail="produto_03"]').click();await tick();assert.equal(d.querySelectorAll('[data-feature-photo]').length,5);d.querySelectorAll('[data-feature-photo]')[3].click();assert.match(d.querySelector('.detailImg').src,/aberta-prof/);d.querySelector('.zoom-trigger').click();assert(d.querySelector('.photo-zoom').open);});

test('bags skip all engraving steps and expose only quantity before adding to cart',async t=>{
 const {d}=await page(t);d.querySelector('[data-commerce-detail="produto_03"]').click();await tick();
 const form=d.querySelector('#custom-product');assert(form);assert.equal(form.querySelector('.product-steps'),null);assert.equal(form.querySelector('.engraving-uploads'),null);
 assert.equal(form.elements.variant,undefined);assert.equal(form.querySelector('[data-personal-step="3"]').hidden,false);
 form.elements.quantity.value='2';form.dispatchEvent(new d.defaultView.Event('submit',{cancelable:true}));await tick();
 assert.match(d.querySelector('#custom-cart-lines').textContent,/Bolsa de Couro/);
 assert.match(d.querySelector('#custom-cart-lines').textContent,/2/);
});

test('bags and the trio use a plain product flow with no engraving controls',async t=>{
 const {w,d}=await page(t);
 d.querySelector('[data-commerce-detail="produto_03"]').click();await tick();
 const form=d.querySelector('#custom-product');
 assert(form);assert.equal(form.querySelector('.engraving-uploads'),null);
 assert.equal(form.elements.variant,undefined);
 assert.equal(form.querySelector('[data-confirm-step]'),null);
 assert.equal(form.elements.quantity.closest('[hidden]'),null);
 form.elements.quantity.value='2';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert(d.querySelector('#request-order'));
 assert.match(d.querySelector('#custom-cart-lines').textContent,/Bolsa de Couro/);
 assert.equal(d.querySelectorAll('#custom-cart-lines [data-custom-variant]').length,0);
 await w.SBFeatures.detailByIndex(3);await tick();
 assert.equal(d.querySelector('#custom-product .engraving-uploads'),null);
 assert.equal(d.querySelector('#custom-product').elements.variant,undefined);
});
test('storefront category filters follow the catalog categories instead of hardcoded product names',async t=>{
 const {w,d}=await page(t);
 const names=[...d.querySelectorAll('#categories [data-category]')].map(b=>b.dataset.category);
 assert.deepEqual(names,['Todos','Dobrões','Bolsas','Acessórios']);
 d.querySelector('#categories [data-category="Bolsas"]').click();
 await tick();
 assert.equal([...d.querySelectorAll('#grid .piece')].filter(el=>!el.hidden).length,2);
});
test('dobrao without engraving skips file upload and is identified clearly in the cart',async t=>{
 const {w,d}=await page(t);
 d.querySelector('[data-commerce-detail="produto_01"]').click();await tick();
 const form=d.querySelector('#custom-product');form.elements.variant.value='none';form.elements.variant.dispatchEvent(new w.Event('change',{bubbles:true}));
 
 assert.equal(form.querySelector('.engraving-uploads').hidden,true);
 assert.equal(form.elements.quantity.closest('[hidden]'),null);
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.match(d.querySelector('#custom-cart-lines').textContent,/Sem gravação/);
});
