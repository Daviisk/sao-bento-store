const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=cents=>(Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const validEmail=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function createOrderConfirmationSender({apiKey,from='São Bento Dobrões <pedidos@saobentodobroes.com>',replyTo='',fetchImpl=globalThis.fetch}={}){
 if(!apiKey)return null;
 if(typeof fetchImpl!=='function')throw new TypeError('Fetch indisponível para envio de e-mail.');
 return async function sendOrderConfirmation(order){
  const recipient=String(order?.customer?.email||'').trim().toLowerCase();
  if(order?.status!=='paid'||!validEmail(recipient))return null;
  const code=String(order.orderCode||String(order.orderId||'').slice(0,8).toUpperCase());
  const rows=(Array.isArray(order.items)?order.items:[]).map(item=>({
   name:String(item.name||'Produto').slice(0,160),
   quantity:Number(item.quantity)||1,
   subtotal:Number(item.subtotal)||0
  }));
  const itemsText=rows.map(item=>`${item.quantity} × ${item.name} — ${money(item.subtotal)}`).join('\n');
  const itemsHtml=rows.map(item=>`<tr><td style="padding:10px 0;border-bottom:1px solid #e9e2d5">${escapeHtml(item.quantity)} × ${escapeHtml(item.name)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #e9e2d5;white-space:nowrap">${money(item.subtotal)}</td></tr>`).join('');
  const shipping=order.shipping?.name?String(order.shipping.name):'Entrega';
  const address=order.address?[order.address.street,order.address.number,order.address.district,order.address.city,order.address.state,order.address.cep].filter(Boolean).join(', '):'';
  const subject=`Pedido #${code} confirmado — São Bento Dobrões`;
  const text=[
   `Olá, ${order.customer.name||'tudo bem'}!`,
   `Seu pagamento foi confirmado e o pedido #${code} foi recebido pela São Bento Dobrões.`,
   '',
   'RESUMO DO PEDIDO',
   itemsText,
   '',
   `Produtos: ${money(order.productsTotal)}`,
   `Frete (${shipping}): ${money(order.shipping?.priceCents)}`,
   `Total pago: ${money(order.total)}`,
   address?`Endereço de entrega: ${address}`:'',
   '',
   'Obrigado por comprar com a São Bento Dobrões!',
   'Dúvidas? Acesse nosso site para falar com a equipe da loja.',
   'https://saobentodobroes.com'
  ].filter(Boolean).join('\n');
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:#f4efe4;color:#302719;font-family:Arial,Helvetica,sans-serif"><div style="max-width:600px;margin:0 auto;padding:28px 16px"><div style="background:#fffdf8;border:1px solid #e6ddce;border-radius:16px;padding:28px"><p style="margin:0 0 8px;color:#8a6b3d;font-size:12px;font-weight:bold;letter-spacing:2px">SÃO BENTO · DOBRÕES</p><h1 style="margin:0 0 12px;font-size:24px">Pagamento confirmado!</h1><p style="font-size:16px;line-height:1.6">Olá, ${escapeHtml(order.customer.name||'tudo bem')}! Recebemos seu pedido e o pagamento foi confirmado.</p><p style="margin:22px 0;padding:14px;background:#f4efe4;border-radius:10px"><strong>Pedido #${escapeHtml(code)}</strong><br><span style="color:#6e6251;font-size:13px">Guarde este número para atendimento.</span></p><h2 style="font-size:16px">Resumo do pedido</h2><table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${itemsHtml}</table><table role="presentation" style="width:100%;margin-top:16px;font-size:14px"><tr><td style="padding:5px 0">Produtos</td><td align="right">${money(order.productsTotal)}</td></tr><tr><td style="padding:5px 0">Frete · ${escapeHtml(shipping)}</td><td align="right">${money(order.shipping?.priceCents)}</td></tr><tr><td style="padding:12px 0;border-top:1px solid #d8cbb7;font-weight:bold;font-size:17px">Total pago</td><td align="right" style="padding:12px 0;border-top:1px solid #d8cbb7;font-weight:bold;font-size:17px">${money(order.total)}</td></tr></table>${address?`<p style="margin-top:22px;font-size:13px;line-height:1.5"><strong>Endereço de entrega</strong><br>${escapeHtml(address)}</p>`:''}<p style="margin:24px 0 8px;font-size:14px;line-height:1.6">Obrigado por comprar com a São Bento Dobrões. Em caso de dúvidas, responda a este e-mail ou fale conosco.</p><p style="margin:0;font-size:13px"><a href="https://saobentodobroes.com" style="color:#76572b">saobentodobroes.com</a> · contato@saobentodobroes.com</p></div><p style="text-align:center;color:#837968;font-size:11px;margin:18px 0">Você está recebendo esta mensagem porque realizou um pedido na São Bento Dobrões.</p></div></body></html>`;
  const response=await fetchImpl('https://api.resend.com/emails',{
   method:'POST',
   headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`order-confirmation-${order.orderId}`},
   body:JSON.stringify({from,to:[recipient],...(replyTo?{reply_to:replyTo}:{}),subject,html,text}),
   signal:AbortSignal.timeout(10000)
  });
  let payload={};try{payload=await response.json();}catch{}
  if(!response.ok){const error=new Error('Falha ao enviar confirmação pelo Resend.');error.statusCode=response.status;error.code=payload?.name||'resend_error';throw error;}
  if(typeof payload.id!=='string'||!payload.id)throw new Error('Resend não retornou o identificador do e-mail.');
  return {id:payload.id};
 };
}
