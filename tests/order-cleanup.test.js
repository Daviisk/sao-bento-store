import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openStore} from '../backend/store.js';
import {deleteAbandonedOrders,createOrderCleanupRunner,orderCleanupTimeoutMs} from '../backend/order-cleanup.js';
test('old abandoned orders are retained, even when legacy cleanup is called',async()=>{
 const store=openStore(':memory:');try{const order=store.obtain('owner',randomUUID(),{hash:'cart'},{},()=>({}));order.createdAt='2020-01-01T00:00:00Z';store.save(order);
 assert.equal(orderCleanupTimeoutMs({ABANDONED_ORDER_TIMEOUT_MINUTES:'1'}),null);
 assert.equal(await deleteAbandonedOrders(store),0);assert.equal(await createOrderCleanupRunner(store)(),0);assert.ok(store.get(order.orderId));
 const fresh=store.obtain('owner',randomUUID(),{hash:'cart'},{},()=>({}));assert.notEqual(fresh.orderId,order.orderId);assert.ok(store.get(order.orderId));
 }finally{store.close();}
});

