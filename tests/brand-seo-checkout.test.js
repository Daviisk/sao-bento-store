import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('frontend/index.html','utf8');
const sitemap=readFileSync('sitemap.xml','utf8');

test('storefront uses the approved brand and complete social metadata',()=>{
  assert.match(html,/<title>São Bento Dobrões Personalizados \\| Dobrões para berimbau<\\/title>/);
  assert.match(html,/property="og:site_name" content="São Bento Dobrões Personalizados"/);
  assert.match(html,/name="twitter:card" content="summary_large_image"/);
  assert.match(html,/rel="canonical" href="https:\\/\\/saobentodobroes\\.com\\/"/);
});

test('storefront exposes organization and website structured data',()=>{
  const match=html.match(/<script type="application\\/ld\\+json">([\\s\\S]*?)<\\/script>/);
  assert.ok(match,'JSON-LD schema should exist');
  const schema=JSON.parse(match[1]);
  assert.ok(schema['@graph'].some(node=>node['@type']==='Organization'&&node.name==='São Bento Dobrões Personalizados'));
  assert.ok(schema['@graph'].some(node=>node['@type']==='WebSite'&&node.inLanguage==='pt-BR'));
});

test('checkout explains Mercado Pago confirmation and shipping before payment',()=>{
  assert.match(html,/Pagamento processado pelo Mercado Pago/);
  assert.match(html,/O pedido só é confirmado depois que o Mercado Pago confirma o pagamento/);
  assert.match(html,/O frete, a modalidade e o prazo são apresentados antes de concluir a compra/);
  assert.match(html,/href="\\/privacidade\\.html"/);
  assert.match(html,/href="\\/termos\\.html"/);
});

test('sitemap only advertises public indexable pages',()=>{
  assert.match(sitemap,/<loc>https:\\/\\/saobentodobroes\\.com\\/<\\/loc>/);
  assert.match(sitemap,/<loc>https:\\/\\/saobentodobroes\\.com\\/privacidade\\.html<\\/loc>/);
  assert.match(sitemap,/<loc>https:\\/\\/saobentodobroes\\.com\\/termos\\.html<\\/loc>/);
  assert.doesNotMatch(sitemap,/\\/admin|\\/api|\\/acompanhar|\\/sucesso/);
});
