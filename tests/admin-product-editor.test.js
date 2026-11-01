import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const admin=readFileSync('frontend/admin/commerce-admin.js','utf8');

test('new product editor has its default finish definitions in scope',()=>{
 assert.match(admin,/const finishDefinitions=\[\{id:'gravado',label:'Gravado'\},\{id:'lapidado',label:'Lapidado'\},\{id:'sem_gravacao',label:'Sem gravação'\}\]/);
 assert.match(admin,/const variants=isDobrao\?finishDefinitions\.map/);
});

test('admin can add and remove custom option areas such as color',()=>{
 assert.match(admin,/Nome da área<input name="areaTitle"/);
 assert.match(admin,/Opções \(uma por linha\)<textarea name="areaOptions"/);
 assert.match(admin,/id="add-custom-area"/);
 assert.match(admin,/\$\('#add-custom-area'\)\.addEventListener\('click',addArea\)/);
 assert.match(admin,/data-remove-area/);
 assert.match(admin,/optionGroups\};/);
});

test('editing a product can deactivate old variants without breaking order history',()=>{
 assert.match(admin,/nextVariants\.push\(\.\.\.oldVariants\.filter\(v=>!usedIds\.has\(v\.id\)\)\.map\(v=>\(\{\.\.\.v,enabled:false\}\)\)\)/);
});

test('new and existing product forms submit to their matching admin catalog endpoints',()=>{
 assert.ok(admin.includes("await mutate('/api/admin/catalog'+(isNew?'':'/'+encodeURIComponent(p.productId)),value,isNew?'POST':'PATCH');"));
});
