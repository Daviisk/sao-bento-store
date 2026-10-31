import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommerceStore} from '../backend/commerce-store.js';

test('Postgres commerce adapter uses the existing isolated Supabase documents table',async()=>{
 const statements=[];
 function sql(strings,...values){
  if(typeof strings==='string')return {identifier:strings};
  const query=strings.reduce((out,part,index)=>out+part+(index<values.length?(values[index]?.identifier||'$'+(index+1)):''),'');
  statements.push(query);
  return Promise.resolve([]);
 }
 sql.begin=async fn=>fn(sql);
 const store=createCommerceStore({kind:'postgres',sql});
 await store.get('settings','catalog');
 assert.match(statements[0],/public\.medalhas_commerce_documents/);
 assert.doesNotMatch(statements[0],/public\.commerce_documents\b/);
});
