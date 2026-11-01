import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const adminCss=readFileSync(new URL('../frontend/admin/admin.css',import.meta.url),'utf8');
const commerceCss=readFileSync(new URL('../frontend/admin/commerce-admin.css',import.meta.url),'utf8');

test('mobile admin refinements are scoped to phone breakpoints',()=>{
  assert.match(adminCss,/@media\(max-width:650px\)\{[\s\S]*?#app-view \.top\{/);
  assert.match(adminCss,/@media\(max-width:650px\)\{[\s\S]*?#orders-view \.stats strong\{/);
  assert.match(adminCss,/@media\(max-width:380px\)/);
  assert.match(commerceCss,/@media\(max-width:650px\)\{[\s\S]*?#commerce-admin-view \.custom-financial-summary strong\{/);
  assert.match(commerceCss,/@media\(max-width:650px\)\{[\s\S]*?#commerce-admin-view \.admin-record/);
  assert.match(commerceCss,/@media\(max-width:380px\)/);
});

test('mobile financial values use tabular numerals and safe wrapping',()=>{
  assert.match(adminCss,/#orders-view \.stats strong\{[^}]*font-variant-numeric:tabular-nums/);
  assert.match(commerceCss,/#commerce-admin-view \.custom-financial-summary strong\{[^}]*font-variant-numeric:tabular-nums/);
  assert.match(adminCss,/#orders-view \.stats strong\{[^}]*overflow-wrap:anywhere/);
  assert.match(commerceCss,/#commerce-admin-view \.custom-financial-summary strong\{[^}]*overflow-wrap:anywhere/);
});
