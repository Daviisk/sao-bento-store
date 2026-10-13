import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequestLimiter} from '../backend/request-limiter.js';
test('public request limiter rejects excess attempts and resets after the window',()=>{
  let time=0;const check=createRequestLimiter({limit:2,windowMs:1000,now:()=>time});
  const req={headers:{'x-real-ip':'127.0.0.1'}};
  assert.equal(check(req),0);assert.equal(check(req),0);assert.equal(check(req),1);
  time=1000;assert.equal(check(req),0);
});
test('limiter fails closed when its bounded address capacity is full',()=>{
  const check=createRequestLimiter({maxKeys:1});
  assert.equal(check({headers:{'x-real-ip':'127.0.0.1'}}),0);
  assert.equal(check({headers:{'x-real-ip':'127.0.0.2'}}),60);
});

