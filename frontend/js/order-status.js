(()=>{
 'use strict';
 const get=s=>document.querySelector(s),cash=n=>(Number(n||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const pageUrl=new URL(location.href);const id=pageUrl.searchParams.get('orderId');let token=new URLSearchParams(pageUrl.hash.slice(1)).get('token')||pageUrl.searchParams.get('token')||'',polls=0,timer,busy=false,trackingUrl='';
 const paymentLabels={pending:'Aguardando pagamento',processing:'Pagamento em processamento',paid:'Pagamento confirmado',cancelled:'Pedido cancelado',refunded:'Pagamento reembolsado',partially_refunded:'Pagamento parcialmente reembolsado',failed:'Pagamento não concluído',in_mediation:'Pagamento em mediação',charged_back:'Pagamento contestado/estornado'};
 const fulfillmentLabels={awaiting_payment:'Aguardando pagamento',paid:'Pagamento confirmado',preparing:'Preparando seu pedido',shipped:'Pedido enviado',delivered:'Pedido entregue',hold:'Pedido em análise',cancelled:'Pedido cancelado'};
 const progressStages=[['paid','Pagamento confirmado'],['preparing','Preparando pedido'],['shipped','Pedido enviado'],['delivered','Entregue']];
 const progressRank={awaiting_payment:-1,paid:0,preparing:1,shipped:2,delivered:3};
 function effectiveFulfillment(order){const value=order.fulfillmentStatus||'awaiting_payment';return order.status==='paid'&&value==='awaiting_payment'?'paid':value;}
 function addressText(a={}){if(a.city&&!a.street)return `${a.city}/${a.state||''} — endereço completo protegido`;return [a.street&&`${a.street}, ${a.number||'s/n'}${a.complement?' · '+a.complement:''}`,a.district&&`${a.district} · ${a.city||''}/${a.state||''}`,a.cep&&`CEP ${a.cep}`].filter(Boolean).join(' — ')||'Endereço não disponível.';}
 function renderProgress(order){
  const box=get('#order-progress');if(!box)return;const status=effectiveFulfillment(order),rank=progressRank[status]??-1;
  box.replaceChildren(...progressStages.map(([key,label],index)=>{const li=document.createElement('li');li.className='order-progress-step';li.dataset.state=index<rank?'done':index===rank?'current':'upcoming';const dot=document.createElement('span');dot.className='order-progress-dot';dot.setAttribute('aria-hidden','true');dot.textContent=index<rank?'✓':String(index+1);const text=document.createElement('span');text.textContent=label;li.append(dot,text);return li;}));
  if(status==='hold'||status==='cancelled'){const li=document.createElement('li');li.className='order-progress-step interrupted';li.dataset.state='current';const dot=document.createElement('span');dot.className='order-progress-dot';dot.textContent='!';const text=document.createElement('span');text.textContent=fulfillmentLabels[status];li.append(dot,text);box.append(li);}
 }
 function setTrackingLink(url){
  if(!url)return;let parsed;try{parsed=new URL(url,location.origin);if(parsed.origin!==location.origin)return;}catch{return;}trackingUrl=parsed.href;token=new URLSearchParams(parsed.hash.slice(1)).get('token')||parsed.searchParams.get('token')||token;parsed.searchParams.delete('token');parsed.hash='token='+encodeURIComponent(token);trackingUrl=parsed.href;history.replaceState(null,'',parsed.pathname+parsed.search+parsed.hash);const copy=get('#copy-tracking-link');if(copy)copy.hidden=false;
 }
 async function createTrackingLink(){
  try{const response=await fetch('/api/tracking-link?orderId='+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)return;const data=await response.json();setTrackingLink(data.trackingUrl);}catch{}
 }
 async function fetchOrder(){
  const path=token?'/api/track?orderId='+encodeURIComponent(id):'/api/orders/'+encodeURIComponent(id);
  const response=await fetch(path,{headers:token?{Authorization:'Bearer '+token}:{},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});const order=await response.json();if(!response.ok)throw Error(order.message||'Pedido não encontrado.');if(order.trackingUrl)setTrackingLink(order.trackingUrl);else if(!token)await createTrackingLink();return order;
 }
 function messageFor(order){
  const f=effectiveFulfillment(order);if(order.status==='in_mediation')return'O pagamento está em mediação. Não realize uma nova cobrança para este pedido.';if(order.status==='charged_back')return'O pagamento foi contestado ou estornado pelo emissor.';if(order.status==='refunded'||order.status==='partially_refunded')return'O pagamento teve reembolso. Entre em contato com a loja se precisar de ajuda.';if(order.status==='failed'||order.status==='cancelled')return'O pagamento não foi concluído.';if(order.status==='pending'||order.status==='processing')return'Aguardando a confirmação do Mercado Pago. Esta página atualiza o pagamento automaticamente.';if(f==='preparing')return'Seu pagamento foi confirmado e o pedido está sendo preparado.';if(f==='shipped')return order.trackingCode?'Seu pedido foi enviado. Use o código de rastreio abaixo para acompanhar a transportadora.':'Seu pedido foi enviado. O código de rastreio será exibido assim que estiver disponível.';if(f==='delivered')return'O pedido foi marcado como entregue.';if(f==='hold')return'O pedido está em análise pela loja.';return'O pagamento foi confirmado. Acompanhe aqui cada etapa até a entrega.';
 }
 async function update(){
  if(busy)return;busy=true;const refresh=get('#refresh-order');if(refresh)refresh.disabled=true;clearTimeout(timer);
  try{
   if(!id||!/^[0-9a-f-]{36}$/i.test(id))throw Error('Nenhum pedido válido foi informado.');
   const order=await fetchOrder(),shipping=order.shipping||{},fulfillment=effectiveFulfillment(order);
   get('#order-status').textContent=fulfillmentLabels[fulfillment]||paymentLabels[order.status]||'Conferência pendente';get('#order-reference').textContent=`Pedido #${order.orderCode||order.orderId}`;get('#provider-order-reference').textContent=order.paymentMethod?`Pagamento: ${order.paymentMethod==='pix'?'Pix':'Cartão'}`:`Situação do pagamento: ${paymentLabels[order.status]||order.status}`;get('#order-products-total').textContent=cash(order.productsTotal);get('#order-shipping-total').textContent=cash(shipping.priceCents);get('#order-total').textContent=cash(order.total);get('#order-items').replaceChildren(...order.items.map(item=>{const li=document.createElement('li');li.textContent=`${item.quantity} × ${item.name} — ${cash(item.subtotal)}`;return li;}));
   get('#order-address').textContent=addressText(order.address);get('#order-shipping').textContent=shipping.name?`${shipping.name} · prazo estimado de ${shipping.days||'—'} dia(s) útil(eis) após postagem`:'Modalidade de entrega não disponível.';
   const tracking=get('#order-tracking');if(order.trackingCode){tracking.hidden=false;tracking.textContent=`Código de rastreio: ${order.trackingCode}`;}else{tracking.hidden=true;tracking.textContent='';}
   get('#order-message').textContent=messageFor(order);renderProgress(order);const cancel=get('#cancel-order');if(cancel)cancel.hidden=Boolean(order.status==='paid'||['preparing','shipped','delivered','cancelled'].includes(fulfillment)||['failed','refunded','charged_back'].includes(order.status));
   if(order.status==='paid'){
    try{if(sessionStorage.getItem('jewelry.pendingOrder')===order.orderId){const model=window.JewelryCartModel,items=model.clean(localStorage.getItem(model.KEY));const expected=order.items.map(({productId,quantity})=>({productId,quantity})).sort((a,b)=>a.productId.localeCompare(b.productId));if(JSON.stringify(items)===JSON.stringify(expected))localStorage.setItem(model.KEY,JSON.stringify({items:[]}));sessionStorage.removeItem('jewelry.pendingOrder');sessionStorage.removeItem('jewelry.paymentAttempt.'+order.orderId);sessionStorage.removeItem('jewelry.cardPrepare');}}catch{}
   }
   if(['pending','processing','in_mediation'].includes(order.status)&&polls++<60)timer=setTimeout(update,5000);else if(!['delivered','cancelled'].includes(fulfillment)&&polls++<120)timer=setTimeout(update,30000);
  }catch(e){get('#order-status').textContent='Pagamento não confirmado';get('#order-message').textContent=e.message;}
  finally{busy=false;if(refresh)refresh.disabled=false;}
 }
 const refresh=get('#refresh-order');if(refresh)refresh.addEventListener('click',()=>{polls=0;update();});
 const cancel=get('#cancel-order');if(cancel)cancel.addEventListener('click',async()=>{if(!token||!confirm('Cancelar este pedido? Esta ação não poderá ser desfeita.'))return;cancel.disabled=true;try{const response=await fetch('/api/cancel-order?orderId='+encodeURIComponent(id),{method:'POST',headers:{Authorization:'Bearer '+token},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.message||'Não foi possível cancelar o pedido.');polls=0;await update();}catch(error){get('#order-message').textContent=error.message;}finally{cancel.disabled=false;}});
 const copy=get('#copy-tracking-link');if(copy)copy.addEventListener('click',async()=>{if(!trackingUrl)return;try{await navigator.clipboard.writeText(trackingUrl);copy.textContent='Link copiado';setTimeout(()=>{if(copy)copy.textContent='Copiar link de acompanhamento';},1800);}catch{copy.textContent='Copie o endereço desta página';}});
 const support=document.getElementById('support-form');
 if(support)support.addEventListener('submit',async e=>{e.preventDefault();const output=get('#support-message'),button=support.querySelector('button');button.disabled=true;try{if(!token)await createTrackingLink();if(!token)throw Error('Abra seu link privado de acompanhamento para registrar a solicitação.');const response=await fetch('/api/order-support?orderId='+encodeURIComponent(id)+'&kind='+encodeURIComponent(get('#support-kind').value),{method:'POST',headers:{Authorization:'Bearer '+token},credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw Error(data.message||'Não foi possível registrar.');output.textContent=data.message+' Protocolo: '+data.receipt.id+' — '+new Date(data.receipt.createdAt).toLocaleString('pt-BR');}catch(error){output.textContent=error.message;}finally{button.disabled=false;}});
 if(token)setTrackingLink(location.href);
 update();
})();


