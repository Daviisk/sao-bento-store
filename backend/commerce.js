import {createOrdersGateway} from './services/mercadopago-orders.js';
import {randomUUID,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {fail} from './validation.js';
import {createCommerceStore} from './commerce-store.js';
import {products as defaults} from './products.js';
import {createShippingProvider,postalCode} from './services/shipping.js';
const hash=v=>createHash('sha256').update(v).digest('hex');
function extractOrdersPix(remote){
 const payment=remote?.transactions?.payments?.[0]||{};
 const method=payment.payment_method||{};
 const info=payment.payment_method?.qr_code||payment.point_of_interaction?.transaction_data||{};
 const code=typeof method.qr_code==='string'?method.qr_code:typeof info.qr_code==='string'?info.qr_code:typeof payment.qr_code==='string'?payment.qr_code:'';
 const base64=typeof method.qr_code_base64==='string'?method.qr_code_base64:typeof info.qr_code_base64==='string'?info.qr_code_base64:typeof payment.qr_code_base64==='string'?payment.qr_code_base64:'';
 return {qr_code:code,qr_code_base64:base64,redirect_url:method.ticket_url||payment.ticket_url||''};
}
export const statusLabels={requested:'Pedido recebido',awaiting_art:'Aguardando arte',art_approved:'Arte aprovada',production:'Em produção',shipped:'Enviado',delivered:'Entregue',cancelled:'Cancelado'};
const images=['dobrao-bronze-prof-v2.webp','dobrao-inox-prof-v2.webp','bolsa-couro-prof-v2.webp','bolsa-trio-prof-v2.webp'];
const galleries=[[],[],['bolsa-couro-lateral-prof-v2.webp','bolsa-couro-verso-prof-v2.webp','bolsa-couro-aberta-prof-v2.webp','bolsa-couro-perspectiva-prof-v2.webp'],['bolsa-trio-aberta-prof-v2.webp','bolsa-trio-verso-prof-v2.webp']];
export const seedProducts=defaults.map((p,i)=>({...p,category:i<2?'Dobrões':'Bolsas',description:i<2?'Dobrão para berimbau, gravado ou lapidado.':'Bolsa de couro para guardar e transportar seus dobrões.',material:['Bronze','Aço inoxidável','Couro','Couro'][i],dimensions:i===1?'Diâmetro: 38 mm · Espessura: 8 mm':'',image:'/images/'+images[i],gallery:['/images/'+images[i],...galleries[i].map(n=>'/images/'+n)],variants:(i<2?['gravado','lapidado','sem_gravacao']:['padrao']).map(id=>({id,label:id==='padrao'?'Padrão':id==='gravado'?'Gravado':id==='lapidado'?'Lapidado':'Sem gravação',enabled:true,stock:null,allowBackorder:true})),stock:null,allowBackorder:true,productionDays:null}));
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function cleanText(v,max=100,required=false){if(typeof v!=='string'||v.length>max||/[<>\x00-\x1f\x7f]/.test(v)||required&&!v.trim())fail(400,'invalid_text','Confira os campos preenchidos.');return v.trim();}
function contact(raw){if(!plain(raw))fail(400,'invalid_contact','Informe seu contato.');const name=cleanText(raw.name,100,true),phone=cleanText(raw.phone,30,true).replace(/\D/g,''),email=raw.email===undefined?'':cleanText(raw.email,200).toLowerCase();if(name.length<2||!/^[0-9]{10,13}$/.test(phone)||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'invalid_contact','Informe nome, telefone e um e-mail válido.');return {name,phone,...(email?{email}:{})};}
export function validateImage(raw){if(!raw)return null;if(!plain(raw))fail(400,'invalid_art','Arquivo inválido.');const name=cleanText(raw.name,100,true),data=raw.data;if(typeof data!=='string'||data.length>1400000)fail(413,'art_too_large','Envie JPG, PNG ou WebP com até 1 MB.');const m=data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!m)fail(400,'invalid_art','Use JPG, PNG ou WebP.');const b=Buffer.from(m[2],'base64');if(!b.length||b.length>1024*1024||b.toString('base64')!==m[2])fail(400,'invalid_art','Arquivo inválido.');const valid=m[1]==='png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='jpeg'?b[0]===255&&b[1]===216&&b[2]===255:b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';if(!valid)fail(400,'invalid_art','O arquivo não corresponde a uma imagem.');return {name,data};}
const validPhoto=v=>typeof v==='string'&&(/^\/images\/[a-zA-Z0-9_.-]+\.(webp|png|jpg|jpeg)$/.test(v)||/^\/api\/commerce\/media\/[a-f0-9-]{36}$/.test(v));
function validateProduct(raw,old){
 if(!plain(raw))fail(400,'invalid_product','Produto inválido.');
 const productId=old?.productId||cleanText(raw.productId,40,true);
 if(!/^[a-zA-Z0-9_-]{3,40}$/.test(productId))fail(400,'invalid_product','Identificador inválido.');
 const name=cleanText(raw.name,100,true),description=cleanText(raw.description||'',1000);
 const material=cleanText(raw.material??old?.material??'',80),dimensions=cleanText(raw.dimensions??old?.dimensions??'',120);
 if(!Number.isSafeInteger(raw.priceCents)||raw.priceCents<1||raw.priceCents>10000000||typeof raw.enabled!=='boolean')fail(400,'invalid_product','Confira preço e disponibilidade.');
 if(!validPhoto(raw.image)||!Array.isArray(raw.gallery)||raw.gallery.length>10||raw.gallery.some(v=>!validPhoto(v)))fail(400,'invalid_photo','Selecione imagens da loja ou envie uma foto.');
 if(!Array.isArray(raw.variants)||raw.variants.length<1||raw.variants.length>8)fail(400,'invalid_variants','Informe os acabamentos disponíveis.');
 const ids=new Set(),variants=raw.variants.map(v=>{
  if(!plain(v)||!/^[a-z0-9_-]{1,30}$/.test(v.id)||ids.has(v.id)||v.enabled!==undefined&&typeof v.enabled!=='boolean')fail(400,'invalid_variants','Confira os acabamentos disponíveis.');
  ids.add(v.id);
  const previous=old?.variants?.find(item=>item.id===v.id);
  return {id:v.id,label:cleanText(v.label,50,true),enabled:v.enabled===undefined?previous?.enabled!==false:v.enabled,stock:previous?.stock??null,allowBackorder:previous?.allowBackorder??true};
 });
 if(!variants.some(v=>v.enabled))fail(400,'invalid_variants','Mantenha pelo menos um acabamento disponível.');
 const stock=Object.hasOwn(raw,'stock')?raw.stock:(old?.stock??null);
 const allowBackorder=typeof raw.allowBackorder==='boolean'?raw.allowBackorder:(old?.allowBackorder??true);
 if(stock!==null&&(!Number.isSafeInteger(stock)||stock<0||stock>100000)||typeof allowBackorder!=='boolean')fail(400,'invalid_stock','Informe um estoque válido para o produto.');
 const productionDays=raw.productionDays===null?null:Number(raw.productionDays);
 if(productionDays!==null&&(!Number.isSafeInteger(productionDays)||productionDays<0||productionDays>365))fail(400,'invalid_days','Prazo inválido.');
 return {productId,name,category:cleanText(raw.category||old?.category||'',60,true),description,material,dimensions,priceCents:raw.priceCents,enabled:raw.enabled,image:raw.image,gallery:raw.gallery,variants,stock,allowBackorder,productionDays,maxQuantity:10};
}
export function createCommerce({store,config}){
 const db=createCommerceStore(store,config.databaseSchema||'public');
 const catalogPriceMigration='dobrao-price-100-brl-v1';
 const categoryDefaults=['Dobrões','Bolsas','Acessórios'];
 const categoryList=async(tx=db)=>{let value=await tx.get('settings','categories');if(!Array.isArray(value)){value=categoryDefaults;await tx.put('settings','categories',value);}return value;};
 const catalog=async(tx=db)=>{
  const categories=await categoryList(tx);
  const stored=await tx.get('settings','catalog');
  const products=stored||structuredClone(seedProducts);
  let catalogChanged=false;
  for(const p of products){
   if(!p.category){p.category=p.productId==='produto_01'||p.productId==='produto_02'?'Dobrões':categories.includes('Bolsas')?'Bolsas':categories[0];catalogChanged=true;}
   if(!Object.hasOwn(p,'material')){p.material=p.productId==='produto_01'?'Bronze':p.productId==='produto_02'?'Aço inoxidável':/bolsa/i.test(p.name)?'Couro':'';catalogChanged=true;}
   if(!Object.hasOwn(p,'dimensions')){p.dimensions=p.productId==='produto_02'?'Diâmetro: 38 mm · Espessura: 8 mm':'';catalogChanged=true;}
   if(!Object.hasOwn(p,'stock')){
    const stockValues=(p.variants||[]).map(v=>v.stock);
    p.stock=stockValues.length&&stockValues.every(Number.isSafeInteger)?stockValues.reduce((sum,value)=>sum+value,0):null;
    catalogChanged=true;
   }
   if(typeof p.allowBackorder!=='boolean'){p.allowBackorder=(p.variants||[]).some(v=>v.allowBackorder===true);catalogChanged=true;}
   for(const v of p.variants||[])if(typeof v.enabled!=='boolean'){v.enabled=true;catalogChanged=true;}
   if(p.category==='Dobrões'&&!(p.variants||[]).some(v=>v.id==='sem_gravacao')){
    p.variants.push({id:'sem_gravacao',label:'Sem gravação',enabled:true,stock:null,allowBackorder:true});
    catalogChanged=true;
   }
  }
  if(catalogChanged)await tx.put('settings','catalog',products);
  const done=await tx.get('settings',catalogPriceMigration);
  if(!done){
   let changed=false;
   for(const p of products){
    if((p.productId==='produto_01'||p.productId==='produto_02')&&p.priceCents!==10000){
     p.priceCents=10000;changed=true;
    }
   }
   if(changed)await tx.put('settings','catalog',products);
   await tx.put('settings',catalogPriceMigration,{completedAt:new Date().toISOString()});
  }
  return products;
 };
 function checkToken(o,token){if(!o||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(hash(token)),Buffer.from(o.tokenHash)))fail(404,'order_not_found','Link privado inválido.');}
 function safeOrder(o){const {tokenHash,customer,adminNotes,owner,...v}=o;v.items=o.items.map(({art,...i})=>({...i,art:art?{name:art.name}:null}));return v;}
 function lines(input,products){
  if(!Array.isArray(input)||!input.length||input.length>20)fail(400,'invalid_cart','Escolha de 1 a 20 itens.');
  let total=0;const units=new Map(),items=input.map(raw=>{
   if(!plain(raw))fail(400,'invalid_item','Item inválido.');
   const p=products.find(p=>p.productId===raw.productId);
   if(!p?.enabled)fail(409,'unavailable_product','Produto indisponível.');
   const v=p.variants.find(v=>v.id===raw.variantId&&v.enabled!==false);
   if(!v)fail(400,'invalid_variant','Escolha um acabamento válido.');
   if(!Number.isSafeInteger(raw.quantity)||raw.quantity<1||raw.quantity>100)fail(400,'invalid_quantity','Quantidade inválida.');
   const used=(units.get(p.productId)||0)+raw.quantity;units.set(p.productId,used);
   if(p.stock!==null&&used>p.stock&&!p.allowBackorder)fail(409,'out_of_stock','Estoque insuficiente: '+p.name+'.');
   let engravingNotes=cleanText(raw.engravingNotes||'',500),front=validateImage(raw.front),back=validateImage(raw.back);
   if(raw.engraving||raw.art)fail(400,'invalid_customization','Gravação somente por imagens; use observações para instruções.');
   const supportsEngraving=['gravado','lapidado'].includes(v.id);
   if(!supportsEngraving&&(front||back||engravingNotes&&engravingNotes!=='Sem gravação'))fail(400,'invalid_customization','Personalização disponível somente nos dobrões.');
   if(v.id==='sem_gravacao'){if(front||back)fail(400,'invalid_customization','Sem gravação não aceita arquivos.');engravingNotes='Sem gravação';}
   const subtotal=p.priceCents*raw.quantity;total+=subtotal;
   return {productId:p.productId,name:p.name,variantId:v.id,variantLabel:v.label,quantity:raw.quantity,unitPrice:p.priceCents,subtotal,engravingNotes,front,back,backorder:p.stock!==null&&used>p.stock,productionDays:p.productionDays};
  });
  if(total>100000000)fail(400,'total_limit','Valor acima do limite.');
  return {items,total};
 }
 async function createOrder(raw,owner,key){if(!plain(raw)||!/^[a-f0-9-]{36}$/.test(key||''))fail(400,'invalid_order','Tentativa inválida.');const customer=contact(raw.customer),notes=cleanText(raw.notes||'',1000),group=cleanText(raw.group||'',100),requestHash=hash(JSON.stringify(raw));return db.transaction(async tx=>{const previous=await tx.get('requests',owner+':'+key);if(previous){if(previous.hash!==requestHash)fail(409,'idempotency_conflict','A tentativa já foi usada com outros dados.');return {...safeOrder(await tx.get('orders',previous.orderId)),trackingUrl:config.baseURL+'/acompanhar#order='+previous.orderId+'&token='+previous.token};}const calculated=lines(raw.items,await catalog(tx)),token=randomBytes(32).toString('hex'),id=randomUUID(),at=new Date().toISOString(),counter=(await tx.get('settings','counter'))||{value:1000};counter.value++;const o={orderId:id,orderCode:'SB'+counter.value,createdAt:at,updatedAt:at,customer,group,notes,items:calculated.items,productsTotal:calculated.total,total:calculated.total,shippingCents:null,paymentConfirmed:false,status:'requested',trackingCode:'',adminNotes:'',inventoryCommitted:false,history:[{status:'requested',at}],tokenHash:hash(token),owner};await tx.put('settings','counter',counter);await tx.put('orders',id,o);await tx.put('requests',owner+':'+key,{hash:requestHash,orderId:id,token});return {...safeOrder(o),trackingUrl:config.baseURL+'/acompanhar#order='+id+'&token='+token};});}
 async function reconcileMercadoPagoOrder(remote){
  if(!plain(remote)||typeof remote.external_reference!=='string'||typeof remote.id!=='string')fail(400,'invalid_provider_order','Order do Mercado Pago inválida.');
  const id=remote.external_reference;
  if(!/^[0-9a-f-]{36}$/i.test(id))fail(400,'invalid_reference','Referência inválida.');
  return db.transaction(async tx=>{
   const o=await tx.get('orders',id);
   if(!o||!o.mercadoPagoOrderId||o.mercadoPagoOrderId!==remote.id)fail(409,'provider_order_mismatch','Order não associada ao pedido.');
   const expected=(o.total/100).toFixed(2);
   if(String(remote.total_amount)!==expected)fail(409,'amount_mismatch','Valor divergente.');
   const payments=remote.transactions?.payments;
   const paid=remote.status==='processed'&&remote.status_detail==='accredited'&&Array.isArray(payments)&&payments.length>0&&payments.every(p=>p.status==='processed'&&p.status_detail==='accredited')&&payments.every(p=>Number.isFinite(Number(p.amount)))&&payments.reduce((sum,p)=>sum+Math.round(Number(p.amount)*100),0)===o.total;
   o.mercadoPagoStatus=String(remote.status||'unknown').slice(0,60);
   if(paid){o.paymentConfirmed=true;o.paymentConfirmedAt=o.paymentConfirmedAt||new Date().toISOString();}
   o.updatedAt=new Date().toISOString();
   await tx.put('orders',id,o);
   return {orderId:id,paymentConfirmed:o.paymentConfirmed,providerStatus:o.mercadoPagoStatus};
  });
 }
 async function bindMercadoPagoOrder(id,owner,remote,totalCents,shippingCents){
  if(!plain(remote)||typeof remote.id!=='string'||!remote.id||remote.external_reference!==id)fail(400,'invalid_provider_order','Order inválida.');
  if(!Number.isSafeInteger(totalCents)||!Number.isSafeInteger(shippingCents)||shippingCents<0)fail(400,'invalid_amount','Valor inválido.');
  return db.transaction(async tx=>{
   const o=await tx.get('orders',id);
   if(!o||o.owner!==owner)fail(404,'order_not_found','Pedido não encontrado.');
   if(o.mercadoPagoOrderId&&o.mercadoPagoOrderId!==remote.id)fail(409,'order_already_bound','Pedido já possui cobrança.');
   if(o.productsTotal+shippingCents!==totalCents)fail(409,'amount_mismatch','Total divergente.');
   o.mercadoPagoOrderId=remote.id;o.shippingCents=shippingCents;o.total=totalCents;o.mercadoPagoStatus=String(remote.status||'unknown').slice(0,60);o.updatedAt=new Date().toISOString();
   await tx.put('orders',id,o);
   return {orderId:id,providerOrderId:remote.id};
  });
 }
 async function updateOrder(id,raw){return db.transaction(async tx=>{
  const o=await tx.get('orders',id);if(!o)fail(404,'order_not_found','Pedido não encontrado.');
  if(!plain(raw)||!Object.hasOwn(statusLabels,raw.status)||typeof raw.paymentConfirmed!=='boolean')fail(400,'invalid_status','Atualização inválida.');
  if(['production','shipped','delivered'].includes(raw.status)&&!raw.paymentConfirmed)fail(409,'payment_required','Confirme o pagamento recebido antes da produção ou envio.');
  if(o.status==='cancelled'&&raw.status!=='cancelled')fail(409,'terminal_order','Pedido cancelado não pode ser reaberto.');
  if(o.status==='delivered'&&raw.status==='cancelled')fail(409,'delivered_order','Pedido entregue exige atendimento para devolução.');
  const products=await catalog(tx);
  if(raw.paymentConfirmed&&!o.inventoryCommitted&&raw.status!=='cancelled'){
   const demand=new Map();for(const item of o.items)demand.set(item.productId,(demand.get(item.productId)||0)+item.quantity);
   o.stockDeductions=[];
   for(const [pid,quantity] of demand){
    const product=products.find(item=>item.productId===pid);if(!product)fail(409,'product_removed','Um produto deste pedido não está mais disponível.');
    if(product.stock!==null){
     if(product.stock<quantity&&!product.allowBackorder)fail(409,'out_of_stock','Estoque insuficiente: '+product.name+'.');
     const deducted=Math.min(quantity,product.stock);product.stock-=deducted;o.stockDeductions.push({pid,quantity:deducted});
    }
   }
   o.inventoryCommitted=true;await tx.put('settings','catalog',products);
  }
  if(raw.status==='cancelled'&&o.inventoryCommitted){
   for(const deduction of o.stockDeductions||[]){
    const product=products.find(item=>item.productId===deduction.pid);
    if(product&&Number.isSafeInteger(product.stock))product.stock+=deduction.quantity;
    else if(product&&deduction.vid){const variant=product.variants.find(item=>item.id===deduction.vid);if(variant&&Number.isSafeInteger(variant.stock))variant.stock+=deduction.quantity;}
   }
   o.inventoryCommitted=false;await tx.put('settings','catalog',products);
  }
  if(o.status!==raw.status)o.history.push({status:raw.status,at:new Date().toISOString()});
  o.status=raw.status;o.paymentConfirmed=raw.paymentConfirmed;o.trackingCode=cleanText(raw.trackingCode||'',100);o.adminNotes=cleanText(raw.adminNotes||'',1000);
  if(raw.shippingCents!==null&&(!Number.isSafeInteger(raw.shippingCents)||raw.shippingCents<0||raw.shippingCents>1000000))fail(400,'invalid_shipping','Frete inválido.');
  o.shippingCents=raw.shippingCents;o.total=o.productsTotal+(o.shippingCents||0);o.updatedAt=new Date().toISOString();await tx.put('orders',id,o);return o;
 });}
 return {db,catalog,createOrder,updateOrder,bindMercadoPagoOrder,reconcileMercadoPagoOrder,safeOrder,checkToken,async categories(){return categoryList();},async categoryMutation(action,raw,oldName){return db.transaction(async tx=>{const names=await categoryList(tx),products=await catalog(tx),name=cleanText(raw?.name,60,true),same=v=>v.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR');if(action==='create'){if(names.some(same))fail(409,'duplicate_category','Esta categoria já existe.');names.push(name);}else if(action==='rename'){const index=names.findIndex(v=>v===oldName);if(index<0)fail(404,'category_not_found','Categoria não encontrada.');if(names.some((v,i)=>i!==index&&same(v)))fail(409,'duplicate_category','Esta categoria já existe.');for(const p of products)if(p.category===oldName)p.category=name;names[index]=name;await tx.put('settings','catalog',products);}else if(action==='delete'){if(!names.includes(oldName))fail(404,'category_not_found','Categoria não encontrada.');if(products.some(p=>p.category===oldName))fail(409,'category_in_use','Mova os produtos desta categoria antes de excluí-la.');if(names.length===1)fail(409,'last_category','A loja precisa manter pelo menos uma categoria.');names.splice(names.indexOf(oldName),1);}else fail(400,'invalid_category_action','Ação de categoria inválida.');await tx.put('settings','categories',names);return names;});},async deleteProduct(id){return this.bulkProducts('delete',[id]);},async bulkProducts(action,ids){return db.transaction(async tx=>{
 const list=await catalog(tx);
 if(!['delete','deactivate'].includes(action)||!Array.isArray(ids)||!ids.length||ids.length>50||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))fail(400,'invalid_bulk_action','Selecione produtos válidos.');
 const selected=ids.map(id=>list.find(p=>p.productId===id));
 if(selected.some(p=>!p))fail(404,'product_not_found','Um dos produtos selecionados não foi encontrado.');
 if(action==='deactivate'){for(const product of selected)product.enabled=false;await tx.put('settings','catalog',list);return {updated:true,productIds:ids};}
 for(const product of selected){
  const referenced=await store.hasProductInOrders?.(product.productId);
  const customOrders=await tx.list('orders');
  if(referenced||customOrders.some(order=>(order.items||[]).some(item=>item.productId===product.productId)))fail(409,'product_in_orders',product.name+' aparece em pedidos existentes. Use “Remover da loja” para preservar o histórico.');
 }
 await tx.put('settings','catalog',list.filter(product=>!ids.includes(product.productId)));
 return {deleted:true,productIds:ids};
 });},async reorderProducts(ids){return db.transaction(async tx=>{
 const list=await catalog(tx),known=new Set(list.map(product=>product.productId));
 if(!Array.isArray(ids)||ids.length!==list.length||new Set(ids).size!==ids.length||ids.some(id=>!known.has(id)))fail(400,'invalid_product_order','A ordem dos produtos é inválida.');
 const ordered=ids.map(id=>list.find(product=>product.productId===id));await tx.put('settings','catalog',ordered);return {productIds:ids};
 });},async productMutation(raw,id){return db.transaction(async tx=>{const list=await catalog(tx),names=await categoryList(tx),old=list.find(p=>p.productId===id);if(id&&!old)fail(404,'product_not_found','Produto não encontrado.');const p=validateProduct(raw,old);if(!names.includes(p.category))fail(400,'invalid_category','Selecione uma categoria existente.');if(!old&&list.some(v=>v.productId===p.productId))fail(409,'duplicate_product','Identificador já utilizado.');if(old&&old.variants.some(v=>!p.variants.some(n=>n.id===v.id)))fail(409,'variant_removal','Preserve as opções existentes para manter o histórico.');await tx.put('settings','catalog',old?list.map(v=>v.productId===id?p:v):[...list,p]);return p;});},async track(id,token){const o=await db.get('orders',id);checkToken(o,token);if(!o.paymentConfirmed)fail(403,'payment_required','O acompanhamento estará disponível após a confirmação do pagamento.');return safeOrder(o);},async reviews(pid){return (await db.list('reviews')).filter(r=>r.productId===pid&&r.approved).map(({rating,comment,displayName,createdAt,photo,id})=>({id,rating,comment,displayName,createdAt,photo:photo?'/api/commerce/review-photo/'+id:null,verified:true}));},async review(raw){if(!plain(raw))fail(400,'invalid_review','Avaliação inválida.');return db.transaction(async tx=>{const o=await tx.get('orders',raw.orderId);checkToken(o,raw.token);if(!o.paymentConfirmed||o.status!=='delivered'||!o.items.some(i=>i.productId===raw.productId))fail(403,'review_not_eligible','Avaliações disponíveis após pagamento e entrega.');const id=hash(o.orderId+':'+raw.productId);if(await tx.get('reviews',id))fail(409,'duplicate_review','Você já avaliou este produto.');if(!Number.isInteger(raw.rating)||raw.rating<1||raw.rating>5)fail(400,'invalid_rating','Selecione de uma a cinco estrelas.');await tx.put('reviews',id,{id,orderId:o.orderId,productId:raw.productId,rating:raw.rating,comment:cleanText(raw.comment,1000,true),displayName:o.customer.name.split(' ')[0],photo:validateImage(raw.photo),approved:false,createdAt:new Date().toISOString()});return {submitted:true,message:'Avaliação recebida para moderação.'};});},async group(raw){if(!plain(raw))fail(400,'invalid_group','Solicitação inválida.');const customer=contact(raw.customer),group=cleanText(raw.group,100,true),notes=cleanText(raw.notes,2000,true),quantity=raw.quantity;if(!Number.isInteger(quantity)||quantity<1||quantity>10000)fail(400,'invalid_quantity','Informe a quantidade desejada.');const art=validateImage(raw.art),id=randomUUID();await db.put('groups',id,{id,customer,group,notes,quantity,art,status:'new',createdAt:new Date().toISOString()});return {id,message:'Solicitação registrada. A loja vai confirmar valores e prazo com você.'};}};
}
export function mountCommerce(app,{commerce,session,mutation,limit,config,notifyPaidCommerceOrder=async()=>{}}){
 const durable=(req,res,next)=>{if(config.durableStorage===false)fail(503,'storage_required','O recebimento de pedidos está temporariamente indisponível.');next();};
 app.get('/api/commerce/catalog',async(req,res)=>res.json({products:await commerce.catalog(),categories:await commerce.categories(),ordersConfigured:config.durableStorage!==false,statusLabels}));
 app.post('/api/commerce/shipping/quote',limit(15),session,mutation,async(req,res)=>{
  const cep=postalCode(req.body?.cep),items=req.body?.items;
  if(!Array.isArray(items)||items.length<1||items.length>20)fail(400,'invalid_cart','Informe os produtos para cotar o frete.');
  const products=await commerce.catalog();let units=0;
  for(const item of items){const product=products.find(p=>p.productId===item?.productId&&p.enabled);if(!product||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>100)fail(400,'invalid_cart','Confira os produtos e quantidades.');units+=item.quantity;}
  if(units>100)fail(400,'invalid_cart','Quantidade acima do limite para cotação.');
  const provider=createShippingProvider();
  if(!provider.configured)fail(503,'shipping_not_configured','O frete automático ainda não está configurado.');
  const options=await provider.quote(items,cep);
  res.json({options:options.map(o=>({...o,priceCents:o.priceCents}))});
 });
 app.post('/api/commerce/orders',limit(10),durable,session,mutation,async(req,res)=>res.status(201).json(await commerce.createOrder(req.body,req.shopSession.id,req.get('idempotency-key'))));
 app.post('/api/commerce/orders/:id/pix',limit(5),durable,session,mutation,async(req,res)=>{
  if(config.mode!=='production'||!config.accessToken||!config.webhookSecret)fail(503,'payments_unavailable','Pix real não está disponível.');
  const {email,cep,serviceCode}=req.body||{};
  if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||email.length>200)fail(400,'invalid_email','Informe um e-mail válido.');
  if(typeof serviceCode!=='string'||serviceCode.length>40)fail(400,'invalid_shipping','Escolha uma modalidade de frete.');
  const order=await commerce.db.get('orders',req.params.id);
  if(!order||order.owner!==req.shopSession.id)fail(404,'order_not_found','Pedido não encontrado.');
  if(order.customer?.email&&order.customer.email!==email.trim().toLowerCase())fail(409,'customer_email_mismatch','Use o mesmo e-mail informado nos dados do pedido.');
  if(order.paymentConfirmed||order.status!=='requested')fail(409,'order_unavailable','Pedido indisponível para cobrança.');
  const gateway=createOrdersGateway({accessToken:config.accessToken});
  if(order.mercadoPagoOrderId){
   const remote=await gateway.getOrder(order.mercadoPagoOrderId);
   const reconciled=await commerce.reconcileMercadoPagoOrder(remote);
   await notifyPaidCommerceOrder(await commerce.db.get('orders',reconciled.orderId));
   return res.json({orderId:order.orderId,providerStatus:remote.status,pix:extractOrdersPix(remote)});
  }
  const provider=createShippingProvider();
  if(!provider.configured)fail(503,'shipping_not_configured','Frete indisponível.');
  const options=await provider.quote(order.items.map(i=>({productId:i.productId,quantity:i.quantity})),postalCode(cep));
  const selected=options.find(o=>String(o.serviceCode)===serviceCode);
  if(!selected)fail(409,'shipping_changed','Recalcule e selecione o frete.');
  const shippingCents=selected.priceCents,totalCents=order.productsTotal+shippingCents;
  const key=req.get('idempotency-key');
  if(!/^[0-9a-f-]{36}$/i.test(key||''))fail(400,'invalid_key','Atualize a página e tente novamente.');
  const paymentKey=hash('mercadopago-orders-pix:'+order.orderId).slice(0,8)+'-'+hash('mercadopago-orders-pix:'+order.orderId).slice(8,12)+'-'+hash('mercadopago-orders-pix:'+order.orderId).slice(12,16)+'-'+hash('mercadopago-orders-pix:'+order.orderId).slice(16,20)+'-'+hash('mercadopago-orders-pix:'+order.orderId).slice(20,32);const remote=await gateway.createPix({reference:order.orderId,totalCents,email,idempotencyKey:paymentKey});
  await commerce.bindMercadoPagoOrder(order.orderId,req.shopSession.id,remote,totalCents,shippingCents);
  const reconciled=await commerce.reconcileMercadoPagoOrder(remote);
  await notifyPaidCommerceOrder(await commerce.db.get('orders',reconciled.orderId));
  res.json({orderId:order.orderId,providerStatus:remote.status,pix:extractOrdersPix(remote)});
 });
 app.post('/api/commerce/orders/:id/card',limit(5),durable,session,mutation,async(req,res)=>{
  if(config.mode!=='production'||!config.accessToken||!config.webhookSecret||!config.publicKey)fail(503,'payments_unavailable','Cartão indisponível.');
  const {email,cep,serviceCode,card}=req.body||{};
  if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||email.length>200)fail(400,'invalid_email','Informe um e-mail válido.');
  if(typeof serviceCode!=='string'||serviceCode.length>40)fail(400,'invalid_shipping','Selecione o frete.');
  if(!card||typeof card!=='object')fail(400,'invalid_card','Dados do cartão inválidos.');
  const order=await commerce.db.get('orders',req.params.id);
  if(!order||order.owner!==req.shopSession.id)fail(404,'order_not_found','Pedido não encontrado.');
  if(order.customer?.email&&order.customer.email!==email.trim().toLowerCase())fail(409,'customer_email_mismatch','Use o mesmo e-mail informado nos dados do pedido.');
  if(order.paymentConfirmed||order.status!=='requested')fail(409,'order_unavailable','Pedido indisponível.');
  if(order.mercadoPagoOrderId)fail(409,'payment_in_progress','Já existe cobrança para este pedido. Consulte o status antes de tentar novamente.');
  const provider=createShippingProvider();
  if(!provider.configured)fail(503,'shipping_not_configured','Frete indisponível.');
  const options=await provider.quote(order.items.map(i=>({productId:i.productId,quantity:i.quantity})),postalCode(cep));
  const selected=options.find(o=>String(o.serviceCode)===serviceCode);
  if(!selected)fail(409,'shipping_changed','Recalcule o frete.');
  const shippingCents=selected.priceCents,totalCents=order.productsTotal+shippingCents;
  const key=req.get('idempotency-key');
  if(!/^[0-9a-f-]{36}$/i.test(key||''))fail(400,'invalid_key','Chave de tentativa inválida.');
  const remote=await createOrdersGateway({accessToken:config.accessToken}).createCard({reference:order.orderId,totalCents,email,cardToken:card.token,paymentMethodId:card.paymentMethodId,paymentMethodType:card.paymentMethodType||'credit_card',installments:card.installments,idempotencyKey:key});
  await commerce.bindMercadoPagoOrder(order.orderId,req.shopSession.id,remote,totalCents,shippingCents);
  const reconciled=await commerce.reconcileMercadoPagoOrder(remote);
  await notifyPaidCommerceOrder(await commerce.db.get('orders',reconciled.orderId));
  res.json({orderId:order.orderId,providerStatus:remote.status,paymentConfirmed:(await commerce.db.get('orders',order.orderId)).paymentConfirmed});
 });
 app.get('/api/commerce/payment-config',limit(30),session,(req,res)=>res.json({cardConfigured:Boolean(config.mode==='production'&&config.publicKey&&config.accessToken&&config.webhookSecret),publicKey:config.mode==='production'?config.publicKey:''}));
 app.get('/api/commerce/orders/:id/payment-status',limit(20),session,async(req,res)=>{
  const order=await commerce.db.get('orders',req.params.id);
  if(!order||order.owner!==req.shopSession.id)fail(404,'order_not_found','Pedido não encontrado.');
  if(order.mercadoPagoOrderId){const remote=await createOrdersGateway({accessToken:config.accessToken}).getOrder(order.mercadoPagoOrderId);await commerce.reconcileMercadoPagoOrder(remote);}
  const current=await commerce.db.get('orders',req.params.id);
  await notifyPaidCommerceOrder(current);
  res.json({paymentConfirmed:current.paymentConfirmed,status:current.mercadoPagoStatus||'pending'});
 });

 app.get('/api/commerce/orders/:id',limit(30),async(req,res)=>res.json(await commerce.track(req.params.id,String(req.get('authorization')||'').replace(/^Bearer /,''))));
 app.get('/api/commerce/reviews/:productId',async(req,res)=>res.json({reviews:await commerce.reviews(req.params.productId)}));
 app.post('/api/commerce/reviews',limit(5),durable,session,mutation,async(req,res)=>res.status(201).json(await commerce.review(req.body)));
 app.post('/api/commerce/groups',limit(5),durable,session,mutation,async(req,res)=>res.status(201).json(await commerce.group(req.body)));
 app.get('/api/commerce/media/:id',async(req,res)=>{const media=await commerce.db.get('media',req.params.id);if(!media)fail(404,'not_found','Imagem não encontrada.');const [head,data]=media.data.split(',');res.type(head.slice(5).split(';')[0]).send(Buffer.from(data,'base64'));});
 app.get('/api/commerce/review-photo/:id',async(req,res)=>{const r=await commerce.db.get('reviews',req.params.id);if(!r?.approved||!r.photo)fail(404,'not_found','Imagem não encontrada.');const [head,data]=r.photo.data.split(',');res.type(head.slice(5).split(';')[0]).send(Buffer.from(data,'base64'));});
}
