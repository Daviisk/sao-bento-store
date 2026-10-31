import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {createApp} from '../backend/app.js';
import {openStore} from '../backend/store.js';
import {readConfig} from '../backend/config.js';
import {products} from '../backend/products.js';

test('commerce card retries reuse one provider idempotency key and send one paid-order email',async t=>{
 const originalFetch=globalThis.fetch;
 const envKeys=['SHIPPING_PROVIDER','SUPERFRETE_TOKEN','SHIPPING_ORIGIN_CEP','SUPERFRETE_SERVICES'];
 const previous=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
 process.env.SHIPPING_PROVIDER='superfrete';
 process.env.SUPERFRETE_TOKEN='test-superfrete-token';
 process.env.SHIPPING_ORIGIN_CEP='01001000';
 process.env.SUPERFRETE_SERVICES='1';
 const providerKeys=[];
 let providerCreateCalls=0;
 let order;
 globalThis.fetch=async(url,options={})=>{
  if(String(url).includes('/api/v0/calculator')){
   return {ok:true,status:200,json:async()=>[{id:'1',price:10,delivery_time:5,company:{name:'Correios'},name:'PAC'}]};
  }
  if(String(url)==='https://api.mercadopago.com/v1/orders'){
   providerKeys.push(options.headers['X-Idempotency-Key']);
   providerCreateCalls++;
   if(providerCreateCalls===1)throw Error('simulated timeout after provider accepted request');
   return {ok:true,status:201,json:async()=>order};
  }
  if(String(url).startsWith('https://api.mercadopago.com/v1/orders/')){
   return {ok:true,status:200,json:async()=>order};
  }
  throw Error('Unexpected test URL: '+url);
 };
 t.after(()=>{
  globalThis.fetch=originalFetch;
  for(const key of envKeys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
 });
 const config={...readConfig({
  NODE_ENV:'production',APP_URL:'https://shop.example',
  MERCADO_PAGO_MODE:'production',MERCADO_PAGO_ACCESS_TOKEN:'test-access',
  MERCADO_PAGO_PUBLIC_KEY:'test-public',MERCADO_PAGO_SELLER_ID:'123',
  MERCADO_PAGO_APPLICATION_ID:'456',WEBHOOK_SECRET:'test-webhook-secret'
 }),production:false,durableStorage:true,checkoutLimit:100};
 const store=openStore(':memory:');t.after(()=>store.close());
 const emails=[];
 const app=createApp({config,catalog:products,store,gateway:{},shipping:{configured:false},emailSender:async value=>{emails.push(value);return {id:'email_paid_123'};},logger:{error(){}}});
 const agent=request.agent(app);
 const session=await agent.get('/api/session').expect(200);
 const headers={'Origin':config.baseURL,'X-CSRF-Token':session.body.csrfToken};
 const created=await agent.post('/api/commerce/orders').set(headers).set('Idempotency-Key',randomUUID()).send({
  customer:{name:'Cliente Teste',phone:'62999999999'},
  items:[{productId:'produto_03',variantId:'padrao',quantity:1}],
  notes:''
 }).expect(201);
 order={
  id:'ORDABC12345678',
  external_reference:created.body.orderId,
  total_amount:'110.00',
  status:'processed',
  status_detail:'accredited',
  transactions:{payments:[{status:'processed',status_detail:'accredited',amount:'110.00'}]}
 };
 const paymentBody={email:'cliente@example.com',cep:'01001000',serviceCode:'SF-1',card:{
  token:'test_card_token_123456',paymentMethodId:'master',paymentMethodType:'credit_card',installments:1
 }};
 await agent.post('/api/commerce/orders/'+created.body.orderId+'/card')
  .set(headers).set('Idempotency-Key',randomUUID()).send(paymentBody).expect(502);
 await agent.post('/api/commerce/orders/'+created.body.orderId+'/card')
  .set(headers).set('Idempotency-Key',randomUUID()).send(paymentBody).expect(200);
 assert.equal(providerCreateCalls,2);
 assert.equal(providerKeys.length,2);
 assert.equal(providerKeys[0],providerKeys[1],'A mesma cobrança deve reutilizar a chave do pedido, mesmo se o navegador gerar outra chave.');
 assert.equal(emails.length,1);
 assert.equal(emails[0].status,'paid');
 assert.equal(emails[0].customer.email,'cliente@example.com');
 assert.equal(emails[0].shipping.priceCents,1000);
 await agent.get('/api/commerce/orders/'+created.body.orderId+'/payment-status').expect(200);
 assert.equal(emails.length,1,'Polling não deve enviar a confirmação duas vezes.');
});
