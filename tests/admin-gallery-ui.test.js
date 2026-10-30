import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('admin gallery removal is a real button and is applied only when the product is saved',()=>{
 const admin=readFileSync('frontend/admin/commerce-admin.js','utf8');
 assert.match(admin,/class="gallery-remove-button" data-remove-gallery=/);
 assert.match(admin,/type="button" class="gallery-remove-button"/);
 assert.doesNotMatch(admin,/name="removeGallery"/);
 assert.match(admin,/form\.querySelectorAll\('\[data-remove-gallery\]'\)/);
 assert.match(admin,/removedGallery\.add\(src\)/);
 assert.match(admin,/removedGallery\.delete\(src\)/);
 assert.match(admin,/p\.gallery\.filter\(src=>!removedGallery\.has\(src\)\)/);
});
