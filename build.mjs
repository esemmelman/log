import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

await build({entryPoints:['app.js'],bundle:true,minify:true,outfile:'dist/app.js'});
let html=await readFile('dist/index.html','utf8');
for(const file of ['app.js','style.css']){
 const hash=createHash('sha256').update(await readFile('dist/'+file)).digest('hex').slice(0,12);
 html=html.replace(new RegExp(`((?:src|href)="${file.replace('.', '\\.')})(?:\\?[^" ]*)?"`,'g'),`$1?v=${hash}"`);
}
await writeFile('dist/index.html',html);
console.log('Built app with content-versioned JavaScript and CSS URLs.');
