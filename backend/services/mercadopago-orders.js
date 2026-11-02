import {fail} from '../validation.js';
const amount=cents=>{if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000)fail(400,'invalid_amount','Valor inválido.');return (cents/100).toFixed(2);};
const payerDetails=customer=>{
 const parts=String(customer?.name||'Cliente').trim().split(/\s+/),digits=String(customer?.phone||'').replace(/\D/g,'');
 const phone=digits.length>=10&&digits.length<=11?{area_code:digits.slice(0,2),number:digits.slice(2)}:undefined;
 return {first_name:parts.shift()||'Cliente',last_name:parts.join(' ')||'Cliente',...(phone?{phone}:{})};
};
const orderItems=(items,shippingCents)=>{
 if(!Array.isArray(items)||!items.length)fail(400,'invalid_items','Itens do pedido ausentes.');
 const result=items.map(item=>{
  if(!item||typeof item.name!=='string'||!Number.isSafeInteger(item.quantity)||item.quantity<1||!Number.isSafeInteger(item.unitPrice)||item.unitPrice<1)fail(400,'invalid_items','Item do pedido inválido.');
  return {external_code:String(item.productId||'item').slice(0,64),title:item.name.slice(0,120),description:item.name.slice(0,250),category_id:'others',quantity:item.quantity,unit_price:amount(item.unitPrice)};
 });
 if(Number.isSafeInteger(shippingCents)&&shippingCents>0)result.push({external_code:'shipping',title:'Frete',category_id:'others',quantity:1,unit_price:amount(shippingCents)});
 return result;
};
const deviceHeader=value=>{const id=String(value||'').trim();if(!id)return {};if(id.length>256||/[\r\n]/.test(id))fail(400,'invalid_device_id','Identificador do dispositivo inválido.');return {'X-meli-session-id':id};};
export function createOrdersGateway({accessToken}){
 if(!accessToken)fail(503,'gateway_not_configured','Credenciais indisponíveis.');
 async function request(path,{method='GET',body,key,headers:extraHeaders={}}={}){
  const headers={Authorization:'Bearer '+accessToken,Accept:'application/json'};
  if(body)headers['Content-Type']='application/json';
  if(key)headers['X-Idempotency-Key']=key;Object.assign(headers,extraHeaders);
  let response;try{response=await fetch('https://api.mercadopago.com'+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}catch{fail(502,'gateway_unavailable','Mercado Pago indisponível.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok)fail(502,'gateway_rejected','Mercado Pago recusou a operação ('+response.status+').');
  return data;
 }
 return {
  async createPix({reference,totalCents,email,idempotencyKey,items,shippingCents,customer,deviceId}){
   if(!/^[a-zA-Z0-9_-]{1,64}$/.test(reference||''))fail(400,'invalid_reference','Referência inválida.');
   if(!/^\S+@\S+\.\S+$/.test(email||''))fail(400,'invalid_email','E-mail obrigatório para Pix.');
   if(!/^[0-9a-f-]{36}$/i.test(idempotencyKey||''))fail(400,'invalid_key','Chave inválida.');
   const value=amount(totalCents);
   const lines=orderItems(items,shippingCents);if(lines.reduce((sum,item)=>sum+Math.round(Number(item.unit_price)*100)*item.quantity,0)!==totalCents)fail(400,'items_total_mismatch','O total dos itens não corresponde ao pedido.');
   return request('/v1/orders',{method:'POST',key:idempotencyKey,headers:deviceHeader(deviceId),body:{type:'online',processing_mode:'automatic',external_reference:reference,total_amount:value,payer:{email,...payerDetails(customer)},items:lines,transactions:{payments:[{amount:value,payment_method:{id:'pix',type:'bank_transfer'}}]}}});
  },
  async createCard({reference,totalCents,email,cardToken,paymentMethodId,paymentMethodType='credit_card',installments=1,idempotencyKey,items,shippingCents,customer,deviceId}){
   if(!/^[a-zA-Z0-9_-]{1,64}$/.test(reference||''))fail(400,'invalid_reference','Referência inválida.');
   if(!/^\S+@\S+\.\S+$/.test(email||''))fail(400,'invalid_email','E-mail válido obrigatório.');
   if(typeof cardToken!=='string'||!/^[a-zA-Z0-9_-]{12,128}$/.test(cardToken))fail(400,'invalid_card_token','Token do cartão inválido.');
   if(!/^[a-z0-9_]{2,32}$/.test(paymentMethodId||''))fail(400,'invalid_payment_method','Meio de pagamento inválido.');
   if(!['credit_card','debit_card'].includes(paymentMethodType))fail(400,'invalid_payment_type','Tipo de cartão inválido.');
   if(!Number.isInteger(installments)||installments<1||installments>12)fail(400,'invalid_installments','Parcelas inválidas.');
   if(!/^[0-9a-f-]{36}$/i.test(idempotencyKey||''))fail(400,'invalid_key','Chave inválida.');
   const value=amount(totalCents);
   const lines=orderItems(items,shippingCents);if(lines.reduce((sum,item)=>sum+Math.round(Number(item.unit_price)*100)*item.quantity,0)!==totalCents)fail(400,'items_total_mismatch','O total dos itens não corresponde ao pedido.');
   return request('/v1/orders',{method:'POST',key:idempotencyKey,headers:deviceHeader(deviceId),body:{type:'online',processing_mode:'automatic',capture_mode:'automatic',external_reference:reference,total_amount:value,payer:{email,...payerDetails(customer)},items:lines,transactions:{payments:[{amount:value,payment_method:{id:paymentMethodId,type:paymentMethodType,token:cardToken,installments,statement_descriptor:'SAOBENTO DOB'}}]}}});
  },
  async getOrder(id){if(!/^ORD[A-Z0-9]{8,64}$/.test(id||''))fail(400,'invalid_order_id','Order inválida.');return request('/v1/orders/'+encodeURIComponent(id));}
 };
}
