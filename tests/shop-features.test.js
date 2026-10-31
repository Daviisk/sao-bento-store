import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';import {seedProducts} from '../backend/commerce.js';
const tick=()=>new Promise(r=>setImmediate(r));
async function page(t,catalogProducts=seedProducts){const dom=new JSDOM(readFileSync('frontend/index.html','utf8'),{url:'https://sao-bento-store.vercel.app/',runScripts:'outside-only'}),w=dom.window;const calls=[];w.requestAnimationFrame=callback=>callback();w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.AbortSignal.timeout=()=>undefined;w.fetch=async(path,options={})=>{calls.push({path,body:options.body&&JSON.parse(options.body)});if(String(path).includes('viacep.com.br'))return {ok:true,json:async()=>({logradouro:'Rua Teste',bairro:'Centro',localidade:'Goiânia',uf:'GO'})};return {ok:true,json:async()=>path==='/api/commerce/shipping/quote'?{options:[{name:'PAC',serviceCode:'PAC',priceCents:1500,days:3}]}:path==='/api/commerce/catalog'?{products:catalogProducts,categories:['Dobrões','Bolsas','Acessórios'],ordersConfigured:true}:path==='/api/session'?{csrfToken:'csrf-test'}:path.includes('/reviews/')?{reviews:[]}:path==='/api/commerce/orders'?{orderId:'order-id',orderCode:'SB1001',trackingUrl:'https://sao-bento-store.vercel.app/acompanhar#order=order-id&token=secret'}:String(path).endsWith('/pix')?{pix:{qr_code:'00020101021226580014br.gov.bcb.pix2560pix.example.test5204000053039865802BR5920SAO BENTO DOBROES6008GOIANIA62070503***6304ABCD'}}:{message:'Solicitação registrada',id:'test'}};};w.eval(readFileSync('frontend/js/storefront.js','utf8'));w.eval(readFileSync('frontend/js/shop-features.js','utf8'));await tick();await tick();t.after(()=>w.close());return {w,d:w.document,calls};}
test('live products remain single after search and category changes',async t=>{const {w,d}=await page(t);assert.equal(d.querySelectorAll('#grid .piece').length,4);const search=d.querySelector('#search');search.value='inox';search.dispatchEvent(new w.Event('input'));await new Promise(r=>setTimeout(r,5));assert.equal(d.querySelectorAll('#grid .piece').length,4);assert.equal([...d.querySelectorAll('#grid .piece')].filter(e=>!e.hidden).length,1);});
test('personalized items keep chosen finish and engraving through cart and submitted order',async t=>{const {w,d,calls}=await page(t);d.querySelector('[data-commerce-detail="produto_01"]').click();await tick();const f=d.querySelector('#custom-product');f.elements.variant.value='gravado';f.elements.engravingNotes.value='Mestre';const art=new w.File(['imagem'],'frente.png',{type:'image/png'});w.createImageBitmap=async()=>({width:400,height:400,close(){}});w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/webp;base64,AAAA';Object.defineProperty(f.elements.front,'files',{configurable:true,value:[art]});f.elements.quantity.value='2';f.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.match(d.querySelector('#custom-cart-lines').textContent,/Gravado · Obs\.: Mestre/);const order=d.querySelector('#request-order');order.elements.name.value='Cliente Teste';order.elements.email.value='cliente@example.com';order.elements.phone.value='(62) 99999-9999';assert.equal(order.elements.email.required,true);order.elements.cep.value='74000-000';order.elements.cep.dispatchEvent(new w.Event('input',{bubbles:true}));await tick();await tick();order.elements.street.value='Rua Teste';order.elements.district.value='Centro';order.elements.city.value='Goiânia / GO';order.elements.number.value='10';d.querySelector('#calculate-shipping').click();await tick();const delivery=d.querySelector('[name=shippingChoice]');assert(delivery,'A cotação de frete deve apresentar uma opção.');delivery.click();order.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(resolve=>setTimeout(resolve,60));const created=calls.find(c=>c.path==='/api/commerce/orders'&&c.body);assert(created,JSON.stringify({message:d.querySelector('#order-request-message')?.textContent,shipping:d.querySelector('#shipping-total')?.textContent,fields:{phone:order.elements.phone.value,cep:order.elements.cep.value,street:order.elements.street.value,district:order.elements.district.value,city:order.elements.city.value,number:order.elements.number.value},calls:calls.map(x=>x.path)}));const sent=created.body;assert.equal(sent.customer.email,'cliente@example.com');assert.equal(sent.items[0].variantId,'gravado');assert.equal(sent.items[0].quantity,2);assert.equal(sent.items[0].engravingNotes,'Mestre');assert.equal(sent.items[0].front.name,'frente.webp');assert.match(d.querySelector('#drawer').textContent,/Pix do pedido SB1001/);w.SBFeatures.myOrders();assert.match(d.querySelector('#drawer').textContent,/Pedido SB1001/);assert(d.querySelector('#drawer a[href*="/acompanhar#order=order-id&token=secret"]'));});
test('Trio kit adds three independently selected coins and one bag',async t=>{const {w,d}=await page(t);w.SBFeatures.kits();const f=d.querySelector('#kit-form');assert.equal(d.querySelectorAll('#kit-coins > fieldset').length,3);f.elements.coin1.value='produto_02';f.elements.coin1.dispatchEvent(new w.Event('change',{bubbles:true}));for(let i=0;i<3;i++){f.elements['variant'+i].value='none';f.elements['variant'+i].dispatchEvent(new w.Event('change',{bubbles:true}));}f.elements.bag.value='produto_04';f.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();assert.equal(d.querySelectorAll('.order-cart-line').length,4);assert.match(d.querySelector('#custom-cart-lines').textContent,/Dobrão de Inox/);assert.match(d.querySelector('#custom-cart-lines').textContent,/Bolsa de Couro Trio/);assert.match(d.querySelector('.order-total').textContent,/400/);});
test('bag gallery switches photo and opens accessible zoom dialog',async t=>{const {d}=await page(t);d.querySelector('[data-commerce-detail="produto_03"]').click();await tick();assert.equal(d.querySelectorAll('[data-feature-photo]').length,5);d.querySelectorAll('[data-feature-photo]')[3].click();assert.match(d.querySelector('.detailImg').src,/aberta-prof/);assert.equal(d.querySelector('#detail-photo-count').textContent,'4 / 5');d.querySelector('.zoom-trigger').click();assert(d.querySelector('.photo-zoom').open);});

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

test('products removed from the store are not rendered in the public product grid',async t=>{
 const catalog=seedProducts.map((product,index)=>index===0?{...product,enabled:false}:product);
 const {d}=await page(t,catalog);
 assert.equal(d.querySelector('[data-product-id="produto_01"]'),null);
 assert.equal(d.querySelectorAll('#grid .piece').length,3);
 assert.equal([...d.querySelectorAll('#grid .piece')].some(card=>card.textContent.includes('Indisponível')),false);
});

test('product detail displays material, verified dimensions and clear engraving instructions without reviews',async t=>{
 const {w,d,calls}=await page(t);
 d.querySelector('[data-commerce-detail="produto_01"]').click();await tick();
 assert.match(d.querySelector('.product-specs').textContent,/Bronze/);
 assert.match(d.querySelector('.engraving-info').textContent,/Gravado/);
 assert.match(d.querySelector('.engraving-info').textContent,/Lapidado/);
 assert.match(d.querySelector('.engraving-info').textContent,/Sem gravação/);
 assert.equal(d.querySelector('.reviews'),null);
 assert.equal(calls.some(call=>String(call.path).includes('/reviews/')),false);
 await w.SBFeatures.detailByIndex(1);await tick();
 assert.match(d.querySelector('.product-specs').textContent,/Aço inoxidável/);
 assert.match(d.querySelector('.product-specs').textContent,/Diâmetro: 38 mm/);
 assert.match(d.querySelector('.product-specs').textContent,/Espessura: 8 mm/);
});
test('checkout shows unit and line prices plus total with selected freight',async t=>{
 const {w,d}=await page(t);
 d.querySelector('[data-commerce-detail="produto_03"]').click();await tick();
 const form=d.querySelector('#custom-product');form.elements.quantity.value='2';
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.match(d.querySelector('#custom-cart-lines').textContent,/Unitário: R\$ 100,00/);
 assert.match(d.querySelector('#custom-cart-lines').textContent,/Total do item: R\$ 200,00/);
 assert.equal(d.querySelector('#products-subtotal').textContent,'R$ 200,00');
 assert.equal(d.querySelector('#shipping-price').textContent,'A calcular pelo CEP');
 assert.match(d.querySelector('#order-grand-total').textContent,/Aguardando escolha do frete/);
 const checkout=d.querySelector('#request-order');checkout.elements.cep.value='74000-000';
 d.querySelector('#calculate-shipping').click();await tick();
 const option=d.querySelector('[name=shippingChoice]');assert(option);option.click();
 assert.equal(d.querySelector('#shipping-price').textContent,'R$ 15,00');
 assert.equal(d.querySelector('#order-grand-total').textContent,'R$ 215,00');
 assert.match(d.querySelector('#shipping-total').textContent,/Total de produtos \+ frete: R\$ 215,00/);
});


test('sticky product purchase bar reaches the bottom without stacked blank spacing',()=>{
 const css=readFileSync('frontend/css/shop-features.css','utf8');
 const fix=css.slice(css.lastIndexOf('/* Keep the purchase bar sticky'));
 assert.match(fix,/#veil\.detailView \.drawer\s*\{[^}]*padding-bottom:0!important/s);
 assert.match(fix,/#veil\.detailView \.drawer>\.sheet-scroll-content\s*\{[^}]*padding-bottom:0!important/s);
 assert.match(fix,/#veil\.detailView \.drawer \.detail-purchase-actions\s*\{[^}]*position:sticky!important/s);
 assert.match(fix,/bottom:0!important/);
 assert.match(fix,/env\(safe-area-inset-bottom\)/);
});
