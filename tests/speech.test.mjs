import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('speech previews interim revisions without duplication and saves only on Go',async()=>{
 const elements=new Map(),timers=new Map(),saved=[];
 const element=()=>({value:'',style:{},scrollHeight:36,classList:{add(){},remove(){}},focus(){},replaceChildren(){},append(){}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
 let session,timerId=0;
 class Speech{constructor(){session=this}start(){this.onstart()}stop(){this.onend()}abort(){}}
 const db={auth:{onAuthStateChange(){},getSession(){return new Promise(()=>{})}},from(){return {
  select(){return this},eq(){return this},order(){return this},
  limit:async()=>({data:[{id:'log'}]}),maybeSingle:async()=>({data:null}),
  insert(row){saved.push(row);return this},single:async()=>({data:{id:'record'}}),range:async()=>({data:[]})
 }}};
 const context=vm.createContext({version:'test',createClient:()=>db,document:{getElementById:get,createElement:element,documentElement:element()},window:{SpeechRecognition:Speech,addEventListener(){}},navigator:{userAgent:'Android',language:'en-US'},crypto:{randomUUID:()=> 'stable-id'},setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId},clearTimeout(id){timers.delete(id)}});
 vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,''),context);
 vm.runInContext('startAudio()',context);
 assert.equal(session.interimResults,true);
 const result=(text,isFinal)=>Object.assign([{transcript:text}],{isFinal});
 const guesses=['send','send the','send the emails','send the emails to families'];
 session.onresult({results:guesses.map(text=>result(text,false))});
 assert.equal(get('entry').value,'send the emails to families');
 session.onresult({results:[result('send the letters',false)]});
 assert.equal(get('entry').value,'send the letters');
 assert.equal(saved.length,0);
 // Reproduce Android's cumulative final guesses from the reported screenshot.
 const plastic=['plastic','plastic','plastic covers','plastic covers','plastic covers come','plastic covers come Friday'];
 for(let count=1;count<=plastic.length;count++){
  session.onresult({results:plastic.slice(0,count).map(text=>result(text,true))});
 }
 assert.equal(get('entry').value,'plastic covers come Friday');
 // A replacement can correct a word rather than extend the exact prefix.
 const corrected=['moved over enough money to pay for sclero','moved over enough money to pay for scleral lenses'];
 session.onresult({results:corrected.map(text=>result(text,true))});
 assert.equal(get('entry').value,corrected[1]);
 session.onresult({results:[result(corrected[0],true),result(corrected[1],false)]});
 assert.equal(get('entry').value,corrected[1]);
 session.onresult({results:[result('I paid the bill',true),result('I paid the bill',true)]});
 assert.equal(get('entry').value,'I paid the bill I paid the bill');
 session.onresult({results:[result('I went to the bank yesterday',true),result('I went to the store today',true)]});
 assert.equal(get('entry').value,'I went to the bank yesterday I went to the store today');
 session.onresult({results:[...plastic.slice(0,-1).map(text=>result(text,true)),result(plastic.at(-1),false)]});
 assert.equal(get('entry').value,'plastic covers come Friday');
 session.onresult({results:[result('Yes',true),result('Yes',true)]});
 assert.equal(get('entry').value,'Yes Yes');
 session.onresult({results:[result('plastic',true),result('plasticity',true)]});
 assert.equal(get('entry').value,'plastic plasticity');
 assert.equal(saved.length,0);
 const final=result('Send the emails to families.',true);
 session.onresult({results:[...guesses.map(text=>result(text,false)),final]});
 assert.equal(get('entry').value,'Send the emails to families.');
 session.onresult({results:[final]});
 assert.equal(get('entry').value,'Send the emails to families.');
 // Separate final segments, including intentional repetitions, must survive.
 session.onresult({results:[final,result('Yes yes',false)]});
 assert.equal(get('entry').value,'Send the emails to families. Yes yes');
 const second=result('Yes yes, tomorrow.',true);
 session.onresult({results:[final,second]});
 assert.equal(get('entry').value,'Send the emails to families. Yes yes, tomorrow.');
 for(const [id,timer] of [...timers])if(timer.ms===3000){timers.delete(id);timer.fn()}
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(saved.length,0);
 get('entry').onkeydown({key:'Enter'});
 assert.equal(saved.length,0);
 await get('go').onclick();
 assert.equal(saved.length,1);
 assert.equal(saved[0].body,'Send the emails to families. Yes yes, tomorrow.');
 vm.runInContext('idle()',context);
 assert.equal(get('entry').placeholder,'');
 // A third click after the double-click enters search without losing a draft.
 get('entry').value='Unfinished draft';
 get('entry').ondblclick();
 get('entry').onclick({detail:3});
 assert.equal(vm.runInContext('mode',context),'search');
 assert.equal(get('entry').value,'');
 get('entry').value='missing entry';
 get('entry').oninput();
 assert.equal(get('empty').textContent,'No matching entries.');
 get('entry').onkeydown({key:'Enter',preventDefault(){}});
 assert.equal(saved.length,1);
 get('entry').onkeydown({key:'Escape'});
 assert.equal(get('entry').value,'Unfinished draft');
 assert.equal(vm.runInContext('mode',context),'text');
 assert.equal(get('empty').textContent,'No entries yet.');
 get('entry').scrollHeight=80;
 get('entry').oninput();
 assert.equal(get('entry').style.height,'82px');
 assert.equal(get('entry').placeholder,'');
 // Empty selection cancels recognition and pending click work at five seconds.
 function expireBlank(){
  for(const [id,timer] of [...timers])if(timer.ms===5000){timers.delete(id);timer.fn()}
 }
 get('entry').value='';vm.runInContext('idle()',context);
 get('entry').onclick({detail:1});vm.runInContext('startAudio()',context);
 expireBlank();
 assert.equal(vm.runInContext('mode',context),'idle');
 assert.equal(vm.runInContext('recognition',context),null);
 assert.equal(get('status').textContent,'');
 assert.equal([...timers.values()].some(t=>t.ms===400),false);
 // Drafts survive the timeout; blank search restores the previous draft.
 get('entry').ondblclick();get('entry').value='Keep this';get('entry').oninput();
 expireBlank();assert.equal(get('entry').value,'Keep this');
 get('entry').onclick({detail:3});expireBlank();
 assert.equal(get('entry').value,'Keep this');
 assert.equal(vm.runInContext('mode',context),'text');
 assert.equal(saved.length,1);

});

