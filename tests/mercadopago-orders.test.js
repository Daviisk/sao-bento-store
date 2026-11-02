import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createOrdersGateway} from '../backend/services/mercadopago-orders.js';

const customer={name:'Davi Velasco',phone:'62981368771'};
const items=[{productId:'produto_01',name:'Dobrão de bronze',quantity:2,unitPrice:11990}];

async function withFetch(t,fn){
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:'ORD01ABCDEF12345678',status:'created'})};};
 t.after(()=>{globalThis.fetch=original;});
 await fn(calls);
}

test('Orders Pix includes item quantities, unit prices, payer details, unique reference and Device ID',async t=>{
 await withFetch(t,async calls=>{
  const gateway=createOrdersGateway({accessToken:'test-token'}),reference=randomUUID();
  await gateway.createPix({reference,totalCents:25171,email:'buyer@example.com',idempotencyKey:randomUUID(),items,shippingCents:1191,customer,deviceId:'device-orders-pix'});
  const {url,options}=calls[0],body=JSON.parse(options.body);
  assert.equal(url,'https://api.mercadopago.com/v1/orders');
  assert.equal(options.headers['X-meli-session-id'],'device-orders-pix');
  assert.equal(options.headers['X-Idempotency-Key']!==undefined,true);
  assert.equal(body.external_reference,reference);
  assert.equal(body.total_amount,'251.71');
  assert.deepEqual(body.payer,{email:'buyer@example.com',first_name:'Davi',last_name:'Velasco',phone:{area_code:'62',number:'981368771'}});
  assert.deepEqual(body.items.map(item=>({external_code:item.external_code,title:item.title,quantity:item.quantity,unit_price:item.unit_price})),[
   {external_code:'produto_01',title:'Dobrão de bronze',quantity:2,unit_price:'119.90'},
   {external_code:'shipping',title:'Frete',quantity:1,unit_price:'11.91'}
  ]);
 });
});

test('Orders card includes statement descriptor and rejects item totals that do not match the order',async t=>{
 await withFetch(t,async calls=>{
  const gateway=createOrdersGateway({accessToken:'test-token'});
  await gateway.createCard({reference:randomUUID(),totalCents:25171,email:'buyer@example.com',cardToken:'card_token_123456789',paymentMethodId:'master',paymentMethodType:'credit_card',installments:1,idempotencyKey:randomUUID(),items,shippingCents:1191,customer,deviceId:'device-orders-card'});
  const {options}=calls[0],body=JSON.parse(options.body);
  assert.equal(options.headers['X-meli-session-id'],'device-orders-card');
  assert.equal(body.transactions.payments[0].payment_method.statement_descriptor,'SAOBENTO DOB');
  assert.equal(body.items[0].category_id,'others');
  await assert.rejects(gateway.createCard({reference:randomUUID(),totalCents:9999,email:'buyer@example.com',cardToken:'card_token_123456789',paymentMethodId:'master',idempotencyKey:randomUUID(),items,shippingCents:1191,customer}),{code:'items_total_mismatch'});
  assert.equal(calls.length,1);
 });
});

test('Orders gateway rejects an unsafe Device ID header',async()=>{
 const gateway=createOrdersGateway({accessToken:'test-token'});
 await assert.rejects(gateway.createPix({reference:randomUUID(),totalCents:25171,email:'buyer@example.com',idempotencyKey:randomUUID(),items,shippingCents:1191,customer,deviceId:'bad\r\nheader'}),{code:'invalid_device_id'});
});
