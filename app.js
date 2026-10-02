import {createClient} from '@supabase/supabase-js';
const db=createClient('https://fgomaujsdblpzxhnnqrg.supabase.co','sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i');
const $=id=>document.getElementById(id);
let items=[],selected=null,user=null,editing=false,busy=false,request=0,changing=false,revealItem=null;
let draft=null,timer=null,saveQueue=Promise.resolve();
const report=message=>{$('status').textContent=message};
function check(r){if(r.error)throw r.error;return r.data}
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=true);report('');try{await fn()}catch(e){report(e.message||'Unable to save. Please try again.')}finally{busy=false;document.querySelectorAll('button[type=submit]').forEach(b=>b.disabled=false)}}
const speaker=()=>document.querySelector('input[name=speaker]:checked').value;
function clearDraft(){clearTimeout(timer);draft=null;$('body').value='';$('compose').hidden=true}
function resetLog(){request++;clearDraft();$('conversation').hidden=true;$('welcome').hidden=false;$('records').replaceChildren();$('item-actions').hidden=true}
function renderItems(){const list=$('items');list.replaceChildren();$('count').textContent=items.length;for(const item of items){const row=document.createElement('div');row.setAttribute('role','option');row.setAttribute('aria-selected',String(selected?.id===item.id));row.id='item-'+item.id;row.textContent=item.name;list.append(row)}updateSelection()}
function updateSelection(){for(const row of $('items').children)row.setAttribute('aria-selected',String(row.id==='item-'+selected?.id));if(selected)$('items').setAttribute('aria-activedescendant','item-'+selected.id);else $('items').removeAttribute('aria-activedescendant');for(const id of ['change','delete','log'])$(id).disabled=!selected}
async function select(id){if(changing||id===selected?.id)return;revealItem=null;changing=true;$('body').disabled=true;try{await flushDraft();selected=items.find(i=>i.id===id)||null;resetLog();updateSelection();await openLog()}catch(e){report(e.message)}finally{changing=false;$('body').disabled=false;if(revealItem===selected?.id)$('item-actions').hidden=false}}
// Keep option nodes stable between the two clicks of a double-click.
$('items').onclick=e=>{const row=e.target.closest('[role=option]');if(row)select(row.id.slice(5))};
$('items').ondblclick=async e=>{const row=e.target.closest('[role=option]');if(!row)return;const id=row.id.slice(5);if(!changing)await select(id);revealItem=id;if(selected?.id===id)$('item-actions').hidden=false};
$('items').onkeydown=e=>{if(e.key==='Enter'&&selected){$('item-actions').hidden=false;return}if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key)||!items.length)return;e.preventDefault();let i=items.findIndex(x=>x.id===selected?.id);i=e.key==='Home'?0:e.key==='End'?items.length-1:e.key==='ArrowDown'?Math.min(i+1,items.length-1):Math.max(i-1,0);select(items[i].id);$('item-'+items[i].id).scrollIntoView({block:'nearest'})};
async function loadItems(){items=check(await db.from('elliot_log_items_v1').select('id,name,created_at').order('created_at').order('id'));selected=items.find(i=>i.id===selected?.id)||null;renderItems()}
function dateLabel(value){const d=new Date(value);return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(d)}`}
async function openLog(){if(!selected)return;const itemId=selected.id,seq=++request;$('welcome').hidden=true;$('conversation').hidden=false;const rows=[];for(let from=0;;from+=500){const batch=check(await db.from('elliot_log_records_v1').select('id,speaker,body,created_at').eq('item_id',itemId).order('created_at').order('id').range(from,from+499));rows.push(...batch);if(batch.length<500)break}if(seq!==request||selected?.id!==itemId)return;const records=$('records');records.replaceChildren();if(!rows.length){const p=document.createElement('p');p.textContent='No entries yet. Double-click Log to add one.';p.style.color='#60728a';records.append(p)}for(const row of rows){const article=document.createElement('article');article.className='record'+(row.speaker==='Other'?' other':'');const meta=document.createElement('div');meta.className='record-meta';const who=document.createElement('strong');who.textContent=row.speaker;const time=document.createElement('time');time.dateTime=row.created_at;time.textContent=dateLabel(row.created_at);time.title=new Date(row.created_at).toLocaleString();meta.append(who,time);const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=row.body;article.append(meta,bubble);records.append(article)}records.scrollTop=records.scrollHeight}
function saveDraft(){clearTimeout(timer);if(!draft)return saveQueue;const current=draft,body=$('body').value.trim(),who=speaker();if(!body){if(current.persisted)$('save-status').textContent='An empty entry cannot replace the saved text.';return saveQueue}const snapshot={body,speaker:who};
  const task=saveQueue.catch(()=>{}).then(async()=>{
    if(current.saved?.body===body&&current.saved?.speaker===who)return;
    if(draft===current)$('save-status').textContent='Saving…';
    // A stable ID makes retrying an interrupted first save safe.
    if(!current.persisted){const found=check(await db.from('elliot_log_records_v1').select('id').eq('id',current.id).maybeSingle());current.persisted=!!found}
    if(current.persisted)check(await db.from('elliot_log_records_v1').update(snapshot).eq('id',current.id).select().single());
    else{check(await db.from('elliot_log_records_v1').insert({id:current.id,item_id:current.itemId,...snapshot}).select().single());current.persisted=true}
    current.saved=snapshot;
    if(draft===current){$('save-status').textContent=$('body').value.trim()===body&&speaker()===who?'Saved automatically. Double-click Log for a new entry.':'Changes waiting to save…';if(selected?.id===current.itemId)await openLog()}
  });
  saveQueue=task;task.catch(e=>{if(draft===current)$('save-status').textContent='Not saved. '+e.message;report('Entry could not be saved. Your text is still in the entry field.')});return task;
}
async function flushDraft(){clearTimeout(timer);await saveDraft();if(draft?.persisted&&!$('body').value.trim())throw Error('Enter text before leaving this entry. The saved entry has not been erased.')}
function scheduleSave(){if(!draft||$('body').disabled)return;clearTimeout(timer);$('save-status').textContent='Changes waiting to save…';timer=setTimeout(()=>saveDraft(),1000)}
$('body').oninput=scheduleSave;$('body').onblur=()=>saveDraft();document.querySelectorAll('input[name=speaker]').forEach(r=>r.onchange=scheduleSave);
$('compose').onsubmit=e=>{e.preventDefault();saveDraft()};
$('log').onclick=()=>run(openLog);
async function newEntry(){if(!selected||changing)return;changing=true;$('body').disabled=true;try{await flushDraft();draft={id:crypto.randomUUID(),itemId:selected.id,persisted:false,saved:null};$('body').value='';$('compose').hidden=false;$('save-status').textContent='Text saves automatically. Double-click Log for a new entry.'}finally{changing=false;$('body').disabled=false;$('body').focus()}}
$('log').ondblclick=()=>{newEntry().catch(e=>report(e.message))};
$('log').onkeydown=e=>{if(e.key==='Enter'&&e.shiftKey){e.preventDefault();newEntry().catch(e=>report(e.message))}};
function itemDialog(change){editing=change;$('dialog-title').textContent=change?'Change item':'Add item';$('item-name').value=change?selected.name:'';$('item-dialog').showModal();$('item-name').focus()}
$('add').onclick=()=>itemDialog(false);$('change').onclick=()=>selected&&itemDialog(true);$('cancel').onclick=()=>$('item-dialog').close();
$('item-form').onsubmit=e=>{e.preventDefault();run(async()=>{const name=$('item-name').value.trim();if(!name)throw Error('Enter an item name.');await flushDraft();if(editing){if(!selected)throw Error('Select an item first.');check(await db.from('elliot_log_items_v1').update({name}).eq('id',selected.id).select().single())}else{selected=check(await db.from('elliot_log_items_v1').insert({name}).select().single());resetLog()}await loadItems();$('item-dialog').close();await openLog()})};
$('delete').onclick=()=>{if(!selected||!confirm(`Delete “${selected.name}” and all its log entries?`))return;run(async()=>{await flushDraft();check(await db.from('elliot_log_items_v1').delete().eq('id',selected.id).select().single());selected=null;resetLog();await loadItems()})};
$('login').onsubmit=e=>{e.preventDefault();run(async()=>{check(await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}));$('password').value=''})};
$('signout').onclick=()=>run(async()=>{await flushDraft();check(await db.auth.signOut())});
async function setSession(session){const next=session?.user||null;if(user?.id===next?.id)return;user=next;selected=null;items=[];resetLog();$('auth').hidden=!!user;$('workspace').hidden=!user;$('signout').hidden=!user;renderItems();if(user){try{await loadItems()}catch(e){report(e.message)}}}
db.auth.onAuthStateChange((event,session)=>{setTimeout(()=>setSession(session),0)});
db.auth.getSession().then(({data,error})=>error?report(error.message):setSession(data.session));
window.addEventListener('beforeunload',e=>{if(draft&&$('body').value.trim()&&(draft.saved?.body!==$('body').value.trim()||draft.saved?.speaker!==speaker())){e.preventDefault();e.returnValue=''}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveDraft()});
