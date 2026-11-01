import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';

const admin=readFileSync('frontend/admin/commerce-admin.js','utf8');
const html=`<!doctype html><html><body>
<div id="commerce-admin-view" hidden></div><div id="orders-view"></div><div id="customers-view"></div>
<p id="panel-message"></p><h1 id="page-title"></h1><button id="refresh"></button>
<nav><button class="nav" data-view="orders"></button><button class="nav" data-view="customers"></button><button class="nav" data-view="catalog"></button></nav>
</body></html>`;

function setup(initialProducts=[]){
 const dom=new JSDOM(html,{url:'https://store.test/admin',runScripts:'outside-only'});
 const {window}=dom;
 window.AbortSignal=AbortSignal;
 window.confirm=()=>true;
 window.crypto.randomUUID=()=> '12345678-1234-4234-8234-123456789012';
 let products=structuredClone(initialProducts),categories=['Dobrões','Bolsas'],savedPayload=null;
 window.fetch=async(path,options={})=>{
  const url=String(path),method=options.method||'GET';
  if(url==='/api/admin/catalog'&&method==='GET')return response({products,categories});
  if(url==='/api/admin/categories/order'&&method==='PATCH'){categories=JSON.parse(options.body).categoryNames;return response({categories});}
  if(url==='/api/admin/media'&&method==='POST')return response({url:'/api/commerce/media/12345678-1234-4234-8234-123456789012'});
  if(url.startsWith('/api/admin/catalog')&&['POST','PATCH'].includes(method)){
   savedPayload=JSON.parse(options.body);
   if(method==='POST')products=[...products,savedPayload];
   else products=products.map(p=>p.productId===savedPayload.productId?savedPayload:p);
   return response(savedPayload);
  }
  throw new Error('Unexpected request: '+method+' '+url);
 };
 function response(data){return {ok:true,status:200,json:async()=>data};}
 window.eval(admin);
 return {window,dom,getSaved:()=>savedPayload};
}
const wait=()=>new Promise(resolve=>setTimeout(resolve,30));
function openCatalog(window){window.document.querySelector('[data-view="catalog"]').click();}

test('new product editor opens and saves custom areas such as Cor',async()=>{
 const {window,getSaved}=setup();
 openCatalog(window);await wait();
 window.document.querySelector('#new-product').click();
 assert.ok(window.document.querySelector('#product-edit'),'new product form should open');
 window.document.querySelector('#add-custom-area').click();
 const area=window.document.querySelector('.custom-area-item');
 area.querySelector('[name="areaTitle"]').value='Cor';
 area.querySelector('[name="areaOptions"]').value='Azul\nVermelho';
 const form=window.document.querySelector('#product-edit');
 form.elements.name.value='Dobrão de teste';
 form.elements.category.value='Dobrões';
 form.elements.price.value='100';
 const file=new window.File([new Uint8Array([1,2,3])],'produto.png',{type:'image/png'});
 Object.defineProperty(form.elements.upload,'files',{configurable:true,value:[file]});
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 await wait();await wait();
 const saved=getSaved();
 assert.ok(saved,'new product should be sent to the API');
 assert.equal(saved.name,'Dobrão de teste');
 assert.deepEqual(saved.optionGroups,[{id:'area_1',name:'Cor',options:['Azul','Vermelho']}]);
 assert.equal(saved.image,'/api/commerce/media/12345678-1234-4234-8234-123456789012');
 assert.equal(window.document.querySelector('#panel-message').textContent,'Produto cadastrado.');
 assert.equal(Object.hasOwn(saved,'stock'),false);
 assert.equal(Object.hasOwn(saved,'allowBackorder'),false);
 assert.equal(Object.hasOwn(saved,'productionDays'),false);
 assert.ok(saved.variants.every(v=>!Object.hasOwn(v,'stock')&&!Object.hasOwn(v,'allowBackorder')));
 assert.doesNotMatch(window.document.querySelector('#catalog-products').textContent,/Estoque|unidades|Sem estoque|Não controlado/);
 window.close();
});

test('existing product can edit price and add Cor while preserving removed variants as disabled',async()=>{
 const existing={productId:'produto_teste',name:'Dobrão antigo',category:'Dobrões',description:'',material:'Bronze',dimensions:'',priceCents:10000,enabled:true,image:'/images/test.webp',gallery:[],stock:null,allowBackorder:true,productionDays:null,variants:[{id:'gravado',label:'Gravado',enabled:true},{id:'lapidado',label:'Lapidado',enabled:true}],optionGroups:[]};
 const {window,getSaved}=setup([existing]);
 openCatalog(window);await wait();
 window.document.querySelector('[data-edit-product="produto_teste"]').click();
 const form=window.document.querySelector('#product-edit');
 form.elements.name.value='Dobrão atualizado';
 form.elements.price.value='125';
 form.elements.finish_gravado.checked=false;
 form.elements.finish_lapidado.checked=true;
 form.elements.finish_sem_gravacao.checked=false;
 window.document.querySelector('#add-custom-area').click();
 const area=window.document.querySelector('.custom-area-item');
 area.querySelector('[name="areaTitle"]').value='Cor';
 area.querySelector('[name="areaOptions"]').value='Dourado\nPrateado';
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 await wait();await wait();
 const saved=getSaved();
 assert.ok(saved,'edited product should be sent to the API');
 assert.equal(saved.name,'Dobrão atualizado');
 assert.equal(saved.priceCents,12500);
 assert.deepEqual(saved.optionGroups,[{id:'area_1',name:'Cor',options:['Dourado','Prateado']}]);
 assert.ok(saved.variants.some(v=>v.id==='gravado'&&v.enabled===false),'removed option must remain stored but disabled');
 assert.ok(saved.variants.some(v=>v.id==='lapidado'&&v.enabled===true));
 window.close();
});

test('product editor exposes three independent finish checkboxes and custom areas',async()=>{
 const {window}=setup();openCatalog(window);await wait();window.document.querySelector('#new-product').click();
 for(const id of ['gravado','lapidado','sem_gravacao'])assert.ok(window.document.querySelector('[name="finish_'+id+'"]'));
 assert.equal(window.document.querySelector('[name="productOptions"]'),null);
 assert.equal(window.document.querySelector('[name="stock"]'),null);
 const category=window.document.querySelector('[name="category"]');
 assert.equal(category.options[0].textContent,'Selecione');
 assert.equal(category.options[0].value,'');
 assert.equal(category.options[0].disabled,true);
 assert.equal(category.options[0].hidden,true);
 assert.equal(category.required,true);
 assert.equal(window.document.querySelector('[name="allowBackorder"]'),null);
 assert.equal(window.document.querySelector('[name="days"]'),null);
 assert.match(admin,/const finishDefinitions=\[\{id:'gravado',label:'Gravado'\}/);
 assert.match(admin,/id="add-custom-area"/);
 assert.match(admin,/name="areaTitle"/);
 assert.match(admin,/name="areaOptions"/);
 assert.match(admin,/optionGroups\};/);window.close();
});

test('admin category controls reorder and persist the sequence',async()=>{
 const {window}=setup();
 openCatalog(window);await wait();
 const moveUp=window.document.querySelector('[data-move-category="1"][data-direction="-1"]');
 assert.ok(moveUp,'second category should have a move-up control');
 moveUp.click();await wait();await wait();
 const names=[...window.document.querySelectorAll('.category-chip strong')].map(el=>el.textContent);
 assert.deepEqual(names,['Bolsas','Dobrões']);
 assert.ok(window.document.querySelector('[data-move-category="0"][data-direction="-1"]').disabled);
 assert.ok(window.document.querySelector('[data-move-category="1"][data-direction="1"]').disabled);
 window.close();
});
