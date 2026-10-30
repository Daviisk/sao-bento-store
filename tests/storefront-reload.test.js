import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('storefront scripts are included once and in dependency order',()=>{
 const html=readFileSync('frontend/index.html','utf8');
 const sources=[...html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g)].map(match=>match[1].split('?')[0]);
 for(const src of ['js/theme.js','js/cart-model.js','js/cart.js','js/card-payment.js','js/pix-payment.js','js/tracking-link-injector.js','js/storefront.js','js/shop-features.js']){
  assert.equal(sources.filter(value=>value===src).length,1,src+' should load once');
 }
 assert.ok(sources.indexOf('js/cart-model.js')<sources.indexOf('js/cart.js'));
 assert.ok(sources.indexOf('js/storefront.js')<sources.indexOf('js/shop-features.js'));
});

test('storefront opts out of restoring the previous mid-page scroll on reload',()=>{
 const theme=readFileSync('frontend/js/theme.js','utf8');
 assert.match(theme,/history\.scrollRestoration='manual'/);
});

test('storefront forces scroll to top on reload after the browser pageshow restoration phase',()=>{
 const theme=readFileSync('frontend/js/theme.js','utf8');
 assert.match(theme,/navigation\?\.type==='reload'&&!location\.hash/);
 assert.match(theme,/window\.addEventListener\('pageshow'/);
 assert.match(theme,/document\.addEventListener\('DOMContentLoaded'/);
 assert.match(theme,/requestAnimationFrame\(\(\)=>\{forceTop\(\);requestAnimationFrame\(forceTop\);\}\)/);
 assert.match(theme,/document\.documentElement\.scrollTop=0/);
});
