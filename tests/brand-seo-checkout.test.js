import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('frontend/index.html','utf8');
const sitemap=readFileSync('sitemap.xml','utf8');

test('storefront uses the approved brand and complete social metadata',()=>{
  assert.ok(html.includes('<title>São Bento Dobrões Personalizados | Dobrões para berimbau</title>'));
  assert.ok(html.includes('property="og:site_name" content="São Bento Dobrões Personalizados"'));
  assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(html.includes('rel="canonical" href="https://saobentodobroes.com/"'));
});

test('storefront cache-busts updated checkout and brand assets',()=>{
  assert.ok(html.includes('css/cart.css?v=cart-summary-bottom-20261102'));
  assert.ok(html.includes('js/cart.js?v=checkout-trust-20261101'));
  assert.ok(html.includes('js/storefront.js?v=brand-copy-20261101'));
  assert.ok(html.includes('js/shop-features.js?v=buy-now-primary-20261102'));
});

test('storefront exposes organization and website structured data',()=>{
  const start=html.indexOf('<script type="application/ld+json">');
  const end=html.indexOf('</script>',start);
  assert.ok(start>=0&&end>start,'JSON-LD schema should exist');
  const schema=JSON.parse(html.slice(start+'<script type="application/ld+json">'.length,end));
  assert.ok(schema['@graph'].some(node=>node['@type']==='Organization'&&node.name==='São Bento Dobrões Personalizados'));
  assert.ok(schema['@graph'].some(node=>node['@type']==='WebSite'&&node.inLanguage==='pt-BR'));
});

test('checkout explains Mercado Pago confirmation and shipping before payment',()=>{
  assert.ok(html.includes('Pagamento processado pelo Mercado Pago'));
  assert.ok(html.includes('O pedido só é confirmado depois que o Mercado Pago confirma o pagamento'));
  assert.ok(html.includes('O frete, a modalidade e o prazo são apresentados antes de concluir a compra'));
  assert.ok(html.includes('href="/privacidade.html"'));
  assert.ok(html.includes('href="/termos.html"'));
});

test('Pix checkout refreshes payment status from the backend and avoids stale script cache',()=>{
  const pix=readFileSync('frontend/js/pix-payment.js','utf8');
  assert.ok(html.includes('js/pix-payment.js?v=pix-status-refresh-20261102'));
  assert.ok(pix.includes('Já paguei — atualizar status'));
  assert.ok(pix.includes("api('/api/orders/'+encodeURIComponent(orderId))"));
  assert.ok(pix.includes("order.status==='paid'"));
  assert.ok(pix.includes("document.addEventListener('visibilitychange'"));
  assert.ok(pix.includes('i<360'));
});

test('product customization keeps Add to cart separate from Buy now',()=>{
  const features=readFileSync('frontend/js/shop-features.js','utf8');
  assert.ok(features.includes("dataset.buyNow='false'"));
  assert.ok(features.includes("dataset.buyNow='true'"));
  assert.ok(features.includes("if(form.dataset.buyNow==='true')"));
});
test('sitemap only advertises public indexable pages',()=>{
  assert.ok(sitemap.includes('<loc>https://saobentodobroes.com/</loc>'));
  assert.ok(sitemap.includes('<loc>https://saobentodobroes.com/privacidade.html</loc>'));
  assert.ok(sitemap.includes('<loc>https://saobentodobroes.com/termos.html</loc>'));
  assert.doesNotMatch(sitemap,/\/admin|\/api|\/acompanhar|\/sucesso/);
});


test('catalog cards show Buy now as the only purchase action',()=>{
  const features=readFileSync('frontend/js/shop-features.js','utf8');
  assert.ok(features.includes('class="primary catalog-buy-now"'));
  assert.ok(features.includes("data-commerce-buy=\"'+esc(p.productId)+'\""));
  assert.ok(!features.includes('Personalizar e ver produto →'));
  assert.ok(!features.includes('class="catalog-buy-now" data-commerce-buy='));
});
