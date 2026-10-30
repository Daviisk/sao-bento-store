import test from 'node:test';import assert from 'node:assert/strict';import request from 'supertest';import {readConfig} from '../backend/config.js';import {createApp} from '../backend/app.js';import {openStore} from '../backend/store.js';import {products} from '../backend/products.js';
test('admin product edits are authenticated, origin-bound and reflected in durable catalog',async t=>{const config=readConfig({APP_URL:'http://localhost:3000',ADMIN_PASSWORD:'valid-password-for-test',ADMIN_SESSION_SECRET:'s'.repeat(40)}),store=openStore(':memory:');t.after(()=>store.close());const app=createApp({config,store,catalog:products,gateway:{}}),agent=request.agent(app);assert.equal((await agent.get('/api/admin/catalog')).status,401);assert.equal((await agent.post('/api/admin/login').set('Origin',config.baseURL).send({password:config.adminPassword})).status,200);const p=(await agent.get('/api/admin/catalog')).body.products[2];p.priceCents=12000;p.variants[0].stock=2;p.variants[0].allowBackorder=false;assert.equal((await agent.patch('/api/admin/catalog/'+p.productId).set('Origin','http://evil.invalid').send(p)).status,403);assert.equal((await agent.patch('/api/admin/catalog/'+p.productId).set('Origin',config.baseURL).send(p)).status,200);const catalog=(await agent.get('/api/commerce/catalog')).body.products;assert.equal(catalog[2].priceCents,12000);assert.equal(catalog[2].variants[0].stock,2);assert.equal((await agent.get('/api/products')).body.products[2].priceCents,12000);});
test('custom order and group submissions require session, origin and CSRF',async t=>{const config=readConfig({APP_URL:'http://localhost:3000'}),store=openStore(':memory:');t.after(()=>store.close());const app=createApp({config,store,catalog:products,gateway:{}}),agent=request.agent(app),session=(await agent.get('/api/session')).body;const body={customer:{name:'Cliente',phone:'62999999999'},items:[{productId:'produto_03',variantId:'padrao',quantity:1}]};assert.equal((await agent.post('/api/commerce/orders').set('Origin',config.baseURL).send(body)).status,403);const good=await agent.post('/api/commerce/orders').set('Origin',config.baseURL).set('X-CSRF-Token',session.csrfToken).set('Idempotency-Key','11111111-1111-4111-8111-111111111111').send(body);assert.equal(good.status,201);assert.equal(good.body.total,10000);assert.equal(good.body.paymentConfirmed,false);const token=new URLSearchParams(new URL(good.body.trackingUrl).hash.slice(1)).get('token');assert.equal((await request(app).get('/api/commerce/orders/'+good.body.orderId)).status,404);const result=await request(app).get('/api/commerce/orders/'+good.body.orderId).set('Authorization','Bearer '+token);assert.equal(result.status,200);assert(!('customer' in result.body));assert(!('adminNotes' in result.body));});

test('admin can create, rename, filter and delete unused dynamic categories safely',async t=>{
 const config=readConfig({APP_URL:'http://localhost:3000',ADMIN_PASSWORD:'valid-password-for-test',ADMIN_SESSION_SECRET:'s'.repeat(40)}),store=openStore(':memory:');t.after(()=>store.close());
 const app=createApp({config,store,catalog:products,gateway:{}}),agent=request.agent(app);
 await agent.post('/api/admin/login').set('Origin',config.baseURL).send({password:config.adminPassword}).expect(200);
 const initial=await agent.get('/api/admin/categories').expect(200);assert.deepEqual(initial.body.categories,['Dobrões','Bolsas','Acessórios']);
 await agent.post('/api/admin/categories').set('Origin',config.baseURL).send({name:'Instrumentos'}).expect(201);
 const product=(await agent.get('/api/admin/catalog')).body.products.find(p=>p.productId==='produto_03');product.category='Instrumentos';
 await agent.patch('/api/admin/catalog/produto_03').set('Origin',config.baseURL).send(product).expect(200);
 await agent.patch('/api/admin/categories/Instrumentos').set('Origin',config.baseURL).send({name:'Acessórios de Capoeira'}).expect(200);
 assert.equal((await agent.get('/api/commerce/catalog')).body.products.find(p=>p.productId==='produto_03').category,'Acessórios de Capoeira');
 await agent.delete('/api/admin/categories/Acessórios%20de%20Capoeira').set('Origin',config.baseURL).expect(409);
 product.category='Bolsas';await agent.patch('/api/admin/catalog/produto_03').set('Origin',config.baseURL).send(product).expect(200);
 await agent.delete('/api/admin/categories/Acessórios%20de%20Capoeira').set('Origin',config.baseURL).expect(200);
});

test('product deletion preserves products already referenced by orders',async t=>{
 const config=readConfig({APP_URL:'http://localhost:3000',ADMIN_PASSWORD:'valid-password-for-test',ADMIN_SESSION_SECRET:'s'.repeat(40)}),store=openStore(':memory:');t.after(()=>store.close());
 const app=createApp({config,store,catalog:products,gateway:{}}),agent=request.agent(app);
 await agent.post('/api/admin/login').set('Origin',config.baseURL).send({password:config.adminPassword}).expect(200);
 await agent.delete('/api/admin/catalog/produto_04').set('Origin',config.baseURL).expect(200);
 assert.equal((await agent.get('/api/admin/catalog')).body.products.some(p=>p.productId==='produto_04'),false);
 const session=(await agent.get('/api/session')).body;
 const order=await agent.post('/api/commerce/orders').set('Origin',config.baseURL).set('X-CSRF-Token',session.csrfToken).set('Idempotency-Key','22222222-2222-4222-8222-222222222222').send({customer:{name:'Cliente',phone:'62999999999'},items:[{productId:'produto_03',variantId:'padrao',quantity:1}]}).expect(201);
 assert.equal(order.body.items[0].productId,'produto_03');
 await agent.delete('/api/admin/catalog/produto_03').set('Origin',config.baseURL).expect(409);
 assert.equal((await agent.get('/api/admin/catalog')).body.products.some(p=>p.productId==='produto_03'),true);
});

test('standard checkout order records also protect product deletion',t=>{
 const store=openStore(':memory:');t.after(()=>store.close());
 store.obtain('session-owner','order-request-key',{hash:'cart-hash-01'},{items:[{productId:'produto_01',quantity:1}],productsTotal:10000,total:10000},()=>({}));
 assert.equal(store.hasProductInOrders('produto_01'),true);
 assert.equal(store.hasProductInOrders('produto_02'),false);
});
