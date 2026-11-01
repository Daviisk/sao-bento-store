import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';

const model=readFileSync('frontend/js/cart-model.js','utf8');
const html=readFileSync('frontend/index.html','utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

for(const status of ['pending','paid'])test(`success screen takes ${status} from backend, never URL/localStorage`,async t=>{
 const id=randomUUID();
 const dom=new JSDOM(readFileSync('frontend/sucesso.html','utf8'),{url:`https://loja.example/sucesso?orderId=${id}&status=approved&paymentStatus=paid`,runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const w=dom.window;w.eval(model);
 w.localStorage.setItem('jewelry.cart.v1',JSON.stringify({items:[{productId:'produto_01',quantity:1}],paymentStatus:'paid'}));
 w.sessionStorage.setItem('jewelry.pendingOrder',id);
 w.fetch=async()=>({ok:true,json:async()=>({orderId:id,status,total:19990,items:[{productId:'produto_01',name:'Peça',quantity:1,subtotal:19990}]})});
 w.eval(readFileSync('frontend/js/order-status.js','utf8'));await tick();
 assert.equal(w.document.querySelector('#order-status').textContent,status==='paid'?'Pagamento confirmado':'Aguardando pagamento');
 assert.equal(JSON.parse(w.localStorage.getItem('jewelry.cart.v1')).items.length,status==='paid'?0:1);
});

test('success page opened without an order cannot report payment',async t=>{
 const dom=new JSDOM(readFileSync('frontend/sucesso.html','utf8'),{url:'https://loja.example/sucesso?status=approved',runScripts:'outside-only'});
 t.after(()=>dom.window.close());dom.window.eval(readFileSync('frontend/js/order-status.js','utf8'));await tick();
 assert.equal(dom.window.document.querySelector('#order-status').textContent,'Pagamento não confirmado');
});

test('tracking moves query credentials to fragment and sends bearer header',async t=>{
 const id=randomUUID(),token='test-private-token',calls=[];
 const dom=new JSDOM(readFileSync('frontend/sucesso.html','utf8'),{url:`https://loja.example/sucesso?orderId=${id}&token=${token}`,runScripts:'outside-only'});
 t.after(()=>dom.window.close());const w=dom.window;
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({orderId:id,status:'paid',fulfillmentStatus:'delivered',items:[],address:{city:'Goiânia',state:'GO'}})};};
 w.eval(readFileSync('frontend/js/order-status.js','utf8'));await tick();
 assert.equal(new URL(w.location.href).searchParams.has('token'),false);assert.ok(w.location.hash.includes(token));
 assert.equal(calls[0].options.headers.Authorization,'Bearer '+token);assert.equal(calls[0].url.includes(token),false);
 assert.match(w.document.querySelector('#order-address').textContent,/endereço completo protegido/);
});

test('payment summaries render customer markup as text',async t=>{
 const dom=new JSDOM(html,{url:'https://loja.example',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;
 w.fetch=async()=>({ok:true,json:async()=>({})});w.eval(model);
 const payload='<img src=x onerror="alert(1)">',prepared={customer:{name:payload,email:payload,phone:payload},items:[{name:payload,quantity:1}],shipping:{name:payload},total:100};
 let card=readFileSync('frontend/js/card-payment.js','utf8');card=card.replace(/\}\)\(\);\s*$/,'window.renderCardForTest=p=>{context={prepared:p};showPanel();};})();');w.eval(card);w.renderCardForTest(prepared);
 assert.equal(w.document.querySelectorAll('#cart-review img').length,0);assert.ok(w.document.querySelector('#cart-review').textContent.includes(payload));
 let pix=readFileSync('frontend/js/pix-payment.js','utf8');pix=pix.replace(/\}\)\(\);\s*$/,'window.renderPixForTest=p=>showPixForm({},p);})();');w.eval(pix);w.renderPixForTest(prepared);
 assert.equal(w.document.querySelectorAll('#cart-review img').length,0);assert.ok(w.document.querySelector('#cart-review').textContent.includes(payload));
});
