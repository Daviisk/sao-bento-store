(()=>{
'use strict';const $=s=>document.querySelector(s),view=$('#commerce-admin-view'),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),cash=n=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});let active='',products=[],orders=[],categories=[];
const api=async(path,options={})=>{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,signal:AbortSignal.timeout(20000)}),d=await r.json();if(!r.ok)throw Error(d.message||'Falha ao carregar.');return d;};
const mutate=(path,body,method='PATCH')=>api(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function msg(t){$('#panel-message').textContent=t;}
async function image(input){const f=input.files[0];if(!f)return null;if(f.size>1048576||!['image/png','image/jpeg','image/webp'].includes(f.type))throw Error('Use JPG, PNG ou WebP até 1 MB.');return {name:f.name,data:await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);})};}
const finishDefinitions=[{id:'gravado',label:'Gravado'},{id:'lapidado',label:'Lapidado'},{id:'sem_gravacao',label:'Sem gravação'}];
function finishVariantsMarkup(p){
 const current=new Map((p.variants||[]).map(v=>[v.id,v]));
 return finishDefinitions.map(option=>'<label class="finish-option"><input type="checkbox" name="finish" value="'+option.id+'" '+(current.has(option.id)&&current.get(option.id).enabled!==false?'checked':'')+'><span>'+option.label+'</span></label>').join('');
}
function editProduct(p,isNew=false){
 let mainImage=isNew?'':(p.image||'');
 let galleryOrder=isNew?[]:(p.gallery||[]).filter(src=>src!==p.image);
 const removedGallery=new Set();
 const photoPreview='<div id="product-photo-preview-wrap" class="product-photo-preview-wrap">'+(mainImage?'<img id="product-photo-preview" src="'+esc(mainImage)+'" alt="Prévia da foto principal" width="150" height="150" loading="eager">':'<span id="product-photo-placeholder">Selecione uma foto principal</span>')+'</div>';
 const renderMainPreview=()=>{const wrap=$('#product-photo-preview-wrap');if(!wrap)return;wrap.innerHTML=mainImage?'<img id="product-photo-preview" src="'+esc(mainImage)+'" alt="Prévia da foto principal" width="150" height="150" loading="eager">':'<span id="product-photo-placeholder">Selecione uma foto principal</span>';};
 const drawGallery=()=>{
  const container=formGallery();
  if(!container)return;
  container.innerHTML=galleryOrder.map((src,i)=>{
   const removed=removedGallery.has(src);
   return '<div class="gallery-thumb'+(removed?' is-pending-remove':'')+'" data-gallery-item><img src="'+esc(src)+'" alt="Foto adicional '+(i+1)+'" loading="lazy" decoding="async"><span class="gallery-order-label">Foto '+(i+2)+'</span><div class="gallery-order-actions"><button type="button" class="gallery-order-button" data-move-gallery="'+esc(src)+'" data-direction="-1" aria-label="Mover foto '+(i+2)+' para cima" '+(i===0||removed||form.elements.upload.files.length?'disabled':'')+'>↑</button><button type="button" class="gallery-order-button" data-move-gallery="'+esc(src)+'" data-direction="1" aria-label="Mover foto '+(i+2)+' para baixo" '+(i===galleryOrder.length-1||removed?'disabled':'')+'>↓</button></div><button type="button" class="gallery-remove-button" data-remove-gallery="'+esc(src)+'" aria-pressed="'+String(removed)+'">'+(removed?'Desfazer':'Remover')+'</button></div>';
  }).join('')||'<p class="gallery-empty">Nenhuma foto adicional. A foto principal aparece primeiro na loja.</p>';
  container.querySelectorAll('[data-move-gallery]').forEach(button=>button.addEventListener('click',()=>{
   const src=button.dataset.moveGallery,index=galleryOrder.indexOf(src),direction=Number(button.dataset.direction);
   if(index<0||removedGallery.has(src))return;
   if(direction<0&&index===0){
    const previousMain=mainImage;mainImage=src;galleryOrder[index]=previousMain;
    renderMainPreview();
   }else{
    const next=index+direction;if(next<0||next>=galleryOrder.length)return;
    [galleryOrder[index],galleryOrder[next]]=[galleryOrder[next],galleryOrder[index]];
   }
   drawGallery();
  }));
  container.querySelectorAll('[data-remove-gallery]').forEach(button=>button.addEventListener('click',()=>{
   const src=button.dataset.removeGallery,item=button.closest('[data-gallery-item]');
   if(removedGallery.has(src))removedGallery.delete(src);else removedGallery.add(src);
   drawGallery();
  }));
 };
 const formGallery=()=>$('#product-gallery-list');
 const defaultFinish=[{id:'gravado',label:'Gravado',enabled:true},{id:'lapidado',label:'Lapidado',enabled:true},{id:'sem_gravacao',label:'Sem gravação',enabled:true}];
 const initialVariants=p.variants?.length?p.variants:defaultFinish;
 view.innerHTML='<div class="admin-editor-head"><div><h2>'+(isNew?'Novo produto':'Editar produto')+'</h2><p>Dados, fotos, acabamentos e estoque em um só lugar.</p></div></div><form id="product-edit" class="product-edit-form">'+
 '<div class="admin-grid"><label>Nome do produto<input name="name" required maxlength="100" value="'+esc(p.name)+'" placeholder="Ex.: Dobrão de Bronze"></label><label>Categoria<select name="category" required>'+categories.map(cat=>'<option value="'+esc(cat)+'" '+(p.category===cat?'selected':'')+'>'+esc(cat)+'</option>').join('')+'</select></label></div>'+
 '<div class="admin-grid"><label>Preço (R$)<input name="price" type="number" inputmode="decimal" min="0.01" max="100000" step="0.01" required value="'+(p.priceCents/100).toFixed(2)+'"></label><label>Prazo de produção (dias úteis)<input name="days" type="number" min="0" max="365" value="'+(p.productionDays??'')+'" placeholder="A confirmar"></label></div>'+
 '<label>Descrição<textarea name="description" maxlength="1000" rows="3">'+esc(p.description)+'</textarea></label>'+
 '<div class="admin-grid product-spec-fields"><label>Material<input name="material" maxlength="80" value="'+esc(p.material||'')+'" placeholder="Ex.: Bronze, aço inoxidável, couro"></label><label>Dimensões<input name="dimensions" maxlength="120" value="'+esc(p.dimensions||'')+'" placeholder="Ex.: Diâmetro: 38 mm · Espessura: 8 mm"></label></div>'+
 '<section class="custom-option-manager"><div class="admin-section-heading"><div><h3>Opções personalizadas</h3><p>Configure opções exclusivas deste produto. Uma por linha, no formato Nome: valor 1, valor 2.</p></div></div><label>Opções para o cliente<textarea name="customOptions" rows="4" maxlength="1500" placeholder="Cor: Branca, Preta, Verde\nTamanho: P, M, G">'+(p.customOptions||[]).map(option=>option.name+': '+option.values.join(', ')).join('\\n')+'</textarea></label><small>Deixe em branco se o produto não tiver opções. Até 5 opções por produto e 20 valores por opção.</small></section>'+
 '<section class="product-photo-editor"><div class="admin-section-heading"><div><h3>Fotos e arquivos</h3><p>A foto principal aparece primeiro. Use ↑ / ↓ para mudar a sequência; ao subir a primeira foto adicional, ela vira a capa.</p></div></div><label>Substituir foto principal '+(isNew?'(obrigatória)':'(opcional)')+'<input name="upload" type="file" accept="image/png,image/jpeg,image/webp" '+(isNew?'required':'')+'></label>'+photoPreview+'<label>Adicionar fotos à galeria<input name="galleryUpload" type="file" accept="image/png,image/jpeg,image/webp" multiple></label><div id="product-gallery-list" class="product-gallery-preview"></div><small>JPG, PNG ou WebP · até 1 MB por arquivo · máximo de 10 fotos. A sequência só é salva ao salvar o produto.</small></section>'+
 '<section class="finish-manager" id="finish-manager"><div class="admin-section-heading"><div><h3>Acabamentos disponíveis</h3><p>Escolha o que o cliente poderá selecionar no dobrão.</p></div></div><div class="finish-options">'+finishVariantsMarkup({...p,variants:initialVariants})+'</div><small>Gravado e Lapidado permitem enviar arte. Sem gravação não solicita arquivos.</small></section>'+
 '<section class="stock-manager"><div class="admin-section-heading"><div><h3>Estoque do produto</h3><p>Uma quantidade total, compartilhada entre todos os acabamentos.</p></div></div><div class="admin-grid"><label>Quantidade em estoque<input name="stock" type="number" min="0" max="100000" step="1" value="'+(p.stock??'')+'" placeholder="Em branco: não controlar"></label><label class="check stock-backorder"><input name="allowBackorder" type="checkbox" '+(p.allowBackorder!==false?'checked':'')+'>Permitir encomenda quando zerar</label></div><small>O estoque não é dividido entre Gravado, Lapidado ou Sem gravação. O sistema soma todos os itens do mesmo produto no pedido.</small></section>'+
 '<label class="check product-enabled"><input name="enabled" type="checkbox" '+(p.enabled?'checked':'')+'>Produto ativo na loja</label>'+
 '<div class="product-form-actions"><button type="submit">Salvar</button><button type="button" id="back-catalog" class="secondary-action">Cancelar</button></div><p id="save-message" role="status"></p></form>';
 const form=$('#product-edit'),finishManager=$('#finish-manager'),finishOptions=form.querySelector('.finish-options');
 const hasExistingFinishes=initialVariants.some(v=>finishDefinitions.some(option=>option.id===v.id));
 const refreshFinishVisibility=()=>{finishManager.hidden=!(form.elements.category.value==='Dobrões'||(form.elements.category.value===p.category&&hasExistingFinishes));};
 if(form.elements.category.value!=='Dobrões'&&isNew){
  initialVariants.splice(0,initialVariants.length,{id:'padrao',label:'Padrão',enabled:true});
 }
 refreshFinishVisibility();
 form.elements.category.addEventListener('change',()=>{
  if(form.elements.category.value==='Dobrões'){
   finishOptions.innerHTML=finishVariantsMarkup({variants:finishDefinitions.map(item=>({id:item.id,enabled:true}))});
  }else{
   finishOptions.replaceChildren();
  }
  refreshFinishVisibility();
 });
 $('#back-catalog').onclick=()=>load('catalog');
 drawGallery();
 form.elements.upload.addEventListener('change',()=>{
  const file=form.elements.upload.files[0],wrap=$('#product-photo-preview-wrap');
  if(file&&wrap){const url=URL.createObjectURL(file);wrap.innerHTML='<img id="product-photo-preview" src="'+esc(url)+'" alt="Prévia da nova foto principal" width="150" height="150" loading="eager">';}
  else renderMainPreview();
  drawGallery();
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='Salvando…';
  try{
   let main=mainImage,gallery=galleryOrder.filter(src=>!removedGallery.has(src));
   const mainFile=await image(form.elements.upload);
   if(mainFile)main=(await mutate('/api/admin/media',mainFile,'POST')).url;
   for(const file of form.elements.galleryUpload.files){const encoded=await image({files:[file]});gallery.push((await mutate('/api/admin/media',encoded,'POST')).url);}
   gallery=[...new Set([main,...gallery].filter(Boolean))];if(gallery.length>10)throw Error('A galeria aceita no máximo 10 imagens.');
   if(isNew&&!mainFile)throw Error('Selecione uma foto principal para cadastrar o produto.');
   const oldVariants=p.variants||[];
   let nextVariants;
   if(form.elements.category.value==='Dobrões'){
    const selected=new Set(Array.from(form.querySelectorAll('input[name="finish"]:checked')).map(input=>input.value));
    if(!selected.size)throw Error('Selecione pelo menos um acabamento.');
    nextVariants=oldVariants.map(v=>({...v,enabled:selected.has(v.id)}));
    for(const option of finishDefinitions)if(selected.has(option.id)&&!nextVariants.some(v=>v.id===option.id))nextVariants.push({...option,enabled:true,stock:null,allowBackorder:true});
    if(!nextVariants.some(v=>v.enabled))throw Error('Selecione pelo menos um acabamento.');
   }else{
    nextVariants=oldVariants.map(v=>({...v,enabled:v.id==='padrao'}));
    if(!nextVariants.some(v=>v.id==='padrao'))nextVariants.push({id:'padrao',label:'Padrão',enabled:true});
   }
   const customOptions=form.elements.customOptions.value.split(/\\r?\\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const split=line.indexOf(':');if(split<1)throw Error('Use o formato Nome: opção 1, opção 2.');const name=line.slice(0,split).trim(),values=line.slice(split+1).split(',').map(value=>value.trim()).filter(Boolean);if(!name||!values.length)throw Error('Preencha o nome e os valores de cada opção.');const id=name.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');return {id,name,values};});if(customOptions.length>5)throw Error('Configure no máximo 5 opções por produto.');\n   const value={productId:isNew?'produto_'+crypto.randomUUID().replace(/-/g,'').slice(0,12):p.productId,name:form.elements.name.value,category:form.elements.category.value,description:form.elements.description.value,material:form.elements.material.value,dimensions:form.elements.dimensions.value,customOptions,priceCents:Math.round(Number(form.elements.price.value)*100),productionDays:form.elements.days.value===''?null:Number(form.elements.days.value),enabled:form.elements.enabled.checked,image:main,gallery,stock:form.elements.stock.value===''?null:Number(form.elements.stock.value),allowBackorder:form.elements.allowBackorder.checked,variants:nextVariants.map(v=>({id:v.id,label:v.label,enabled:v.enabled!==false}))};
   await mutate('/api/admin/catalog'+(isNew?'':'/'+encodeURIComponent(p.productId)),value,isNew?'POST':'PATCH');
   await load('catalog');msg(isNew?'Produto cadastrado.':'Produto atualizado.');
  }catch(err){$('#save-message').textContent=err.message;button.disabled=false;button.textContent='Salvar';}
 });
}
async function catalog(){
 const d=await api('/api/admin/catalog');products=d.products;categories=d.categories||[];
 view.innerHTML='<div class="admin-catalog-heading"><div><h2>Produtos</h2><p>Selecione, organize e atualize o catálogo.</p></div><button id="new-product" type="button">+ Novo produto</button></div>'+
 '<section class="category-manager"><div class="admin-section-heading"><div><h3>Categorias da loja</h3><p>Organize os produtos por tipo.</p></div><form id="category-create" class="category-create"><input name="name" maxlength="60" required placeholder="Nova categoria" aria-label="Nome da nova categoria"><button type="submit">Adicionar</button></form></div><div class="category-list">'+categories.map(cat=>'<article class="category-chip"><strong>'+esc(cat)+'</strong><button type="button" data-category-edit="'+esc(cat)+'" aria-label="Renomear '+esc(cat)+'">Renomear</button><button type="button" data-category-delete="'+esc(cat)+'" aria-label="Excluir '+esc(cat)+'">×</button></article>').join('')+'</div></section>'+
 '<div class="catalog-toolbar"><label>Categoria<select id="catalog-filter"><option value="">Todas as categorias</option>'+categories.map(cat=>'<option value="'+esc(cat)+'">'+esc(cat)+'</option>').join('')+'</select></label><label class="show-removed-toggle"><input id="show-removed" type="checkbox"> Mostrar removidos da loja</label><label class="select-visible"><input id="select-visible" type="checkbox"> Selecionar exibidos</label><div class="bulk-actions"><span id="selected-count">0 selecionados</span><button id="bulk-deactivate" type="button" disabled>Remover da loja</button><button id="bulk-delete" type="button" disabled>Apagar</button></div></div>'+
 '<div id="catalog-products" aria-live="polite"></div>';
 const selectedIds=()=>Array.from(view.querySelectorAll('[data-select-product]:checked')).map(input=>input.value);
 const syncSelection=()=>{const ids=selectedIds(),count=ids.length;$('#selected-count').textContent=count+' selecionado'+(count===1?'':'s');$('#bulk-deactivate').disabled=!count;$('#bulk-delete').disabled=!count;};
 const draw=()=>{
  const selected=$('#catalog-filter').value,showRemoved=$('#show-removed').checked,shown=products.filter(p=>(showRemoved||p.enabled)&&(!selected||p.category===selected)),container=$('#catalog-products');
  container.innerHTML=shown.map(p=>{
   const index=products.findIndex(item=>item.productId===p.productId);
   const stock=p.stock===null?'Não controlado':p.stock===0?(p.allowBackorder?'0 · aceita encomenda':'0 · sem estoque'):p.stock+' unidades';
   const finishes=p.variants.filter(v=>v.id!=='padrao'&&v.enabled!==false).map(v=>v.label).join(' · ');
   return '<article class="admin-product-row"><label class="product-select"><input type="checkbox" data-select-product value="'+esc(p.productId)+'" aria-label="Selecionar '+esc(p.name)+'"></label><img class="admin-product-image" src="'+esc(p.image)+'" alt="'+esc(p.name)+'" loading="lazy" decoding="async" width="88" height="88"><div class="admin-product-copy"><h3>'+esc(p.name)+'</h3><p>'+esc(p.category||'Sem categoria')+' · '+cash(p.priceCents)+'</p><p class="product-stock-summary">Estoque: '+esc(stock)+'</p>'+(finishes?'<small>Acabamentos: '+esc(finishes)+'</small>':'')+'<span class="product-status '+(p.enabled?'is-active':'is-inactive')+'">'+(p.enabled?'Ativo na loja':'Removido da loja')+'</span></div><div class="product-row-actions"><button type="button" data-edit-product="'+esc(p.productId)+'">Editar</button><button type="button" data-move-product="'+esc(p.productId)+'" data-direction="-1" '+(index===0||products[index-1]?.enabled!==p.enabled?'disabled':'')+' aria-label="Mover '+esc(p.name)+' para cima">↑</button><button type="button" data-move-product="'+esc(p.productId)+'" data-direction="1" '+(index===products.length-1||products[index+1]?.enabled!==p.enabled?'disabled':'')+' aria-label="Mover '+esc(p.name)+' para baixo">↓</button></div></article>';
  }).join('')||'<p class="admin-empty">Nenhum produto nesta categoria.</p>';
  container.querySelectorAll('[data-edit-product]').forEach(button=>button.onclick=()=>editProduct(products.find(item=>item.productId===button.dataset.editProduct)));
  container.querySelectorAll('[data-move-product]').forEach(button=>button.onclick=async()=>{
   const index=products.findIndex(item=>item.productId===button.dataset.moveProduct),next=index+Number(button.dataset.direction);
   if(index<0||next<0||next>=products.length)return;
   [products[index],products[next]]=[products[next],products[index]];draw();msg('Salvando ordem…');
   try{await mutate('/api/admin/catalog/order',{productIds:products.map(item=>item.productId)});msg('Ordem dos produtos atualizada.');}
   catch(error){await load('catalog');msg(error.message);}
  });
  container.querySelectorAll('[data-select-product]').forEach(input=>input.onchange=syncSelection);
  syncSelection();
 };
 draw();
 $('#catalog-filter').onchange=()=>{draw();$('#select-visible').checked=false;};
 $('#show-removed').onchange=()=>{draw();$('#select-visible').checked=false;};
 $('#select-visible').onchange=e=>{view.querySelectorAll('[data-select-product]').forEach(input=>input.checked=e.target.checked);syncSelection();};
 async function runBulk(action){
  const ids=selectedIds();if(!ids.length)return;
  const selected=products.filter(product=>ids.includes(product.productId));
  if(action==='deactivate'&&!confirm('Remover '+ids.length+' produto(s) da loja? Os pedidos antigos serão preservados.'))return;
  if(action==='delete'&&!confirm('Apagar definitivamente '+ids.length+' produto(s)? Produtos que aparecem em pedidos não podem ser apagados.'))return;
  $('#bulk-deactivate').disabled=true;$('#bulk-delete').disabled=true;
  try{const result=await mutate('/api/admin/catalog/bulk',{action,productIds:ids},'POST');products=action==='delete'?products.filter(product=>!ids.includes(product.productId)):products.map(product=>ids.includes(product.productId)?{...product,enabled:false}:product);if(action==='deactivate')$('#show-removed').checked=false;$('#select-visible').checked=false;draw();msg(action==='delete'?(result.archivedProductIds?.length?'Produtos removidos da lista. '+result.archivedProductIds.length+' produto(s) foram arquivados para preservar pedidos antigos.':'Produtos apagados definitivamente.'):'Produtos removidos da loja.');}
  catch(error){msg(error.message);syncSelection();}
 }
 $('#bulk-deactivate').onclick=()=>runBulk('deactivate');
 $('#bulk-delete').onclick=()=>runBulk('delete');
 $('#category-create').onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;
  try{const result=await mutate('/api/admin/categories',{name:form.elements.name.value},'POST');categories=result.categories;await load('catalog');msg('Categoria criada.');}
  catch(error){msg(error.message);button.disabled=false;}
 };
 view.querySelectorAll('[data-category-edit]').forEach(button=>button.onclick=async()=>{
  const old=button.dataset.categoryEdit,name=prompt('Novo nome da categoria:',old);if(!name||name.trim()===old)return;
  try{await mutate('/api/admin/categories/'+encodeURIComponent(old),{name:name.trim()});await load('catalog');msg('Categoria renomeada.');}
  catch(error){msg(error.message);}
 });
 view.querySelectorAll('[data-category-delete]').forEach(button=>button.onclick=async()=>{
  const name=button.dataset.categoryDelete;if(!confirm('Excluir a categoria "'+name+'"? Ela precisa estar sem produtos associados.'))return;
  try{await api('/api/admin/categories/'+encodeURIComponent(name),{method:'DELETE'});await load('catalog');msg('Categoria excluída.');}
  catch(error){msg(error.message);}
 });
 $('#new-product').onclick=()=>{
  const isDobrao=(categories.includes('Dobrões')? 'Dobrões':categories[0])==='Dobrões';
  const variants=isDobrao?finishDefinitions.map(option=>({...option,enabled:true,stock:null,allowBackorder:true})):[{id:'padrao',label:'Padrão',enabled:true,stock:null,allowBackorder:true}];
  editProduct({productId:'produto_novo',name:'',category:isDobrao?'Dobrões':categories[0]||'',description:'',material:'',dimensions:'',priceCents:10000,stock:null,allowBackorder:true,productionDays:null,enabled:true,image:'',gallery:[],variants},true);
 };
}
async function customOrders(){const d=await api('/api/admin/custom-orders');orders=d.orders;const paid=orders.filter(o=>o.paymentConfirmed&&o.status!=='cancelled');const pending=orders.filter(o=>!o.paymentConfirmed&&o.status!=='cancelled');const revenue=paid.reduce((sum,o)=>sum+Number(o.total||0),0);view.innerHTML='<h2>Pedidos personalizados e kits</h2><section class="custom-financial-summary" aria-label="Resumo financeiro dos pedidos personalizados"><article><small>Pedidos pagos confirmados</small><strong>'+paid.length+'</strong></article><article><small>Pedidos aguardando pagamento</small><strong>'+pending.length+'</strong></article><article><small>Valor confirmado</small><strong>'+cash(revenue)+'</strong></article></section><p class="notice">Resumo dos pedidos personalizados confirmados; não inclui vendas do checkout convencional nem desconta taxas ou reembolsos. Valores pendentes não são faturamento.</p><p>O pagamento é confirmado automaticamente após validação do Mercado Pago. A baixa de estoque ocorre somente após essa confirmação.</p><label>Buscar pedido, cliente, telefone ou produto<input id="custom-search" type="search"></label><label>Etapa<select id="custom-status"><option value="">Todas as etapas</option>'+Object.entries(d.statusLabels).map(([k,v])=>'<option value="'+esc(k)+'">'+esc(v)+'</option>').join('')+'</select></label><div id="custom-orders-list"></div>';const draw=()=>{$('#custom-orders-list').innerHTML=orders.filter(o=>(!$('#custom-status').value||o.status===$('#custom-status').value)&&(o.orderCode+' '+o.orderId+' '+o.customer.name+' '+o.customer.phone+' '+o.items.map(i=>i.name+' '+i.variantLabel).join(' ')).toLowerCase().includes($('#custom-search').value.toLowerCase())).map(o=>'<article class="admin-record"><h3>'+esc(o.orderCode)+' · '+esc(o.customer.name)+'</h3><p>'+esc(o.customer.phone)+' · '+esc(d.statusLabels[o.status])+' · '+cash(o.total)+'</p><p>'+(!o.paymentConfirmed?'Pagamento não confirmado':'Pagamento confirmado pelo Mercado Pago')+'</p><button data-edit-order="'+esc(o.orderId)+'">Abrir pedido</button></article>').join('')||'<p>Nenhum pedido encontrado.</p>';view.querySelectorAll('[data-edit-order]').forEach(b=>b.onclick=()=>editOrder(orders.find(o=>o.orderId===b.dataset.editOrder),d.statusLabels));};const printQueue=$('#print-queue');if(printQueue)printQueue.onclick=()=>window.print();$('#custom-search').oninput=draw;$('#custom-status').onchange=draw;draw();}
function editOrder(o,labels){view.innerHTML='<h2>Pedido '+esc(o.orderCode)+'</h2><button type="button" id="print-production">Imprimir ficha de produção</button><p>'+esc(o.customer.name)+' · '+esc(o.customer.phone)+'</p><p>'+esc(o.notes)+'</p><div>'+o.items.map(i=>'<article class="admin-record"><h3>'+i.quantity+' × '+esc(i.name)+' / '+esc(i.variantLabel)+'</h3><p>Observações: '+esc(i.engravingNotes||i.engraving||'Nenhuma')+'</p><p>'+cash(i.subtotal)+'</p>'+[['Frente','front'],['Verso','back']].map(([label,key])=>i[key]?'<a class="admin-art" href="'+esc(i[key].data)+'" download="'+esc(i[key].name)+'"><img src="'+esc(i[key].data)+'" alt="Gravação '+label+'"><span>'+label+' · Baixar arte</span></a>':'').join('')+(i.art?'<a class="admin-art" href="'+esc(i.art.data)+'" download="'+esc(i.art.name)+'"><img src="'+esc(i.art.data)+'" alt="Arte anterior"><span>Baixar arte anterior</span></a>':'')+'</article>').join('')+'</div><form id="custom-order-edit"><label>Etapa<select name="status">'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'" '+(o.status===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label><p class="notice">'+(o.paymentConfirmed?'Pagamento confirmado automaticamente pelo Mercado Pago.':'Aguardando confirmação automática do Mercado Pago.')+'</p><label>Frete confirmado (R$)<input name="shipping" type="number" min="0" max="10000" step="0.01" value="'+(o.shippingCents===null?'':o.shippingCents/100)+'"></label><label>Rastreio<input name="tracking" maxlength="100" value="'+esc(o.trackingCode)+'"></label><label>Observações internas<textarea name="notes" maxlength="1000">'+esc(o.adminNotes)+'</textarea></label><button type="submit">Salvar acompanhamento</button><button type="button" id="back-orders">Voltar</button><p id="order-save-message" role="status"></p></form><h3>Histórico</h3>'+o.history.map(h=>'<p>'+esc(labels[h.status])+' · '+new Date(h.at).toLocaleString('pt-BR')+'</p>').join('');$('#print-production').onclick=()=>window.print();$('#back-orders').onclick=()=>load('custom-orders');$('#custom-order-edit').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type=submit]');b.disabled=true;try{const saved=await mutate('/api/admin/custom-orders/'+o.orderId,{status:f.elements.status.value,paymentConfirmed:o.paymentConfirmed,shippingCents:f.elements.shipping.value===''?null:Math.round(Number(f.elements.shipping.value)*100),trackingCode:f.elements.tracking.value,adminNotes:f.elements.notes.value});editOrder(saved,labels);$('#order-save-message').textContent='Atualização salva no acompanhamento do cliente.';}catch(err){$('#order-save-message').textContent=err.message;b.disabled=false;}});}
async function load(name){active=name;const tabs=$('#orders-tabs');if(tabs)tabs.hidden=name!=='custom-orders';const standard=$('#orders-standard-tab'),custom=$('#orders-custom-tab');if(standard){standard.classList.remove('active');standard.setAttribute('aria-pressed','false');}if(custom){custom.classList.toggle('active',name==='custom-orders');custom.setAttribute('aria-pressed',String(name==='custom-orders'));}view.hidden=false;$('#orders-view').hidden=true;$('#customers-view').hidden=true;$('#page-title').textContent={catalog:'Produtos e estoque','custom-orders':'Pedidos'}[name]||'Produtos e estoque';view.innerHTML='<p>Carregando…</p>';try{const loaders={catalog,'custom-orders':customOrders};if(!loaders[name])throw Error('Seção não disponível.');await loaders[name]();msg('Dados atualizados.');}catch(err){view.innerHTML='<p>'+esc(err.message)+'</p>';msg(err.message);}}
window.addEventListener('admin:manage-custom-order',async e=>{document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view==='orders'));await load('custom-orders');const o=orders.find(x=>x.orderId===e.detail?.id);if(o){const d=await api('/api/admin/custom-orders');editOrder(o,d.statusLabels||{});}});
$('#orders-custom-tab')?.addEventListener('click',()=>{document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view==='orders'));load('custom-orders');});
$('#orders-standard-tab')?.addEventListener('click',()=>{document.querySelector('.nav[data-view="orders"]')?.click();});
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>{if(['orders','customers'].includes(b.dataset.view)){const tabs=$('#orders-tabs');if(tabs)tabs.hidden=b.dataset.view!=='orders';const standard=$('#orders-standard-tab'),custom=$('#orders-custom-tab');if(standard){standard.classList.toggle('active',b.dataset.view==='orders');standard.setAttribute('aria-pressed',String(b.dataset.view==='orders'));}if(custom){custom.classList.remove('active');custom.setAttribute('aria-pressed','false');}active='';return;}document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n===b));load(b.dataset.view);}));$('#refresh').addEventListener('click',e=>{if(active){e.stopImmediatePropagation();load(active);}},true);
})();
