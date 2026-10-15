import {fail} from '../validation.js';
const amount=cents=>{if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000)fail(400,'invalid_amount','Valor inválido.');return (cents/100).toFixed(2);};
export function createOrdersGateway({accessToken}){
 if(!accessToken)fail(503,'gateway_not_configured','Credenciais indisponíveis.');
 async function request(path,{method='GET',body,key}={}){
  const headers={Authorization:'Bearer '+accessToken,Accept:'application/json'};
  if(body)headers['Content-Type']='application/json';
  if(key)headers['X-Idempotency-Key']=key;
  let response;try{response=await fetch('https://api.mercadopago.com'+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}catch{fail(502,'gateway_unavailable','Mercado Pago indisponível.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)fail(502,'gateway_rejected','Mercado Pago recusou a operação ('+response.status+').');
  return data;
 }
 return {
  async createPix({reference,totalCents,email,idempotencyKey}){
   if(!/^[a-zA-Z0-9_-]{1,64}$/.test(reference||''))fail(400,'invalid_reference','Referência inválida.');
   if(!/^\S+@\S+\.\S+$/.test(email||''))fail(400,'invalid_email','E-mail obrigatório para Pix.');
   if(!/^[0-9a-f-]{36}$/i.test(idempotencyKey||''))fail(400,'invalid_key','Chave inválida.');
   const value=amount(totalCents);
   return request('/v1/orders',{method:'POST',key:idempotencyKey,body:{type:'online',processing_mode:'automatic',external_reference:reference,total_amount:value,payer:{email},transactions:{payments:[{amount:value,payment_method:{id:'pix',type:'bank_transfer'}}]}}});
  },
  async getOrder(id){if(!/^ORD[A-Z0-9]{8,64}$/.test(id||''))fail(400,'invalid_order_id','Order inválida.');return request('/v1/orders/'+encodeURIComponent(id));}
 };
}
