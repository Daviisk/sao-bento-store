import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {issueTrackingToken,verifyTrackingToken} from '../backend/tracking-security.js';
import {createTrackingHandler} from '../api/tracking.js';
import {openStore} from '../backend/store.js';
const secret='a'.repeat(40),id=randomUUID();
test('tracking credentials expire, bind order and reject tampering',()=>{
 const now=Date.now(),token=issueTrackingToken(id,secret,now);
 assert.ok(verifyTrackingToken(id,token,secret,now));
 assert.equal(verifyTrackingToken(randomUUID(),token,secret,now),false);
 assert.equal(verifyTrackingToken(id,token,secret+'x',now),false);
 assert.equal(verifyTrackingToken(id,token,secret,now+91*86400000),false);
 assert.equal(verifyTrackingToken(id,token.replace(/^\d/,'9'),secret,now),false);
 for(const value of ['',null,'💥','1.a','a'.repeat(10000)])assert.equal(verifyTrackingToken(id,value,secret,now),false);
 const legacy=createHmac('sha256',secret).update('order-tracking:'+id).digest('hex');
 assert.equal(verifyTrackingToken(id,legacy,secret,Date.parse('2026-10-28')),false);
});
test('tracking minimizes data and registers paid-order requests idempotently',async()=>{
 const store=openStore(':memory:');try{
 const order=store.obtain('owner',randomUUID(),{hash:'cart'},{customer:{name:'Private name'},address:{street:'Private street',city:'Goiânia',state:'GO'},status:'paid'},()=>({}));order.status='paid';store.save(order);
 const token=issueTrackingToken(order.orderId,secret);
 const handler=createTrackingHandler({config:{baseURL:'https://shop.test',adminSessionSecret:secret,mode:'disabled'},store,gateway:{}});
 async function call(action,{method='GET',origin,auth=token,kind='withdrawal'}={}){let body;const res={setHeader(){},end(v){body=JSON.parse(v);}};await handler({url:`/?action=${action}&orderId=${order.orderId}&kind=${kind}`,method,headers:{authorization:'Bearer '+auth,...(origin?{origin}:{})}},res);return {status:res.statusCode,body};}
 assert.equal((await call('track',{auth:'fake'})).status,404);
 const track=await call('track');assert.equal(track.status,200);assert.equal(track.body.address.street,undefined);assert.equal(track.body.customer,undefined);assert.equal(track.body.trackingUrl,undefined);
 assert.equal((await call('support')).status,405);
 assert.equal((await call('support',{method:'POST',origin:'https://evil.test'})).status,403);
 const a=await call('support',{method:'POST',origin:'https://shop.test'}),b=await call('support',{method:'POST',origin:'https://shop.test'});
 assert.equal(a.status,200);assert.equal(a.body.receipt.id,b.body.receipt.id);assert.equal(store.get(order.orderId).status,'paid');
 }finally{store.close();}
});

test('saving an older order snapshot does not erase support receipt',()=>{
 const store=openStore(':memory:');try{const order=store.obtain('owner',randomUUID(),{hash:'cart'},{},()=>({}));const old=structuredClone(order);const receipt=store.addSupportRequest(order.orderId,'withdrawal');old.status='paid';store.save(old);assert.equal(store.get(order.orderId).supportRequests[0].id,receipt.id);}finally{store.close();}
});

