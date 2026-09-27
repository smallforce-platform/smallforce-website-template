import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
const template=fileURLToPath(new URL('../',import.meta.url));
async function fixture() {
  const directory=await mkdtemp(path.join(os.tmpdir(),'sf-slide-build-'));
  await cp(template,directory,{recursive:true,filter:source=>!['node_modules','dist','.git'].some(name=>source===path.join(template,name))});
  await symlink(path.join(template,'node_modules'),path.join(directory,'node_modules'),'dir');
  return directory;
}
async function build(directory,onOutput=()=>{}) {
  return new Promise((resolve,reject)=>{
    const child=spawn('node',['scripts/build.mjs'],{cwd:directory,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,SMALLFORCE_API_KEY:'SYNTHETIC_SDK_SECRET'},stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',chunk=>{output+=chunk;onOutput(String(chunk));});child.stderr.on('data',chunk=>output+=chunk);
    child.on('error',reject);child.on('close',code=>resolve({code,output}));
  });
}
test('build emits the Celld worker and static deck without loading project env/config',async()=>{
  const project=await fixture();
  try{
    await writeFile(path.join(project,'.env'),'VITE_PRIVATE_TEST=ENV_MUST_NOT_APPEAR');
    await writeFile(path.join(project,'open-slide.config.ts'),'throw new Error("PROJECT_CONFIG_MUST_NOT_EXECUTE");');
    const result=await build(project);assert.equal(result.code,0,result.output);
    assert.ok((await readFile(path.join(project,'dist/client/index.html'),'utf8')).includes('<html'));
    assert.ok((await readFile(path.join(project,'dist/worker/entry.mjs'),'utf8')).includes('fetch'));
    for(const filename of await readdir(path.join(project,'dist/client/assets')))if(filename.endsWith('.js')) {
      const source=await readFile(path.join(project,'dist/client/assets',filename),'utf8');
      assert.ok(!source.includes('SYNTHETIC_SDK_SECRET'));assert.ok(!source.includes('ENV_MUST_NOT_APPEAR'));
    }
  }finally{await rm(project,{recursive:true,force:true});}
});
test('a source change during compilation aborts publication and clears stale output',async()=>{
  const project=await fixture();
  try{
    let changed=false,pending;
    const result=await build(project,text=>{
      if(!changed&&text.includes('transform')){changed=true;pending=writeFile(path.join(project,'slides/getting-started/new.txt'),'concurrent user edit');}
    });
    await pending;assert.ok(changed,'Vite started the compilation');assert.notEqual(result.code,0);
    assert.match(result.output,/Slides changed during the build/);
    assert.deepEqual(await readdir(path.join(project,'dist')),[]);
  }finally{await rm(project,{recursive:true,force:true});}
});
test('source symlinks cannot smuggle files outside the presentation into the build',async()=>{
  const project=await fixture();
  try{
    await symlink('/etc/hosts',path.join(project,'assets','outside'));
    const result=await build(project);assert.notEqual(result.code,0);assert.match(result.output,/cannot contain symlinks/);
  }finally{await rm(project,{recursive:true,force:true});}
});
