import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const adminCss=readFileSync(new URL('../frontend/admin/admin.css',import.meta.url),'utf8');
const commerceCss=readFileSync(new URL('../frontend/admin/commerce-admin.css',import.meta.url),'utf8');
const commerceJs=readFileSync(new URL('../frontend/admin/commerce-admin.js',import.meta.url),'utf8');
const adminHtml=readFileSync(new URL('../frontend/admin/index.html',import.meta.url),'utf8');

test('admin top bar is centered and refresh action remains visible on mobile',()=>{
 assert.match(adminCss,/@media\(max-width:850px\)[\s\S]*?#app-view \.main>\.top\{/);
 assert.doesNotMatch(adminCss.slice(adminCss.indexOf('/* Ajustes exclusivos para celular')),/^#app-view \.main>\.top\{/m);
 assert.match(adminCss,/#app-view \.main>\.top\{[^}]*justify-items:center/s);
 assert.match(adminCss,/#app-view \.admin-top-actions\{[^}]*justify-content:center/s);
 assert.match(adminCss,/#app-view \.sidebar \.sidebar-bottom \.logout\{position:static/s);
 assert.match(adminCss,/@media\(max-width:520px\)[\s\S]*?#app-view \.admin-top-actions #refresh\{width:100%/);
});

test('financial amounts are centered and do not wrap across dashboard tables and cards',()=>{
 assert.match(adminCss,/#orders-view \.stats strong\{[^}]*text-align:center/s);
 assert.match(adminCss,/#orders-view table th:nth-child\(5\)[\s\S]*?#customers-view table th:nth-child\(4\)/);
 assert.match(commerceCss,/\.custom-financial-summary strong\{[^}]*white-space:nowrap/s);
 assert.match(commerceCss,/\.admin-product-copy \.admin-product-price\{[^}]*font-variant-numeric:tabular-nums/s);
});

test('catalog price is displayed separately from category text',()=>{
 assert.match(commerceJs,/class="admin-product-price">\'\+cash\(p\.priceCents\)\+'<\/strong>/);
 assert.match(adminHtml,/admin\.css\?v=mobile-admin-layout-polish-20261101/);
});
