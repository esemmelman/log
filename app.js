import {createClient} from '@supabase/supabase-js';
import {version} from './package.json';
const db=createClient('https://fgomaujsdblpzxhnnqrg.supabase.co','sb_publishable_JOUqLZDnfGu_yCa6k6FVDQ_AYwpr72i');
const $=id=>document.getElementById(id), entry=$('entry');
$('version').textContent='v'+version;
if(/Android/i.test(navigator.userAgent))document.documentElement.classList.add('android');
let user=null,rows=[],itemId=null,draftId=null,saving=false,mode='idle',recognition=null,clickTimer,silenceTimer,stopTimer,loadVersion=0,searchDraft='',blankTimer;
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
 const query=mode==='search'?entry.value.trim().toLocaleLowerCase():'';
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
function resizeEntry(){entry.style.height='auto';entry.style.height=(entry.scrollHeight+2)+'px'}
function watchBlankEntry(){
 if(entry.value.trim()||saving){clearTimeout(blankTimer);blankTimer=null;return}
 if(blankTimer)return;
 blankTimer=setTimeout(()=>{
  blankTimer=null;if(entry.value.trim()||saving)return;
  clearTimeout(clickTimer);stopAudio();
  if(mode==='search'){entry.value=searchDraft;searchDraft='';}
  entry.value?textMode():idle();report('');render();
 },5000);
}
function textMode(message=''){
 clearTimeout(clickTimer);stopAudio();mode='text';$('go').disabled=false;entry.readOnly=false;entry.placeholder='';entry.focus();resizeEntry();report(message);watchBlankEntry();
}
function searchMode(){
 clearTimeout(clickTimer);if(mode==='search')return;stopAudio();searchDraft=entry.value;mode='search';entry.readOnly=false;entry.value='';entry.placeholder='Search entries';entry.focus();report('Search entries. Press Escape to return.');$('go').disabled=true;resizeEntry();render();watchBlankEntry();
}
function stopAudio(){
 clearTimeout(silenceTimer);clearTimeout(stopTimer);
 const old=recognition;recognition=null;if(old){old.onend=null;old.onresult=null;old.onerror=null;old.abort()}
 entry.classList.remove('listening');
}
function idle(){clearTimeout(blankTimer);blankTimer=null;mode='idle';entry.readOnly=true;entry.placeholder='';entry.classList.remove('listening');$('go').disabled=false;resizeEntry()}
async function save(){
 if(mode==='search')return;
 clearTimeout(clickTimer);
 const body=entry.value.trim();if(saving||!body){if(!body){stopAudio();idle();report('No speech detected.')}return}
 if(body.length>20000){textMode('Keep entries under 20,000 characters.');return}
 saving=true;clearTimeout(blankTimer);blankTimer=null;stopAudio();entry.disabled=true;$('go').disabled=true;report('Saving...');draftId??=crypto.randomUUID();
 try{
  if(!itemId){
   const items=check(await db.from('elliot_log_items_v1').select('id').eq('name','Log').order('created_at').limit(1));
   itemId=items[0]?.id||check(await db.from('elliot_log_items_v1').insert({name:'Log'}).select('id').single()).id;
  }
  const existing=check(await db.from('elliot_log_records_v1').select('id').eq('id',draftId).maybeSingle());
  if(!existing)check(await db.from('elliot_log_records_v1').insert({id:draftId,item_id:itemId,speaker:'Me',body}).select('id').single());
  entry.value='';draftId=null;idle();report('Saved.');
  try{await load()}catch(e){report('Saved, but the list could not refresh. Reload to see the entry.')}
 }catch(e){textMode('Not saved. Your entry is still here. Press Go to retry. '+e.message)}
 finally{saving=false;entry.disabled=false;$('go').disabled=false;entry.focus()}
}
function armSilence(){clearTimeout(silenceTimer);silenceTimer=setTimeout(finishAudio,3000)}
function finishAudio(){
 clearTimeout(silenceTimer);if(!recognition)return;
 mode='finishing';report('Finishing transcription...');
 // Arm before stop: an engine may emit end synchronously.
 stopTimer=setTimeout(()=>textMode(),1500);
 recognition.stop();
}
function collapseSpeechHistory(parts){
 const key=text=>text.trim().toLocaleLowerCase().replace(/[.,!?;:]+$/g,'').replace(/\s+/g,' ');
 const revises=(previous,next)=>{
  if(next.startsWith(previous+' '))return true;
  const before=previous.split(' '),after=next.split(' ');
  let shared=0;
  while(shared<Math.min(before.length,after.length)&&before[shared]===after[shared])shared++;
  // Android can append a replacement hypothesis with a corrected ending,
  // e.g. "...pay for sclero" followed by "...pay for scleral lenses".
  // Require a substantial shared phrase and limit changes to its last words.
  const oldWord=before[shared]||'',newWord=after[shared]||'';
  let letters=0;
  while(letters<Math.min(oldWord.length,newWord.length)&&oldWord[letters]===newWord[letters])letters++;
  return shared>=3&&shared>=Math.ceil(before.length*.6)&&before.length-shared<=2&&after.length-shared<=3&&letters>=4;
 };
 const output=[];
 for(let start=0;start<parts.length;){
  let end=start,growing=false;
  while(end+1<parts.length){
   const previous=key(parts[end]),next=key(parts[end+1]);
   if(!previous||(next!==previous&&!revises(previous,next)))break;
   growing ||= next!==previous;end++;
  }
  // Collapse only a growing hypothesis chain; standalone repeated words survive.
  output.push(...(growing?[parts[end]]:parts.slice(start,end+1)));
  start=end+1;
 }
 return output;
}
function startAudio(){
 if(saving||mode==='text'||mode==='search'||recognition)return;
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){textMode('Voice entry is unavailable in this browser. Press Go when ready.');return}
 const session=new Speech();recognition=session;mode='audio';entry.readOnly=true;
 session.continuous=true;session.interimResults=true;session.lang=navigator.language||'en-US';
 entry.classList.add('listening');report('Listening... Press Go when ready.');
 session.onstart=()=>armSilence();
 session.onspeechstart=()=>clearTimeout(silenceTimer);
 session.onspeechend=()=>armSilence();
 session.onresult=e=>{
  if(recognition!==session)return;
  // Rebuild each snapshot so revised interim words replace their previous guess.
  // Android may label cumulative guesses as final, too.
  const results=Array.from(e.results),finals=results.filter(r=>r.isFinal);
  const lastFinal=results.reduce((last,r,i)=>r.isFinal?i:last,-1);
  const interim=[];
  for(const result of results.slice(lastFinal+1)){
   const text=result[0].transcript.trim(),previous=interim.at(-1);
   if(previous&&text.toLocaleLowerCase().startsWith(previous.toLocaleLowerCase()))interim[interim.length-1]=text;
   else interim.push(text);
  }
  let parts=[...finals.map(r=>r[0].transcript.trim()),...interim].filter(Boolean);
  if(/Android/i.test(navigator.userAgent))parts=collapseSpeechHistory(parts);
  entry.value=parts.join(' ').trim();
  resizeEntry();watchBlankEntry();if(mode==='audio')armSilence();
 };
 session.onerror=e=>{
  if(recognition!==session)return;
  textMode(e.error==='not-allowed'?'Microphone access was denied. Allow it in browser settings, or type here.':'Voice entry stopped. Review the text and press Go to save.');
 };
 session.onend=()=>{
  if(recognition!==session)return;
  if(mode==='finishing'){textMode();return}
  // Retain the three-second pause even if the browser ends recognition early.
  session.onend=null;armSilence();
 };
 try{session.start()}catch(e){textMode('Unable to start the microphone. Press Go when ready.')}
}
entry.onclick=e=>{if(saving)return;watchBlankEntry();if(e.detail===3){searchMode();return}if(mode==='text'||mode==='search')return;clearTimeout(clickTimer);if(e.detail<2)clickTimer=setTimeout(startAudio,400)};
entry.ondblclick=()=>{if(!saving&&mode!=='search')textMode()};
entry.onkeydown=e=>{
 if(e.isComposing)return;
 if(e.key==='Enter'&&mode==='idle'){e.preventDefault();clearTimeout(clickTimer);textMode()}
 if(e.key==='F2'){e.preventDefault();if(mode==='search'){entry.value=searchDraft;searchDraft='';}textMode();render()}
 if(e.key==='Escape'&&mode==='search'){entry.value=searchDraft;searchDraft='';entry.value?textMode():idle();report('');render();return}
 if(e.key==='Escape'){stopAudio();entry.value?textMode():idle();report('Voice entry stopped.')}
};
entry.onfocus=watchBlankEntry;
entry.oninput=()=>{resizeEntry();watchBlankEntry();if(mode==='search')render()};
$('go').onclick=()=>save();
window.addEventListener('resize',resizeEntry);
$('login').onsubmit=async e=>{
 e.preventDefault();const button=e.submitter;button.disabled=true;report('Signing in...');
 try{check(await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}));$('password').value=''}catch(e){report(e.message)}finally{button.disabled=false}
};
$('signout').onclick=async()=>{
 if(saving||(mode==='search'?searchDraft.trim():entry.value.trim())||recognition){report('Save your entry with Go, or clear it before signing out.');return}
 try{check(await db.auth.signOut())}catch(e){report(e.message)}
};
async function setSession(session){
 const next=session?.user||null;if(user?.id===next?.id)return;
 stopAudio();clearTimeout(clickTimer);loadVersion++;user=next;rows=[];itemId=null;draftId=null;entry.value='';searchDraft='';idle();render();
 $('auth').hidden=!!user;$('workspace').hidden=!user;report('');
 if(user)try{await load()}catch(e){report('Unable to load entries. '+e.message)}
}
db.auth.onAuthStateChange((event,session)=>setTimeout(()=>setSession(session),0));
db.auth.getSession().then(({data,error})=>error?report(error.message):setSession(data.session));
window.addEventListener('beforeunload',e=>{if((mode==='search'?searchDraft.trim():entry.value.trim())||saving||recognition){e.preventDefault();e.returnValue=''}});




