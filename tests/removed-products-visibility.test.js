import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('removed products are hidden from the normal admin list but can be shown for recovery',()=>{
 const admin=readFileSync('frontend/admin/commerce-admin.js','utf8');
 assert.match(admin,/class="show-removed-toggle"><input id="show-removed" type="checkbox"> Mostrar removidos da loja/);
 assert.match(admin,/shown=products\.filter\(p=>\(showRemoved\|\|p\.enabled\)&&\(!selected\|\|p\.category===selected\)\)/);
 assert.match(admin,/\$\('#show-removed'\)\.onchange=\(\)=>\{draw\(\);/);
 assert.match(admin,/if\(action==='deactivate'\)\$\('#show-removed'\)\.checked=false/);
});

test('storefront product rendering excludes every disabled product',()=>{
 const shop=readFileSync('frontend/js/shop-features.js','utf8');
 assert.match(shop,/function renderProducts\(\)[\s\S]*?products\.filter\(p=>p\.enabled\)\.forEach/);
});
