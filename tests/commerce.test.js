import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {openStore} from '../backend/store.js';import {createCommerce,validateImage} from '../backend/commerce.js';
const payload=(quantity=1)=>({customer:{name:'Cliente Teste',phone:'62999999999'},items:[{productId:'produto_01',variantId:'lapidado',quantity,engravingNotes:'Mestre Teste'}],notes:'Goiânia'});
function setup(t){const store=openStore(':memory:');t.after(()=>store.close());return createCommerce({store,config:{baseURL:'https://example.com'}});}
test('personalization, authoritative price, idempotency and private tracking',async t=>{const c=setup(t),key=randomUUID(),r=await c.createOrder({...payload(),total:1},'owner',key);assert.equal(r.total,10000);assert.equal(r.items[0].engravingNotes,'Mestre Teste');assert.equal(r.paymentConfirmed,false);assert(!('customer' in r));const token=new URLSearchParams(new URL(r.trackingUrl).hash.slice(1)).get('token');await assert.rejects(c.track(r.orderId,token),{code:'payment_required'});await assert.rejects(c.updateOrder(r.orderId,{status:'production',paymentConfirmed:true,shippingCents:null}),{code:'payment_provider_required'});await assert.rejects(c.updateOrder(r.orderId,{status:'production',paymentConfirmed:false,shippingCents:null}),{code:'payment_required'});await assert.rejects(c.track(r.orderId,'a'.repeat(64)));assert.equal((await c.createOrder({...payload(),total:1},'owner',key)).orderId,r.orderId);await assert.rejects(c.createOrder(payload(2),'owner',key),{code:'idempotency_conflict'});});
test('legacy stock values do not limit orders or trigger inventory deductions',async t=>{const c=setup(t),p=(await c.catalog())[0];p.stock=1;p.allowBackorder=false;await c.productMutation(p,p.productId);const order=await c.createOrder(payload(2),'owner',randomUUID());assert.equal(order.items[0].quantity,2);assert.equal((await c.catalog())[0].stock,undefined);});
test('reviews require a provider-confirmed paid and delivered order',async t=>{const c=setup(t),o=await c.createOrder(payload(),'owner',randomUUID()),token=new URLSearchParams(new URL(o.trackingUrl).hash.slice(1)).get('token'),r={orderId:o.orderId,token,productId:'produto_01',rating:5,comment:'Bom produto'};await assert.rejects(c.review(r),{code:'review_not_eligible'});await assert.rejects(c.updateOrder(o.orderId,{status:'delivered',paymentConfirmed:true,shippingCents:1000}),{code:'payment_provider_required'});await assert.rejects(c.review(r),{code:'review_not_eligible'});});
test('catalog has no stock fields; bag prices, group request and upload validation',async t=>{const c=setup(t),p=await c.catalog();assert.equal(p[2].priceCents,10000);assert.equal(p[3].priceCents,10000);assert.equal(p[0].stock,undefined);assert.equal(p[0].variants[0].stock,undefined);await c.group({customer:payload().customer,group:'Grupo Capoeira',quantity:20,notes:'Bronze e inox'});assert.equal((await c.db.list('groups')).length,1);assert.throws(()=>validateImage({name:'fake.jpg',data:'data:image/jpeg;base64,YWJjZA=='}));assert.throws(()=>validateImage({name:'bad.svg',data:'data:image/svg+xml;base64,YWJjZA=='}));});

test('product material and dimensions are retained in the catalog',async t=>{
 const c=setup(t),p=(await c.catalog())[0];
 assert.equal(p.material,'Bronze');
 p.material='Bronze fundido';p.dimensions='Diâmetro: 38 mm';
 await c.productMutation(p,p.productId);
 const stored=(await c.catalog()).find(item=>item.productId===p.productId);
 assert.equal(stored.material,'Bronze fundido');
 assert.equal(stored.dimensions,'Diâmetro: 38 mm');
});

test('category order is persisted and invalid reorder requests are rejected',async t=>{
 const c=setup(t);
 const initial=await c.categories();
 assert.deepEqual(initial,['Dobrões','Bolsas','Acessórios']);
 const reordered=['Acessórios','Dobrões','Bolsas'];
 assert.deepEqual(await c.reorderCategories(reordered),reordered);
 assert.deepEqual(await c.categories(),reordered);
 await assert.rejects(c.reorderCategories(['Dobrões','Dobrões','Bolsas']),{code:'invalid_category_order'});
 await assert.rejects(c.reorderCategories(['Dobrões','Bolsas']),{code:'invalid_category_order'});
 await assert.rejects(c.reorderCategories(['Dobrões','Bolsas','Outra']),{code:'invalid_category_order'});
 assert.deepEqual(await c.categories(),reordered);
});
