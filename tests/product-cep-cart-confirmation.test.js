import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('frontend/index.html','utf8');
const js=readFileSync('frontend/js/shop-features.js','utf8');
const css=readFileSync('frontend/css/shop-features.css','utf8');

test('product details offer freight quote using only the destination CEP',()=>{
  assert.ok(html.includes('js/shop-features.js?v=freight-after-quantity-20261102'));
  assert.ok(js.includes('id="product-shipping-cep"'));
  assert.ok(js.includes('id="product-shipping-check"'));
  assert.ok(js.includes("post('/api/commerce/shipping/quote',{cep,items:[{productId:p.productId,quantity}]})"));
  assert.ok(js.includes('Estimativa para este produto e quantidade.'));
  assert.match(js,/Informe apenas o CEP para consultar preço e prazo estimados/);\n  assert.ok(js.indexOf('id="detail-quantity"') < js.indexOf('id="product-shipping-title"'),'freight calculator must appear after quantity');
});

test('adding an item opens a cart review with the new item highlighted',()=>{
  assert.match(js,/save\(\);showAddedScreen\(\[item\]\)/);
  assert.ok(js.includes('Adicionado agora'));
  assert.ok(js.includes('data-added-continue'));
  assert.ok(js.includes('data-added-checkout'));
  assert.ok(js.includes('Continuar comprando'));
  assert.ok(js.includes('Finalizar compra'));
  assert.ok(js.includes('if(b.hasAttribute(\'data-added-continue\'))'));
  assert.ok(js.includes('if(b.hasAttribute(\'data-added-checkout\'))'));
});

test('the added-item review and product freight quote have responsive styling',()=>{
  assert.ok(css.includes('.product-shipping-controls'));
  assert.ok(css.includes('.product-shipping-option'));
  assert.ok(css.includes('.added-cart-line.is-new'));
  assert.ok(css.includes('.added-cart-actions'));
});
