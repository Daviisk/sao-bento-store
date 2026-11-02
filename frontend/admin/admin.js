(()=>{
 'use strict';
 const $=s=>document.querySelector(s),cash=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),date=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const labels={pending:'Aguardando',processing:'Processando',paid:'Pago',cancelled:'Cancelado',refunded:'Reembolsado',partially_refunded:'Reembolso parcial',failed:'Falhou',in_mediation:'Mediação',charged_back:'Chargeback',awaiting_payment:'Aguardando pagamento',preparing:'Em preparação',shipped:'Enviado',delivered:'Entregue',hold:'Em análise'};
 const api=async(path,options={})=>{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,signal:options.signal||AbortSignal.timeout(15000)});let d=null;try{d=await r.json();}catch{}if(!r.ok)throw Error(d?.message||'Não foi possível concluir.');return d;};
 const loginView=$('#login-view'),appView=$('#app-view'),ordersView=$('#orders-view'),customersView=$('#customers-view');
 const panelMessage=text=>{$('#panel-message').textContent=text||'';};
 function showApp(){loginView.hidden=true;appView.hidden=false;loadOrders();}
 function showLogin(message=''){if($('#order-dialog').open)$('#order-dialog').close();appView.hidden=true;loginView.hidden=false;$('#login-message').textContent=message;}
 async function session(){try{const s=await api('/api/admin/session');if(s.authenticated)showApp();else showLogin(s.configured?'':'Configure ADMIN_PASSWORD e ADMIN_SESSION_SECRET no servidor.');}catch{showLogin('Não foi possível abrir o painel.');}}
 $('#toggle-password').addEventListener('click',()=>{const input=$('#admin-password'),show=input.type==='password';input.type=show?'text':'password';$('#toggle-password').textContent=show?'Ocultar':'Mostrar';$('#toggle-password').setAttribute('aria-pressed',String(show));$('#toggle-password').setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');input.focus({preventScroll:true});});
 $('#login-form').addEventListener('submit',async e=>{e.preventDefault();const button=$('#login-submit'),password=$('#admin-password');if(button.disabled)return;button.disabled=true;button.textContent='Verificando acesso…';$('#login-message').textContent='';try{await api('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('#admin-email').value,password:password.value})});password.value='';password.type='password';$('#toggle-password').textContent='Mostrar';$('#toggle-password').setAttribute('aria-pressed','false');showApp();}catch(err){showLogin(err.message);password.focus({preventScroll:true});password.select();}finally{button.disabled=false;button.textContent='Entrar no painel →';}});
 $('#logout').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}catch{}showLogin();});
 function badge(status){const cls=String(status||'').replace(/[^a-z_]/g,'');return `<span class="badge ${cls}">${esc(labels[status]||status||'—')}</span>`;}
 function copyButton(value,label){return value?`<button type="button" class="copy-mini" data-copy="${encodeURIComponent(String(value))}">Copiar ${esc(label)}</button>`:'';}
 async function copyText(value,button){
  try{
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
   else{const area=document.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove();}
   const old=button.textContent;button.textContent='Copiado';setTimeout(()=>{button.textContent=old;},1200);
  }catch{panelMessage('Não foi possível copiar automaticamente.');}
 }
 function progress(order){
  const rank={awaiting_payment:0,paid:1,preparing:2,shipped:3,delivered:4};
  const stages=[['Pedido criado','awaiting_payment'],['Pagamento','paid'],['Preparação','preparing'],['Enviado','shipped'],['Entregue','delivered']],current=rank[order.fulfillmentStatus]??0,history=Array.isArray(order.fulfillmentHistory)?order.fulfillmentHistory:[];
  const historyDate=status=>history.findLast?.(item=>item?.to===status)?.at||[...history].reverse().find(item=>item?.to===status)?.at||'';
  const steps=stages.map(([name,status],index)=>{const when=historyDate(status)||(status==='awaiting_payment'?order.createdAt:'');return `<li class="${index<current?'done':index===current?'current':''}"><span>${index+1}</span><strong>${name}</strong>${when?`<small>${esc(date(when))}</small>`:''}</li>`;}).join('');
  const warning=order.fulfillmentStatus==='hold'?'<p class="progress-warning">Pedido em análise. Confira o pagamento antes de continuar a expedição.</p>':order.fulfillmentStatus==='cancelled'?'<p class="progress-warning">Pedido cancelado.</p>':'';
  return `<div class="progress-head"><strong>Andamento do pedido</strong><span>${esc(labels[order.fulfillmentStatus]||order.fulfillmentStatus)}</span></div><ol class="order-progress">${steps}</ol>${warning}`;
 }
 function addressText(a={}){return [a.street&&`${a.street}, ${a.number||'s/n'}${a.complement?' · '+a.complement:''}`,a.district&&`${a.district} · ${a.city||''}/${a.state||''}`,a.cep&&`CEP ${a.cep}`].filter(Boolean).join('\n');}
 async function loadOrders(){
  const q=$('#search').value.trim(),status=$('#payment-filter').value,fulfillment=$('#fulfillment-filter').value,from=$('#date-from').value,to=$('#date-to').value;
  const params=new URLSearchParams({q,status,fulfillment,from,to,limit:'300'});panelMessage('Atualizando pedidos…');
  try{
   const data=await api('/api/admin/orders?'+params);
   const standardSummary=data.summary;
   const body=$('#orders-body');body.replaceChildren();
   for(const o of data.orders){const tr=document.createElement('tr'),customer=o.customer||{};tr.innerHTML=`<td><strong>#${esc(o.orderCode)}</strong>${(o.supportRequests||[]).some(r=>r.status==='open')?'<span class="badge">Atendimento pendente</span>':''}<span class="muted">${esc(o.paymentId||'sem pagamento')}</span></td><td>${esc(date(o.createdAt))}</td><td><strong>${esc(customer.name||'—')}</strong><span class="muted">${esc(customer.phone||'')}<br>${esc(customer.email||'')}</span></td><td>${(o.items||[]).reduce((n,i)=>n+Number(i.quantity||0),0)}</td><td><strong>${cash(o.total)}</strong></td><td>${badge(o.status)}</td><td>${badge(o.fulfillmentStatus)}</td><td><button class="open-order" data-id="${esc(o.orderId)}">Abrir</button></td>`;body.append(tr);}

   let customData={orders:[],statusLabels:{}};
   try{
    customData=await api('/api/admin/custom-orders');
    for(const o of custom.orders||[]){
     const searchable=[o.orderCode,o.orderId,o.customer?.name,o.customer?.phone,o.customer?.email,...(o.items||[]).map(i=>i.name)].join(' ').toLowerCase();
     if(q&&!searchable.includes(q.toLowerCase()))continue;
     if(status&&!(status==='paid'?o.paymentConfirmed:status==='pending'?!o.paymentConfirmed:false))continue;
     if(fulfillment&&o.status!==fulfillment)continue;
     const created=String(o.createdAt||'').slice(0,10);
     if((from&&created<from)||(to&&created>to))continue;
     const tr=document.createElement('tr');
     tr.innerHTML='<td><strong>#'+esc(o.orderCode)+'</strong><span class="muted">Personalizado</span></td><td>'+esc(date(o.createdAt))+'</td><td><strong>'+esc(o.customer?.name||'—')+'</strong><span class="muted">'+esc(o.customer?.phone||'')+'</span></td><td>'+(o.items||[]).reduce((n,i)=>n+Number(i.quantity||0),0)+'</td><td><strong>'+cash(o.total)+'</strong></td><td>'+(o.paymentConfirmed?'Confirmado':'Pendente')+'</td><td>'+esc(customData.statusLabels?.[o.status]||o.status)+'</td><td><button class="open-custom-order" type="button">Abrir</button></td>';
     tr.querySelector('.open-custom-order').addEventListener('click',()=>openCustomOrder(o));
     body.append(tr);
    }
   }catch(error){panelMessage('Pedidos personalizados indisponíveis: '+error.message);}
   const customOrders=customData.orders||[];
   const customPaid=customOrders.filter(o=>o.paymentConfirmed&&o.status!=='cancelled');
   const customPending=customOrders.filter(o=>!o.paymentConfirmed&&o.status!=='cancelled');
   const customRevenue=customPaid.reduce((sum,o)=>sum+Number(o.total||0),0);
   const paidCount=Number(standardSummary.paid||0)+customPaid.length;
   const paidRevenue=Number(standardSummary.revenuePaid||0)+customRevenue;
   const customInStatus=status=>customOrders.filter(o=>o.paymentConfirmed&&o.status===status).length;
   $('#stat-total').textContent=Number(standardSummary.total||0)+customOrders.length;
   $('#stat-paid').textContent=paidCount;
   $('#stat-awaiting-payment').textContent=Number(standardSummary.awaitingPayment||0)+customPending.length;
   $('#stat-awaiting-shipment').textContent=Number(standardSummary.awaitingShipment||0)+customInStatus('paid');
   $('#stat-preparing').textContent=Number(standardSummary.preparing||0)+customInStatus('preparing');
   $('#stat-shipped').textContent=Number(standardSummary.shipped||0)+customInStatus('shipped');
   $('#stat-revenue').textContent=cash(paidRevenue);
   $('#stat-ticket').textContent=cash(paidCount?paidRevenue/paidCount:0);
   $('#orders-empty').hidden=body.children.length===0;body.querySelectorAll('.open-order').forEach(b=>b.addEventListener('click',()=>openOrder(b.dataset.id)));panelMessage(`Atualizado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}.`);
  }catch(err){panelMessage(err.message);if(/login|painel/i.test(err.message))showLogin(err.message);}
 }

 function openCustomOrder(o){
  $('#dialog-title').textContent='Pedido #'+(o.orderCode||'');
  const cards=(o.items||[]).map(i=>{
   const arts=[['Frente',i.front],['Verso',i.back],['Arte',i.art]].filter(pair=>pair[1]?.data&&/^data:image\/(png|jpeg|webp);base64,/i.test(pair[1].data));
   const imgs=arts.map(pair=>'<a class="order-custom-art" href="'+esc(pair[1].data)+'" download="'+esc(pair[1].name||'arte.png')+'"><img src="'+esc(pair[1].data)+'" alt="Imagem personalizada '+pair[0]+'" loading="lazy"><span>'+pair[0]+' · Baixar</span></a>').join('');
   return '<section class="detail-card"><h3>'+esc(i.name)+'</h3><p>'+esc(i.variantLabel||'')+' · '+Number(i.quantity||1)+' unidade(s) · '+cash(i.subtotal)+'</p><p>'+esc(i.engravingNotes||i.engraving||'Sem observações')+'</p><div class="order-art-grid">'+(imgs||'<p class="muted">Nenhuma imagem enviada para este item.</p>')+'</div></section>';
  }).join('');
  $('#order-detail').innerHTML='<div class="detail-grid"><section class="detail-card"><h3>Cliente</h3><p><strong>'+esc(o.customer?.name||'—')+'</strong></p><p>'+esc(o.customer?.phone||'—')+'</p></section><section class="detail-card"><h3>Pagamento e andamento</h3><p>'+(o.paymentConfirmed?'Pagamento confirmado':'Pagamento pendente')+'</p><p>'+esc(o.status)+'</p><strong>'+cash(o.total)+'</strong></section></div><h3>Personalização e imagens</h3>'+cards+'<p><strong>Observações:</strong> '+esc(o.notes||'—')+'</p><button type="button" id="manage-custom-order">Gerenciar pedido</button>';
  $('#manage-custom-order').addEventListener('click',()=>{$('#order-dialog').close();window.dispatchEvent(new CustomEvent('admin:manage-custom-order',{detail:{id:o.orderId}}));});
  $('#order-dialog').showModal();
 }
 async function loadCustomers(){
  panelMessage('Atualizando clientes…');
  try{const data=await api('/api/admin/customers?'+new URLSearchParams({q:$('#customer-search').value.trim(),limit:'300'}));const body=$('#customers-body');body.replaceChildren();for(const c of data.customers){const tr=document.createElement('tr');tr.innerHTML=`<td><strong>${esc(c.name)}</strong><span class="muted">${esc(c.customerId)}</span></td><td>${esc(c.phone)}<br><span class="muted">${esc(c.email)}</span></td><td>${Number(c.orders||0)}</td><td>${cash(c.totalSpent)}</td><td>${esc(date(c.lastOrderAt))}</td>`;body.append(tr);}$('#customers-empty').hidden=data.customers.length>0;panelMessage(`Atualizado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}.`);}catch(err){panelMessage(err.message);if(/login|painel/i.test(err.message))showLogin(err.message);}
 }
 async function openOrder(id){
  try{
   const o=await api('/api/admin/orders/'+encodeURIComponent(id));$('#dialog-title').textContent=`Pedido #${o.orderCode}`;
   const customer=o.customer||{},a=o.address||{},s=o.shipping||{},address=addressText(a),items=(o.items||[]).map(i=>`<li>${Number(i.quantity||0)} × ${esc(i.name)} — ${cash(i.subtotal)}${i.engravingNotes?`<p class="muted">${esc(i.engravingNotes)}</p>`:''}${[['Frente',i.front],['Verso',i.back],['Arte',i.art]].map(([label,art])=>art?.data&&/^data:image\/(?:png|jpeg|webp);base64,/i.test(art.data)?`<a class="order-custom-art" href="${esc(art.data)}" download="${esc(art.name||'arte.png')}" aria-label="Baixar imagem ${label}"><img src="${esc(art.data)}" alt="Imagem personalizada: ${label}" loading="lazy"><span>${label} · Baixar imagem</span></a>`:'').join('')}</li>`).join('');
   $('#order-detail').innerHTML=`<section id="order-progress-wrap" class="progress-card">${progress(o)}</section><div class="detail-grid"><section class="detail-card"><h3>Cliente</h3><p><strong>${esc(customer.name||'—')}</strong></p><p>${esc(customer.phone||'—')}<br>${esc(customer.email||'—')}</p><div class="copy-row">${copyButton(customer.phone,'telefone')}${copyButton(customer.email,'e-mail')}</div><p class="muted">Cliente: ${esc(customer.customerId||'—')}</p></section><section class="detail-card"><h3>Pagamento</h3><p>${badge(o.status)}</p><p><strong>${cash(o.total)}</strong></p><p class="muted">Payment ID: ${esc(o.paymentId||'—')}<br>${esc(o.providerStatusDetail||'')}</p><div class="copy-row">${copyButton(o.paymentId,'Payment ID')}${copyButton(o.orderCode,'pedido')}</div></section><section class="detail-card"><h3>Entrega</h3><p>${esc(address).replaceAll('\n','<br>')||'—'}</p><p>${esc(s.name||'—')} · ${esc(s.days||'—')} dia(s)</p><div class="copy-row">${copyButton(address,'endereço')}${copyButton(o.trackingCode,'rastreio')}</div></section><section class="detail-card"><h3>Itens</h3><ul>${items}</ul><p>Produtos: ${cash(o.productsTotal)}<br>Frete: ${cash(s.priceCents)}<br><strong>Total: ${cash(o.total)}</strong></p></section></div><form id="fulfillment-form" class="detail-form"><label>Status da entrega<select id="fulfillment-status"><option value="awaiting_payment">Aguardando pagamento</option><option value="paid">Pago</option><option value="preparing">Em preparação</option><option value="shipped">Enviado</option><option value="delivered">Entregue</option><option value="hold">Em análise</option><option value="cancelled">Cancelado</option></select></label><label>Código de rastreio<input id="tracking-code" maxlength="100" value="${esc(o.trackingCode||'')}"></label><label>Observações<textarea id="admin-notes" maxlength="1000"></textarea></label><button type="submit">Salvar alterações</button><p id="detail-message" class="message" role="status"></p></form>`;
   const requests=document.createElement('section');requests.className='detail-card';const heading=document.createElement('h3');heading.textContent='Solicitações do cliente';requests.append(heading);for(const r of o.supportRequests||[]){const line=document.createElement('p');const kinds={withdrawal:'Arrependimento / devolução',defect:'Problema / defeito',privacy:'Privacidade',other:'Atendimento'};line.textContent=`${kinds[r.kind]||r.kind} — ${r.id} — ${date(r.createdAt)} — ${r.status}`;requests.append(line);}if(!(o.supportRequests||[]).length){const line=document.createElement('p');line.textContent='Nenhuma solicitação registrada.';requests.append(line);}$('#order-detail').prepend(requests);
   $('#fulfillment-status').value=o.fulfillmentStatus||'awaiting_payment';$('#admin-notes').value=o.adminNotes||'';
   $('#fulfillment-form').addEventListener('submit',async e=>{e.preventDefault();const button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;$('#detail-message').textContent='Salvando…';try{const saved=await api('/api/admin/orders/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fulfillmentStatus:$('#fulfillment-status').value,trackingCode:$('#tracking-code').value,adminNotes:$('#admin-notes').value})});$('#detail-message').textContent='Alterações salvas.';$('#order-progress-wrap').innerHTML=progress(saved);loadOrders();}catch(err){$('#detail-message').textContent=err.message;}finally{button.disabled=false;}});
   const deleteButton=document.createElement('button');deleteButton.type='button';deleteButton.id='delete-order';deleteButton.textContent='Excluir do painel';
   const deleteHelp=document.createElement('p');deleteHelp.textContent='Remove o pedido da listagem e dos indicadores de pedidos. Não cancela pagamentos; o histórico permanece no banco.';
   $('#order-detail').append(deleteHelp,deleteButton);
   deleteButton.addEventListener('click',async()=>{const confirmation=prompt(`Para excluir o pedido #${o.orderCode} do painel, digite ${o.orderCode}. O histórico será preservado; pagamentos não serão cancelados.`);if(confirmation===null)return;if(confirmation!==String(o.orderCode)){deleteHelp.textContent='Número diferente. O pedido não foi excluído.';return;}deleteButton.disabled=true;try{await api('/api/admin/orders/'+encodeURIComponent(id),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation})});$('#order-dialog').close();await loadOrders();panelMessage('Pedido removido do painel. Histórico preservado.');}catch(err){deleteHelp.textContent=err.message;deleteButton.disabled=false;}});
   $('#order-dialog').showModal();
  }catch(err){panelMessage(err.message);if(/login|painel/i.test(err.message))showLogin(err.message);}
 }
 $('#order-detail').addEventListener('click',e=>{const button=e.target.closest('[data-copy]');if(button)copyText(decodeURIComponent(button.dataset.copy),button);});
 $('#dialog-close').addEventListener('click',()=>$('#order-dialog').close());$('#refresh').addEventListener('click',()=>ordersView.hidden?loadCustomers():loadOrders());
 let timer;$('#search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(loadOrders,250);});for(const id of ['payment-filter','fulfillment-filter','date-from','date-to'])$('#'+id).addEventListener('change',loadOrders);$('#customer-search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(loadCustomers,250);});
 $('#clear-filters').addEventListener('click',()=>{for(const id of ['search','payment-filter','fulfillment-filter','date-from','date-to'])$('#'+id).value='';loadOrders();});
 document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',()=>{if(!['orders','customers'].includes(btn.dataset.view))return;document.getElementById('commerce-admin-view').hidden=true;document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n===btn));const customers=btn.dataset.view==='customers';ordersView.hidden=customers;customersView.hidden=!customers;$('#page-title').textContent=customers?'Clientes':'Pedidos';customers?loadCustomers():loadOrders();}));
 session();
})();


