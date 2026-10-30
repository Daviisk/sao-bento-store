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
 assert.match(admin,/galleryOrder\.filter\(src=>!removedGallery\.has\(src\)\)/);
});

test('admin gallery supports visible ordering, swapping the first additional photo into the cover, and saving its sequence',()=>{
 const admin=readFileSync('frontend/admin/commerce-admin.js','utf8');
 assert.match(admin,/data-move-gallery=/);
 assert.match(admin,/data-direction="-1"/);
 assert.match(admin,/data-direction="1"/);
 assert.match(admin,/galleryOrder=p\.gallery/);
 assert.match(admin,/galleryOrder\.indexOf\(src\)/);
 assert.match(admin,/const previousMain=mainImage;mainImage=src;galleryOrder\[index\]=previousMain/);
 assert.match(admin,/\[galleryOrder\[index\],galleryOrder\[next\]\]=\[galleryOrder\[next\],galleryOrder\[index\]\]/);
 assert.match(admin,/gallery=\[\.\.\.new Set\(\[main,\.\.\.gallery\]/);
});

test('new product form starts without a sample coin photo and prompts for the main photo',()=>{
 const admin=readFileSync('frontend/admin/commerce-admin.js','utf8');
 assert.match(admin,/image:'',gallery:\[\],variants\},true\)/);
 assert.match(admin,/Selecione uma foto principal/);
 assert.match(admin,/product-photo-placeholder/);
 assert.match(admin,/product-photo-preview'\)\.hidden=false/);
});

test('new product preview contains no example image element or inherited gallery image',()=>{
 const admin=readFileSync('frontend/admin/commerce-admin.js','utf8');
 assert.ok(admin.includes("let mainImage=isNew?'':(p.image||'');"));
 assert.ok(admin.includes("let galleryOrder=isNew?[]:"));
 assert.ok(admin.includes("(mainImage?'<img id=\"product-photo-preview\""));
 assert.ok(admin.includes("'<span id=\"product-photo-placeholder\">Selecione uma foto principal</span>')+'</div>'"));
 assert.ok(admin.includes("const renderMainPreview=()=>"));
 assert.ok(admin.includes("if(file&&wrap){const url=URL.createObjectURL(file);wrap.innerHTML="));
 assert.ok(admin.includes("image:'',gallery:[],variants},true)"));
});
