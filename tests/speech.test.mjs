import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('speech ignores cumulative interim guesses and saves final segments once',async()=>{
 const elements=new Map(),timers=new Map(),saved=[];
 const element=()=>({value:'',classList:{add(){},remove(){}},focus(){},replaceChildren(){},append(){}});
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
 assert.equal(session.interimResults,false);
 const result=(text,isFinal)=>Object.assign([{transcript:text}],{isFinal});
 const guesses=['send','send the','send the emails','send the emails to families'];
 session.onresult({results:guesses.map(text=>result(text,false))});
 assert.equal(get('entry').value,'');
 const final=result('Send the emails to families.',true);
 session.onresult({results:[...guesses.map(text=>result(text,false)),final]});
 assert.equal(get('entry').value,'Send the emails to families.');
 session.onresult({results:[final]});
 assert.equal(get('entry').value,'Send the emails to families.');
 // Separate final segments, including intentional repetitions, must survive.
 const second=result('Yes yes, tomorrow.',true);
 session.onresult({results:[final,second]});
 assert.equal(get('entry').value,'Send the emails to families. Yes yes, tomorrow.');
 for(const [id,timer] of [...timers])if(timer.ms===3000){timers.delete(id);timer.fn()}
 await new Promise(resolve=>setImmediate(resolve));
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

});

