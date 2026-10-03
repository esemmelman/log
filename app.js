import {createClient} from '@supabase/supabase-js';
const db=createClient('https://fgomaujsdblpzxhnnqrg.supabase.co','sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i');
const $=id=>document.getElementById(id);
let items=[],selected=null,user=null,editing=false,busy=false,request=0,changing=false,revealItem=null;
let draft=null,saving=false,logOn=true;
const report=message=>{$('status').textContent=message};
function check(r){if(r.error)throw r.error;return r.data}
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=true);report('');try{await fn()}catch(e){report(e.message||'Unable to save. Please try again.')}finally{busy=false;document.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=false)}}
const RICH_PREFIX='<!--log-rich-v1-->';
const editorText=()=>($('body').textContent||'').trim();
function cleanHTML(html){
 const template=document.createElement('template');template.innerHTML=html;
 const allowed=new Set(['P','DIV','BR','B','STRONG','I','EM','U','S','STRIKE','H2','H3','UL','OL','LI','BLOCKQUOTE','A','SPAN']);
 for(const node of [...template.content.querySelectorAll('*')]){
  if(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH'].includes(node.tagName)){node.remove();continue}
  if(!allowed.has(node.tagName)){node.replaceWith(...node.childNodes);continue}
  const href=node.getAttribute('href'),align=node.style.textAlign;
  for(const attr of [...node.attributes])node.removeAttribute(attr.name);
  if(['left','center','right'].includes(align))node.style.textAlign=align;
  if(node.tagName==='A'&&href&&/^(https?:|mailto:)/i.test(href)){node.setAttribute('href',href);node.setAttribute('target','_blank');node.setAttribute('rel','noopener noreferrer')}
 }
 return template.innerHTML;
}
$('editor-toolbar').onmousedown=e=>{if(e.target.closest('button'))e.preventDefault()};
$('editor-toolbar').onclick=e=>{const button=e.target.closest('button');if(!button||button.disabled)return;let value=button.dataset.value||null;if(button.dataset.command==='createLink'){value=prompt('Link URL (https:// or mailto:)');if(!value||!/^(https?:|mailto:)/i.test(value))return}$('body').focus();document.execCommand(button.dataset.command,false,value)};
$('body').onpaste=e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))};
const speaker=()=>document.querySelector('input[name=speaker]:checked').value;
function clearDraft(){draft=null;$('body').innerHTML='';$('compose').hidden=true}
function resetLog(){request++;clearDraft();$('conversation').hidden=true;$('welcome').hidden=false;$('records').replaceChildren();$('item-actions').hidden=true}
function renderItems(){items.sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));const list=$('items');list.replaceChildren();$('count').textContent=items.length;for(const item of items){const row=document.createElement('div');row.setAttribute('role','option');row.setAttribute('aria-selected',String(selected?.id===item.id));row.id='item-'+item.id;row.textContent=item.name;list.append(row)}updateSelection()}
function updateLogToggle(){$('log').setAttribute('aria-selected',String(logOn))}
updateLogToggle();
function updateSelection(){for(const row of $('items').children)row.setAttribute('aria-selected',String(row.id==='item-'+selected?.id));if(selected)$('items').setAttribute('aria-activedescendant','item-'+selected.id);else $('items').removeAttribute('aria-activedescendant');for(const id of ['change','delete'])$(id).disabled=!selected}
async function select(id){if(changing||id===selected?.id)return;revealItem=null;changing=true;$('body').contentEditable='false';try{await flushDraft();selected=items.find(i=>i.id===id)||null;resetLog();updateSelection();}catch(e){report(e.message)}finally{changing=false;$('body').contentEditable='true';if(revealItem===selected?.id)$('item-actions').hidden=false}if(logOn&&selected)try{await openLog()}catch(e){report(e.message)}}
// Keep option nodes stable between the two clicks of a double-click.
$('items').onclick=e=>{const row=e.target.closest('[role=option]');if(row)select(row.id.slice(5))};
$('items').ondblclick=async e=>{const row=e.target.closest('[role=option]');if(!row)return;const id=row.id.slice(5);if(!changing)await select(id);revealItem=id;if(selected?.id===id)$('item-actions').hidden=false};
$('items').onkeydown=e=>{if(e.key==='Enter'&&selected){$('item-actions').hidden=false;return}if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key)||!items.length)return;e.preventDefault();let i=items.findIndex(x=>x.id===selected?.id);i=e.key==='Home'?0:e.key==='End'?items.length-1:e.key==='ArrowDown'?Math.min(i+1,items.length-1):Math.max(i-1,0);select(items[i].id);$('item-'+items[i].id).scrollIntoView({block:'nearest'})};
async function loadItems(){items=check(await db.from('elliot_log_items_v1').select('id,name,created_at').order('created_at').order('id'));selected=items.find(i=>i.id===selected?.id)||null;renderItems()}
function dateLabel(value){const d=new Date(value);return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(d)}. ${d.getHours()%12||12}:${String(d.getMinutes()).padStart(2,'0')} ${d.getHours()<12?'am':'pm'}`}
async function openLog(){if(!selected)return;const itemId=selected.id,seq=++request;$('welcome').hidden=true;$('conversation').hidden=false;const rows=[];for(let from=0;;from+=500){const batch=check(await db.from('elliot_log_records_v1').select('id,speaker,body,created_at').eq('item_id',itemId).order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,from+499));rows.push(...batch);if(batch.length<500)break}if(seq!==request||selected?.id!==itemId)return;const records=$('records');records.replaceChildren();if(!rows.length){const p=document.createElement('p');p.textContent='No entries yet. Double-click Log to add one.';p.style.color='#60728a';records.append(p)}for(const row of rows){const article=document.createElement('article');article.className='record'+(row.speaker==='Other'?' other':'');const meta=document.createElement('div');meta.className='record-meta';const who=document.createElement('strong');who.textContent=row.speaker;const time=document.createElement('time');time.dateTime=row.created_at;time.textContent=dateLabel(row.created_at);time.title=new Date(row.created_at).toLocaleString();meta.append(who,time);const bubble=document.createElement('div');bubble.className='bubble';if(row.body.startsWith(RICH_PREFIX))bubble.innerHTML=cleanHTML(row.body.slice(RICH_PREFIX.length));else bubble.textContent=row.body;article.append(meta,bubble);records.append(article)}records.scrollTop=0}
async function saveDraft(){
  if(!draft||saving)return;
  const current=draft,body=editorText(),who=speaker();
  if(!body){$('save-status').textContent='Enter text before saving.';$('body').focus();return}
  if(body.length>20000){$('save-status').textContent='Please keep entries under 20,000 characters.';return}
  saving=true;setComposeDisabled(true);$('save-status').textContent='Saving…';
  try{
    // Reuse the ID on retries if a response was lost after a successful insert.
    const found=check(await db.from('elliot_log_records_v1').select('id').eq('id',current.id).maybeSingle());
    if(!found)check(await db.from('elliot_log_records_v1').insert({id:current.id,item_id:current.itemId,body:RICH_PREFIX+cleanHTML($('body').innerHTML),speaker:who}).select().single());
    clearDraft();report('');await openLog();
  }catch(e){$('save-status').textContent='Not saved. '+e.message;report('Entry could not be saved. Your text is still in the entry field.');throw e}
  finally{saving=false;setComposeDisabled(false)}
}
function setComposeDisabled(value){$('body').contentEditable=String(!value);$('editor-toolbar').querySelectorAll('button').forEach(b=>b.disabled=value);$('save-entry').disabled=value;$('cancel-entry').disabled=value;document.querySelectorAll('input[name=speaker]').forEach(r=>r.disabled=value)}
async function flushDraft(){if(saving)throw Error('Please wait for the entry to finish saving.');if(draft)throw Error('Save or cancel your entry before continuing.')}
$('compose').onsubmit=e=>{e.preventDefault();saveDraft().catch(()=>{})};
$('cancel-entry').onclick=()=>{if(!saving){clearDraft();report('')}};
$('log').onclick=e=>{if(e.detail>1)return;run(async()=>{await flushDraft();logOn=!logOn;updateLogToggle();if(logOn)await openLog();else resetLog()})};
async function newEntry(){if(!selected||changing)return;changing=true;$('body').contentEditable='false';try{await flushDraft();logOn=true;updateLogToggle();await openLog();draft={id:crypto.randomUUID(),itemId:selected.id};$('body').innerHTML='';$('compose').hidden=false;$('save-status').textContent='Click Save to add this entry, or Cancel to discard it.'}finally{changing=false;$('body').contentEditable='true';$('body').focus()}}
$('log').ondblclick=()=>{newEntry().catch(e=>report(e.message))};
$('views').onkeydown=e=>{if(e.key==='Enter'&&e.shiftKey){e.preventDefault();newEntry().catch(e=>report(e.message))}else if(e.key==='Enter'||e.key===' '){e.preventDefault();$('log').onclick({detail:0})}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();$('views').setAttribute('aria-activedescendant','log')}};
function itemDialog(change){editing=change;$('dialog-title').textContent=change?'Change item':'Add item';$('item-name').value=change?selected.name:'';$('item-dialog').showModal();$('item-name').focus()}
$('add').onclick=()=>itemDialog(false);$('add').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();itemDialog(false)}};$('change').onclick=()=>selected&&itemDialog(true);$('cancel').onclick=()=>$('item-dialog').close();
$('item-form').onsubmit=e=>{e.preventDefault();run(async()=>{const name=$('item-name').value.trim();if(!name)throw Error('Enter an item name.');await flushDraft();if(editing){if(!selected)throw Error('Select an item first.');check(await db.from('elliot_log_items_v1').update({name}).eq('id',selected.id).select().single())}else{selected=check(await db.from('elliot_log_items_v1').insert({name}).select().single());resetLog()}await loadItems();$('item-dialog').close();if(logOn)await openLog()})};
$('delete').onclick=()=>{if(!selected||!confirm(`Delete “${selected.name}” and all its log entries?`))return;run(async()=>{await flushDraft();check(await db.from('elliot_log_items_v1').delete().eq('id',selected.id).select().single());selected=null;resetLog();await loadItems()})};
$('login').onsubmit=e=>{e.preventDefault();run(async()=>{check(await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}));$('password').value=''})};
$('signout').onclick=()=>run(async()=>{await flushDraft();check(await db.auth.signOut())});
async function setSession(session){const next=session?.user||null;if(user?.id===next?.id)return;user=next;selected=null;items=[];resetLog();$('auth').hidden=!!user;$('workspace').hidden=!user;$('signout').hidden=!user;renderItems();if(user){try{await loadItems()}catch(e){report(e.message)}}}
db.auth.onAuthStateChange((event,session)=>{setTimeout(()=>setSession(session),0)});
db.auth.getSession().then(({data,error})=>error?report(error.message):setSession(data.session));
window.addEventListener('beforeunload',e=>{if(draft&&editorText()){e.preventDefault();e.returnValue=''}});
