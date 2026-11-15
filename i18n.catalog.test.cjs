const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const asset=fs.existsSync(path.join(__dirname,'static/messages.js'))?'static/':'';
const scope={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,asset+'messages.js'),'utf8'),scope);
test('Every bundled message has all five translations and preserves numbered parameters',()=>{
 const catalog=scope.APP_MESSAGES;assert.ok(Object.keys(catalog).length>20);
 const placeholders=s=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort();
 for(const [source,translations]of Object.entries(catalog)){
  assert.deepEqual(Object.keys(translations).sort(),['de','es','ja','zh-CN','zh-TW']);
  for(const [locale,text]of Object.entries(translations)){
   assert.equal(typeof text,'string',source+' '+locale);assert.ok(text.trim(),source+' '+locale);
   assert.deepEqual(placeholders(text),placeholders(source),source+' '+locale);
  }
 }
});
test('Testimonial consent catalog matches the interface wording exactly',()=>{
 const consent=path.join(__dirname,'static/consent.json');if(!fs.existsSync(consent))return;
 const all=JSON.parse(fs.readFileSync(consent,'utf8'));
 for(const locale of ['de','es','ja','zh-CN','zh-TW'])assert.equal(all[locale],scope.APP_MESSAGES[all.en][locale]);
});
