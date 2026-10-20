const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {readModel, MAX_BYTES} = require('../out/model');
const base = path.resolve(__dirname, '../artifacts');
require('node:fs').mkdirSync(base,{recursive:true});
const cube = path.resolve(__dirname, 'fixtures/cube.stl');

test('reads only the explicitly chosen supported file', async () => {
 const result = await readModel(cube);
 assert.equal(result.format,'stl'); assert.equal(Buffer.from(result.base64,'base64').length,684);
 await assert.rejects(readModel(path.join(base,'secret.env')), /Only local/);
 await assert.rejects(readModel('https://example.invalid/cube.stl'));
});
test('rejects empty files, directories, and oversized sparse files before allocating', async () => {
 const temp=await fs.mkdtemp(path.join(base,'file-tests-'));
 try {
  await fs.writeFile(path.join(temp,'empty.stl'),'');
  await assert.rejects(readModel(path.join(temp,'empty.stl')), /regular model/);
  await fs.mkdir(path.join(temp,'folder.stl'));
  await assert.rejects(readModel(path.join(temp,'folder.stl')), /regular model/);
  const file=await fs.open(path.join(temp,'large.stl'),'w');await file.truncate(MAX_BYTES+1);await file.close();
  await assert.rejects(readModel(path.join(temp,'large.stl')), /regular model/);
 } finally { await fs.rm(temp,{recursive:true}); }
});
test('unusual filenames are bytes, never HTML or webview-selected paths', async () => {
 const temp=await fs.mkdtemp(path.join(base,'filename-tests-'));
 try { const target=path.join(temp,'cube<&".stl');await fs.copyFile(cube,target);
 assert.equal((await readModel(target)).base64,(await readModel(cube)).base64);
 } finally {await fs.rm(temp,{recursive:true});}
});
const Module=require('node:module');
const original=Module._load;
const uri=(p)=>({scheme:'file',fsPath:p,toString:()=>`file://${p}`});
Module._load=function(id,...args){if(id==='vscode')return {Uri:{joinPath:(root,...parts)=>uri(path.join(root.fsPath,...parts))}};return original.call(this,id,...args);};
const {MeshViewerProvider}=require('../out/MeshViewerProvider');Module._load=original;
function panel(){const messages=[];let listener;return {messages,webview:{options:{},html:'',asWebviewUri:u=>({toString:()=>`http://127.0.0.1/${path.basename(u.fsPath)}`}),cspSource:'http://127.0.0.1',onDidReceiveMessage:cb=>{listener=cb;return {dispose(){}}},postMessage:async m=>{messages.push(m);return true}},onDidDispose(){},receive:m=>listener(m)};}
test('webview gets asset-only roots, a random nonce, no network, and no command URIs',async()=>{
 const provider=new MeshViewerProvider({extensionUri:uri(path.resolve(__dirname,'..'))});
 const a=panel(),b=panel();await provider.resolveCustomEditor({uri:uri(cube)},a);await provider.resolveCustomEditor({uri:uri(cube)},b);
 assert.equal(a.webview.options.enableCommandUris,false);assert.equal(a.webview.options.enableForms,false);
 assert.deepEqual(a.webview.options.localResourceRoots.map(u=>u.fsPath),[path.resolve(__dirname,'../media/reviewed')]);
 assert.match(a.webview.html,/default-src 'none'/);assert.match(a.webview.html,/connect-src 'none'/);
 assert.doesNotMatch(a.webview.html,/unsafe-eval|unsafe-inline|data:|blob:/);
 assert.notEqual(a.webview.html,b.webview.html);assert.ok(!a.webview.html.includes(cube));
});
test('host rejects nonlocal documents and ignores attacker write/command messages',async()=>{
 const provider=new MeshViewerProvider({extensionUri:uri(path.resolve(__dirname,'..'))});
 await assert.rejects(provider.openCustomDocument({scheme:'https',fsPath:cube}),/local model/);
 const p=panel();await provider.resolveCustomEditor({uri:uri(cube)},p);
 for(const m of [null,'string',{type:'saveFile',extension:'../../bad',text:'bad'},{type:'exec',command:'bad'},{type:'readFile',path:'/etc/passwd'},{type:'eval',eval:'bad'}])p.receive(m);
 assert.equal(p.messages.length,0);p.receive({type:'ready',path:'/etc/passwd'});
 for(let i=0;i<30 && !p.messages.length;i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(p.messages[0].type,'model');assert.equal(p.messages[0].base64,(await readModel(cube)).base64);
});
