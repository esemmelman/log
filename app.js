import {createClient} from '@supabase/supabase-js';
const db=createClient('https://fgomaujsdblpzxhnnqrg.supabase.co','sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i');
const $=id=>document.getElementById(id), entry=$('entry');
if(/Android/i.test(navigator.userAgent))document.documentElement.classList.add('android');
let user=null,rows=[],itemId=null,draftId=null,saving=false,mode='idle',recognition=null,clickTimer,silenceTimer,stopTimer,loadVersion=0;
const check=r=>{if(r.error)throw r.error;return r.data};
const report=message=>{$('status').textContent=message};
function textBody(body){
 if(!body.startsWith('<!--log-rich-v1-->'))return body;
 const doc=new DOMParser().parseFromString(body.slice(18),'text/html');
 doc.querySelectorAll('script,style,iframe,object').forEach(n=>n.remove());
 doc.querySelectorAll('br').forEach(n=>n.replaceWith('\n'));
 doc.querySelectorAll('p,div,li,h2,h3,blockquote').forEach(n=>n.append('\n'));
 return doc.body.textContent.trim();
}
function render(){
 const query=$('search').value.trim().toLocaleLowerCase();
 const visible=rows.filter(r=>r.text.toLocaleLowerCase().includes(query));
 $('records').replaceChildren();
 for(const row of visible){
  const article=document.createElement('article'),time=document.createElement('time'),body=document.createElement('p');
  time.dateTime=row.created_at;time.textContent=new Date(row.created_at).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  body.textContent=row.text;article.append(time,body);$('records').append(article);
 }
 $('empty').textContent=visible.length?'':query?'No matching entries.':'No entries yet.';
}
async function load(){
 const version=++loadVersion,result=[];
 for(let from=0;;from+=500){
  const batch=check(await db.from('elliot_log_records_v1').select('id,body,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,from+499));
  result.push(...batch);if(batch.length<500)break;
 }
 if(version!==loadVersion)return;
 rows=result.map(r=>({...r,text:textBody(r.body)}));render();
}
function textMode(message='Type an entry, then press Enter to save.'){
 clearTimeout(clickTimer);stopAudio();mode='text';entry.readOnly=false;entry.placeholder='Type an entry…';entry.focus();report(message);
}
function stopAudio(){
 clearTimeout(silenceTimer);clearTimeout(stopTimer);
 const old=recognition;recognition=null;if(old){old.onend=null;old.onresult=null;old.onerror=null;old.abort()}
 entry.classList.remove('listening');
}
function idle(){mode='idle';entry.readOnly=true;entry.placeholder='Click to speak · Double-click to type';entry.classList.remove('listening')}
async function save(){
 const body=entry.value.trim();if(saving||!body){if(!body){stopAudio();idle();report('No speech detected. Click to try again, or double-click to type.')}return}
 if(body.length>20000){textMode('Keep entries under 20,000 characters.');return}
 saving=true;stopAudio();entry.disabled=true;report('Saving…');draftId??=crypto.randomUUID();
 try{
  if(!itemId){
   const items=check(await db.from('elliot_log_items_v1').select('id').eq('name','Log').order('created_at').limit(1));
   itemId=items[0]?.id||check(await db.from('elliot_log_items_v1').insert({name:'Log'}).select('id').single()).id;
  }
  const existing=check(await db.from('elliot_log_records_v1').select('id').eq('id',draftId).maybeSingle());
  if(!existing)check(await db.from('elliot_log_records_v1').insert({id:draftId,item_id:itemId,speaker:'Me',body}).select('id').single());
  entry.value='';draftId=null;idle();report('Saved.');
  try{await load()}catch(e){report('Saved, but the list could not refresh. Reload to see the entry.')}
 }catch(e){textMode('Not saved. Your entry is still here. Press Enter to retry. '+e.message)}
 finally{saving=false;entry.disabled=false;entry.focus()}
}
function armSilence(){clearTimeout(silenceTimer);silenceTimer=setTimeout(finishAudio,3000)}
function finishAudio(){
 clearTimeout(silenceTimer);if(!recognition)return;
 mode='finishing';report('Finishing transcription…');recognition.stop();
 // Some engines never emit end after stop; retain their latest interim result.
 stopTimer=setTimeout(()=>save(),1500);
}
function startAudio(){
 if(saving||mode==='text'||recognition)return;
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){textMode('Voice entry is unavailable in this browser. Type an entry and press Enter.');return}
 const session=new Speech();recognition=session;mode='audio';entry.readOnly=true;
 session.continuous=true;session.interimResults=true;session.lang=navigator.language||'en-US';
 entry.classList.add('listening');report('Listening… Saves after 3 seconds of silence.');
 session.onstart=()=>armSilence();
 session.onspeechstart=()=>clearTimeout(silenceTimer);
 session.onspeechend=()=>armSilence();
 session.onresult=e=>{
  if(recognition!==session)return;
  entry.value=Array.from(e.results,r=>r[0].transcript).join(' ').trim();
  if(mode==='audio')armSilence();
 };
 session.onerror=e=>{
  if(recognition!==session)return;
  textMode(e.error==='not-allowed'?'Microphone access was denied. Allow it in browser settings, or type here.':'Voice entry stopped. Review the text and press Enter to save.');
 };
 session.onend=()=>{
  if(recognition!==session)return;
  if(mode==='finishing'){clearTimeout(stopTimer);save();return}
  // Retain the three-second pause even if the browser ends recognition early.
  session.onend=null;armSilence();
 };
 try{session.start()}catch(e){textMode('Unable to start the microphone. Type here and press Enter.')}
}
entry.onclick=e=>{if(mode==='text'||saving)return;clearTimeout(clickTimer);if(e.detail<2)clickTimer=setTimeout(startAudio,400)};
entry.ondblclick=()=>{if(!saving)textMode()};
entry.onkeydown=e=>{
 if(e.isComposing)return;
 if(e.key==='Enter'){e.preventDefault();clearTimeout(clickTimer);if(mode==='text')save();else if(mode==='idle')startAudio()}
 if(e.key==='F2'){e.preventDefault();textMode()}
 if(e.key==='Escape'){stopAudio();entry.value?textMode():idle();report('Voice entry stopped.')}
};
$('search').oninput=render;
$('login').onsubmit=async e=>{
 e.preventDefault();const button=e.submitter;button.disabled=true;report('Signing in…');
 try{check(await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}));$('password').value=''}catch(e){report(e.message)}finally{button.disabled=false}
};
$('signout').onclick=async()=>{
 if(saving||entry.value.trim()||recognition){report('Save your entry with Enter, or clear it before signing out.');return}
 try{check(await db.auth.signOut())}catch(e){report(e.message)}
};
async function setSession(session){
 const next=session?.user||null;if(user?.id===next?.id)return;
 stopAudio();clearTimeout(clickTimer);loadVersion++;user=next;rows=[];itemId=null;draftId=null;entry.value='';idle();render();
 $('auth').hidden=!!user;$('workspace').hidden=!user;report('');
 if(user)try{await load()}catch(e){report('Unable to load entries. '+e.message)}
}
db.auth.onAuthStateChange((event,session)=>setTimeout(()=>setSession(session),0));
db.auth.getSession().then(({data,error})=>error?report(error.message):setSession(data.session));
window.addEventListener('beforeunload',e=>{if(entry.value.trim()||saving||recognition){e.preventDefault();e.returnValue=''}});

