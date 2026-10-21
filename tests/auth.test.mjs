import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'');
for(const state of ['signed in','signed out','error'])test('startup visibility: '+state,async()=>{
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.match(html,/<section id="auth"[^>]* hidden>/);
 const elements=new Map();
 const element=()=>({hidden:true,value:'',style:{},scrollHeight:40,classList:{add(){},remove(){}},replaceChildren(){}});
 const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
 let resolveSession,rejectSession;
 const db={auth:{onAuthStateChange(){},getSession(){return new Promise((resolve,reject)=>{resolveSession=resolve;rejectSession=reject})}},from(){return {select(){return this},order(){return this},range:async()=>({data:[]})}}};
 const context=vm.createContext({version:'test',createClient:()=>db,document:{getElementById:get,documentElement:element()},navigator:{userAgent:''},window:{addEventListener(){}},setTimeout,clearTimeout});
 vm.runInContext(source,context);
 assert.equal(get('auth').hidden,true);
 assert.equal(get('workspace').hidden,true);
 if(state==='error')rejectSession(new Error('Offline'));
 else resolveSession({data:{session:state==='signed in'?{user:{id:'user'}}:null}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('auth').hidden,state==='signed in');
 assert.equal(get('workspace').hidden,state!=='signed in');
 if(state==='error')assert.match(get('status').textContent,/Unable to restore your session/);
 if(state==='signed in'){
  await vm.runInContext('setSession(null)',context);
  assert.equal(get('auth').hidden,false);
  assert.equal(get('workspace').hidden,true);
 }
});
