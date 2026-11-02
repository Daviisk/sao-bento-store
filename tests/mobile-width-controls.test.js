import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('frontend/index.html','utf8');
const css=readFileSync('frontend/css/base.css','utf8');

test('mobile storefront uses the full available viewport width',()=>{
  assert.ok(html.includes('css/base.css?v=mobile-width-controls-20261101'));
  assert.match(css,/html,body\{width:100%;max-width:100%;min-width:0;overflow-x:clip\}/);
  assert.match(css,/main#home\.wrap\{width:100%;max-width:none;margin:0;padding-left:16px;padding-right:16px\}/);
  assert.match(css,/\.bottom\{left:12px;right:12px;width:auto;max-width:none\}/);
});

test('mobile buttons and product controls use compact, consistent dimensions',()=>{
  assert.match(css,/\.primary\{min-height:42px;padding:8px 12px;border-radius:10px\}/);
  assert.match(css,/#grid \.card \.primary,#grid \.card \.catalog-buy-now\{width:100%;max-width:100%;min-height:44px;padding:8px 7px;font-size:12px;line-height:1\.25;white-space:normal\}/);
  assert.match(css,/#grid \.card \.heart\{width:36px;height:36px;min-width:36px/);
  assert.match(css,/\.bottom button\{min-height:48px;padding:5px 2px;font-size:10px/);
});
