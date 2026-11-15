/* TEST_URL points to an isolated fixture. No production data or capture permissions. */
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const extensionFixture = () => {
   // Interface fixture only. Does not invoke capture or install an extension.
   window.chrome = {runtime:{sendMessage:async ({op})=>({ok:true,data:op==='list'?{guides:[],active:null}:{title:'Delete',description:'Private draft',steps:[],revision:1}})},storage:{local:{get:async()=>({}),remove:async()=>{}}}};
  };
(async () => {
 const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}: {})});
 try {
  const context = await browser.newContext({locale:'de-DE',viewport:{width:390,height:844}});
  if(process.env.TEST_EXTENSION_UI) await context.addInitScript(extensionFixture);
  const page = await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL);
  await page.locator('[data-language-picker]').waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'),'de');
  const control=page.locator('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=color]):not([type=number]):not([readonly]):visible').first();
  const hasControl=await control.count();
  if(hasControl) await control.fill('私の草稿 <b>Delete</b>');
  for(const locale of ['en','de','es','ja','zh-CN','zh-TW']) {
   await page.locator('[data-language-picker]').selectOption(locale);
   assert.equal(await page.locator('html').getAttribute('lang'),locale);
   if(hasControl)assert.equal(await control.inputValue(),'私の草稿 <b>Delete</b>');
   const mismatches=await page.evaluate(()=>[...document.querySelectorAll('[data-i18n]')].filter(e=>e.textContent!==I18n.t(e.dataset.i18n)).map(e=>e.dataset.i18n));
   assert.deepEqual(mismatches,[]);
   assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('[data-i18n]')].map(e=>e.dataset.i18n).filter(key=>!APP_MESSAGES[key])),[],'Missing catalog keys');
   const missing = await page.evaluate(() => {
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT), found=[];
    while(walker.nextNode()) {const node=walker.currentNode,source=node.textContent.trim().replace(/\s+/g,' ');
     if(APP_MESSAGES[source] && I18n.t(source)!==source && !node.parentElement.closest('script,select,textarea')) found.push(source);
    } return found;
   });
   assert.deepEqual(missing,[], 'Untranslated authored text');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow in '+locale);
  }
  await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'zh-TW');
  assert.deepEqual(await page.evaluate(()=>[
   I18n.resolve(['fr-FR','de-AT']),I18n.resolve(['zh-Hant-HK']),I18n.resolve(['zh-SG']),I18n.resolve(['hi-IN']),I18n.resolve(['ja-JP'])
  ]),['de','zh-TW','zh-CN','en','ja']);
  assert.equal(await page.evaluate(()=>I18n.t('A missing diagnostic stays readable.')),'A missing diagnostic stays readable.');
  // Interpolation is text, never HTML; language changes preserve both parameters and draft inputs.
  await page.evaluate(()=>{const el=document.createElement('p');el.id='test-message';document.body.append(el);I18n.text(el,'{0} of {1} bookmarks',{0:'<img src=x onerror=alert(1)>',1:3});});
  await page.locator('[data-language-picker]').selectOption('de');
  assert.equal(await page.locator('#test-message img').count(),0);
  assert.ok((await page.locator('#test-message').textContent()).includes('<img'));
  // A user-authored node identical to a source phrase must never be translated.
  await page.evaluate(()=>{const el=document.createElement('p');el.id='user-content';el.textContent='Delete';document.body.append(el);});
  await page.locator('[data-language-picker]').selectOption('ja');
  assert.equal(await page.locator('#user-content').textContent(),'Delete');
  await page.locator('#test-message').evaluate(e=>e.remove());await page.locator('#user-content').evaluate(e=>e.remove());
  if (await page.locator('#url').count()) {
   await page.locator('#title').fill('Delete');await page.locator('#url').fill('https://example.org/unchanged');
   await page.locator('#collection').fill('All collections');await page.locator('#notes').fill('原文 <b>unchanged</b>');
   await page.locator('#editor').evaluate(form=>form.requestSubmit());
   await page.waitForFunction(()=>document.querySelector('#status').textContent===I18n.t('Bookmark saved.'));
   await page.locator('[data-language-picker]').selectOption('es');
   assert.equal(await page.locator('#list li a').textContent(),'Delete');
   assert.ok((await page.locator('#list').textContent()).includes('All collections'));
   assert.ok((await page.locator('#list').textContent()).includes('原文 <b>unchanged</b>'));
  }
  if (await page.locator('#body').count()) {
   await page.locator('#title').fill('Delete');await page.locator('#body').fill('原文 {{first_name}}');
   await page.locator('#save').click();
   await page.waitForFunction(()=>document.querySelector('#status').textContent===I18n.t('Snippet saved in this browser.'));
   await page.locator('[data-language-picker]').selectOption('es');
   assert.equal(await page.locator('#body').inputValue(),'原文 {{first_name}}');
   assert.equal(await page.locator('#list strong').textContent(),'Delete');
  }
  if(process.env.I18N_SCREENSHOT){await page.locator('[data-language-picker]').selectOption('de');await page.screenshot({path:process.env.I18N_SCREENSHOT,fullPage:true});}
  assert.deepEqual(errors,[]);
  // Restricted storage must not prevent either rendering or switching.
  const blocked=await browser.newContext({locale:'es-ES'});
  if(process.env.TEST_EXTENSION_UI) await blocked.addInitScript(extensionFixture);
  await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}}));
  const second=await blocked.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto(process.env.TEST_URL);await second.locator('[data-language-picker]').waitFor();assert.equal(await second.locator('html').getAttribute('lang'),'es');
  await second.locator('[data-language-picker]').selectOption('zh-CN');assert.equal(await second.locator('html').getAttribute('lang'),'zh-CN');
  assert.deepEqual(errors,[]);
  console.log('PASS: six locales, regional detection, saved preference, fallback, draft/content preservation, safe interpolation, narrow layout, blocked storage');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
