import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('admin gallery removal is a real button and is applied only when the product is saved',()=>{
 const admin=readFileSync('frontend/admin/commerce-admin.js','utf8');
 assert.match(admin,/class="gallery-remove-button" data-remove-gallery=/);
 assert.match(admin,/type="button" class="gallery-remove-button"/);
 assert.doesNotMatch(admin,/name="removeGallery"/);
 assert.match(admin,/container\.querySelectorAll\('\[data-remove-gallery\]'\)/);
 assert.match(admin,/removedGallery\.add\(src\)/);
 assert.match(admin,/removedGallery\.delete\(src\)/);
 assert.match(admin,/p\.gallery\.filter\(src=>!removedGallery\.has\(src\)\)/);
});

test('admin gallery supports visible ordering, swapping the first additional photo into the cover, and saving its sequence',()=>{
 const admin=readFileSync('frontend/admin/commerce-admin.js','utf8');
 assert.match(admin,/data-move-gallery=/);
 assert.match(admin,/data-direction="-1"/);
 assert.match(admin,/data-direction="1"/);
 assert.match(admin,/galleryOrder= p\.gallery/);
 assert.match(admin,/galleryOrder\.indexOf\(src\)/);
 assert.match(admin,/const previousMain=mainImage;mainImage=src;galleryOrder\[index\]=previousMain/);
 assert.match(admin,/\[galleryOrder\[index\],galleryOrder\[next\]\]=\[galleryOrder\[next\],galleryOrder\[index\]\]/);
 assert.match(admin,/gallery=\[\.\.\.new Set\(\[main,\.\.\.gallery\]/);
});
