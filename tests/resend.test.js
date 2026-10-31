import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderConfirmationSender} from '../backend/services/resend.js';

const order={
 status:'paid',
 orderId:'123e4567-e89b-42d3-a456-426614174000',
 orderCode:'SB1001',
 customer:{name:'Cliente <Teste>',email:'cliente@example.com'},
 items:[{name:'Dobrão <Bronze>',quantity:2,subtotal:20000}],
 productsTotal:20000,
 shipping:{name:'PAC',priceCents:1500},
 total:21500,
 address:{street:'Rua Um',number:'10',district:'Centro',city:'Goiânia',state:'GO',cep:'74000000'}
};

test('sends a payment-confirmed order email with idempotency and escaped HTML',async()=>{
 let call;
 const send=createOrderConfirmationSender({apiKey:'re_test_key',fetchImpl:async(url,options)=>{call={url,options};return {ok:true,status:200,json:async()=>({id:'email_123'})};}});
 const result=await send(order);
 assert.deepEqual(result,{id:'email_123'});
 assert.equal(call.url,'https://api.resend.com/emails');
 assert.equal(call.options.headers.Authorization,'Bearer re_test_key');
 assert.equal(call.options.headers['Idempotency-Key'],'order-confirmation-'+order.orderId);
 const body=JSON.parse(call.options.body);
 assert.deepEqual(body.to,['cliente@example.com']);
 assert.equal(body.reply_to,'contato@saobentodobroes.com');
 assert.match(body.subject,/SB1001/);
 assert.match(body.html,/Cliente &lt;Teste&gt;/);
 assert.match(body.html,/Dobrão &lt;Bronze&gt;/);
 assert.match(body.text,/Total pago:/);
});

test('does not send before payment is approved or without a valid recipient',async()=>{
 let calls=0;
 const send=createOrderConfirmationSender({apiKey:'re_test_key',fetchImpl:async()=>{calls++;return {ok:true,status:200,json:async()=>({id:'email_123'})};}});
 assert.equal(await send({...order,status:'pending'}),null);
 assert.equal(await send({...order,customer:{...order.customer,email:'invalid'}}),null);
 assert.equal(calls,0);
});

test('surfaces Resend failures for retry handling',async()=>{
 const send=createOrderConfirmationSender({apiKey:'re_test_key',fetchImpl:async()=>({ok:false,status:403,json:async()=>({name:'validation_error'})})});
 await assert.rejects(send(order),error=>error.statusCode===403&&error.code==='validation_error');
});

test('does not create a sender when the API key is absent',()=>{
 assert.equal(createOrderConfirmationSender({apiKey:''}),null);
});
