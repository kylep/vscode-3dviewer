const vscode=require('vscode');const fs=require('node:fs');const path=require('node:path');
exports.run=async()=>{
 const root=path.resolve(__dirname,'..');const evidence=path.resolve(root,'artifacts');
 fs.mkdirSync(evidence,{recursive:true});
 const ext=vscode.extensions.getExtension('local-reviewed.vscode-3dviewer');if(!ext)throw new Error('Reviewed extension missing');
 const api=await ext.activate();const uri=vscode.Uri.file(path.resolve(root,'tests/fixtures/cube.stl'));
 await vscode.commands.executeCommand('vscode.openWith',uri,'3dviewer.viewer');
 for(let i=0;i<120;i++){
  const render=api.renders.get(uri.toString());
  if(render){if(render.triangles!==12)throw new Error('Wrong triangle count');fs.writeFileSync(path.join(evidence,'vscode-smoke.json'),JSON.stringify({passed:true,extension:ext.id,version:ext.packageJSON.version,...render},null,2));return;}
  await new Promise(r=>setTimeout(r,500));
 }
 throw new Error('Cube did not render inside the real VS Code webview');
};
