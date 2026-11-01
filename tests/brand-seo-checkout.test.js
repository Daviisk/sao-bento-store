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

test('sitemap only advertises public indexable pages',()=>{
  assert.ok(sitemap.includes('<loc>https://saobentodobroes.com/</loc>'));
  assert.ok(sitemap.includes('<loc>https://saobentodobroes.com/privacidade.html</loc>'));
  assert.ok(sitemap.includes('<loc>https://saobentodobroes.com/termos.html</loc>'));
  assert.doesNotMatch(sitemap,/\/admin|\/api|\/acompanhar|\/sucesso/);
});
