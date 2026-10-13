import {trackingRequestError} from '../backend/request-security.js';
import {randomUUID} from 'node:crypto';
import {createRequestLimiter} from '../backend/request-limiter.js';
import {issueTrackingToken,verifyTrackingToken,trackingCredential} from '../backend/tracking-security.js';
import {readConfig} from '../backend/config.js';
import {createPostgresStore} from '../backend/postgres-store.js';
import {createGateway,cardPaymentSnapshot} from '../backend/services/mercadopago.js';

const config=readConfig(process.env);
const store=config.databaseUrl?createPostgresStore(config.databaseUrl,config.databaseSchema):null;
const gateway=createGateway({...config,accessToken:config.mode==='disabled'?'':config.accessToken});
export function createTrackingHandler({config,store,gateway}){
const checkLimit=createRequestLimiter();
const trackingSecret=String(config.adminSessionSecret?.length>=32?config.adminSessionSecret:config.webhookSecret||'');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


function cookie(req,name){
  const raw=String(req.headers.cookie||'');
  for(const part of raw.split(';')){
    const value=part.trim();
    if(value.startsWith(name+'='))return value.slice(name.length+1);
  }
  return '';
}
function paymentStarted(order){return Boolean(order&&(
  order.status!=='pending'||order.paymentAttemptKey||order.providerOrderId||order.paymentId
));}
function trackingUrl(order){return `${config.baseURL}/sucesso?orderId=${encodeURIComponent(order.orderId)}#token=${issueTrackingToken(order.orderId,trackingSecret)}`;}
function publicTrackingOrder(order){
  return {
    orderId:order.orderId,
    orderCode:order.orderCode||String(order.orderId).slice(0,8).toUpperCase(),
    items:order.items||[],
    productsTotal:order.productsTotal,
    shipping:order.shipping||null,
    address:order.address?{city:order.address.city,state:order.address.state}:null,
    total:order.total,
    currency:order.currency||'BRL',
    status:order.status,
    fulfillmentStatus:order.fulfillmentStatus||'awaiting_payment',
    trackingCode:order.trackingCode||'',
    createdAt:order.createdAt,
    paymentMethod:order.paymentMethod||'',
    providerStatusDetail:order.providerStatusDetail||'',
    fulfillmentUpdatedAt:order.fulfillmentUpdatedAt||null,
    supportRequests:(order.supportRequests||[]).map(({id,kind,createdAt,status})=>({id,kind,createdAt,status}))
  };
}
async function refreshPayment(order){
  if(!order||!['pending','processing','paid','partially_refunded','in_mediation'].includes(order.status)||!/^\d+$/.test(String(order.providerOrderId||''))||config.mode==='disabled')return order;
  try{
    const remote=await gateway.getPayment(String(order.providerOrderId));
    await store.applySnapshot(order.orderId,cardPaymentSnapshot(remote,order,gateway));
    return await store.get(order.orderId)||order;
  }catch{return order;}
}
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.end(JSON.stringify(body));}

async function handle(req,res){
  const retryAfter=checkLimit(req);
  if(retryAfter){res.setHeader('Retry-After',String(retryAfter));return json(res,429,{error:'rate_limited',message:'Muitas tentativas. Aguarde um minuto e tente novamente.'});}
  const rejected=trackingRequestError(req,config.baseURL);
  if(rejected){if(rejected.allow)res.setHeader('Allow',rejected.allow);return json(res,rejected.status,{error:rejected.error,message:rejected.message});}
  if(!store)return json(res,503,{error:'persistent_storage_required',message:'O acompanhamento está temporariamente indisponível.'});
  if(trackingSecret.length<16)return json(res,503,{error:'tracking_not_configured',message:'O acompanhamento seguro ainda não está configurado.'});
  const url=new URL(req.url,'https://tracking.local');
  const action=String(url.searchParams.get('action')||'');
  const orderId=String(url.searchParams.get('orderId')||'');
  if(!uuid.test(orderId))return json(res,404,{error:'order_not_found',message:'Pedido não encontrado.'});

  if(action==='link'){
    const session=await store.session(cookie(req,'jewelry_session'));
    if(!session)return json(res,401,{error:'session_required',message:'Abra novamente a loja no navegador usado na compra.'});
    const order=await store.get(orderId);
    if(!order||order.owner!==session.id)return json(res,404,{error:'order_not_found',message:'Pedido não encontrado para esta sessão.'});
    if(!paymentStarted(order))return json(res,409,{error:'payment_not_started',message:'O link de acompanhamento será liberado quando o pagamento for iniciado.'});
    return json(res,200,{orderId:order.orderId,orderCode:order.orderCode,trackingUrl:trackingUrl(order)});
  }

  if(action==='support'){
    const token=trackingCredential(req,url);
    if(!verifyTrackingToken(orderId,token,trackingSecret))return json(res,404,{error:'order_not_found',message:'Link inválido ou expirado.'});
    const kind=url.searchParams.get('kind');
    if(!['withdrawal','defect','privacy','other'].includes(kind))return json(res,400,{error:'invalid_request',message:'Selecione uma solicitação válida.'});
    const order=await store.get(orderId);
    if(!order||!paymentStarted(order))return json(res,404,{error:'order_not_found',message:'Pedido não encontrado.'});
    const receipt=await store.addSupportRequest(orderId,kind);
    return json(res,200,{receipt,message:'Solicitação registrada. Guarde seu protocolo. A solicitação não executa estorno automático.'});
  }

  if(action==='cancel'){
    const token=trackingCredential(req,url);
    if(!verifyTrackingToken(orderId,token,trackingSecret))return json(res,404,{error:'order_not_found',message:'Link de acompanhamento inválido.'});
    let order=await store.get(orderId);
    if(!order||!paymentStarted(order))return json(res,404,{error:'order_not_found',message:'Pedido não encontrado.'});
    order=await refreshPayment(order);
    if(order.status==='paid'||['preparing','shipped','delivered'].includes(order.fulfillmentStatus))return json(res,409,{error:'cancel_not_allowed',message:'Este pedido já foi pago ou entrou em preparação. Entre em contato com a loja para solicitar cancelamento ou reembolso.'});
    if(order.fulfillmentStatus==='cancelled'||['cancelled','failed','refunded','charged_back'].includes(order.status))return json(res,200,publicTrackingOrder(order));
    if(!['pending','processing'].includes(order.status))return json(res,409,{error:'cancel_not_allowed',message:'Este pedido não pode ser cancelado automaticamente neste estado.'});
    if(order.providerOrderId){const remote=await gateway.cancelPayment(String(order.providerOrderId));await store.applySnapshot(orderId,cardPaymentSnapshot(remote,order,gateway));order=await store.get(orderId)||order;}
    const updated=await store.updateFulfillment(orderId,{fulfillmentStatus:'cancelled',trackingCode:order.trackingCode||'',adminNotes:order.adminNotes||''});
    return json(res,200,publicTrackingOrder(updated||order));
  }

  if(action==='track'){
    const token=trackingCredential(req,url);
    if(!verifyTrackingToken(orderId,token,trackingSecret))return json(res,404,{error:'order_not_found',message:'Link de acompanhamento inválido.'});
    let order=await store.get(orderId);
    if(!order||!paymentStarted(order))return json(res,404,{error:'order_not_found',message:'Pedido não encontrado.'});
    order=await refreshPayment(order);
    return json(res,200,publicTrackingOrder(order));
  }

  return json(res,404,{error:'not_found',message:'Recurso não encontrado.'});
}


return async function handler(req,res){try{return await handle(req,res);}catch{const incident=randomUUID();console.error(JSON.stringify({event:'tracking_error',incident}));return json(res,500,{error:'internal_error',message:'Não foi possível concluir. Tente novamente.',incident});}}

}
export default createTrackingHandler({config,store,gateway});

