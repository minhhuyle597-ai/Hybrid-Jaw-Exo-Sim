import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(new URL('../public/'+p,import.meta.url),'utf8'));
const manifest=read('data/views.json'),data=read('data/frames.json');
test('all views reference the same complete data record and actual checked-in MP4s',()=>{
 assert.equal(manifest.frame_count,data.frames.length);assert.equal(manifest.fps,data.meta.fps);
 assert.deepEqual(manifest.views.map(v=>v.id),['front','back','left','right','oblique']);
 for(const view of manifest.views){
  for(const key of ['video','poster','paths']){
   assert.ok(!view[key].startsWith('/')&&!view[key].includes('..'));
   assert.ok(existsSync(new URL('../public/'+view[key],import.meta.url)));
  }
  const bytes=readFileSync(new URL('../public/'+view.video,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),view.sha256);
  const paths=read(view.paths);assert.equal(paths.length,data.frames.length);
  assert.ok(paths.every(frame=>frame.length===24&&frame.every(path=>path.length>=2)));
 }
});
test('muscle identity and color never depend on selection order',()=>{
 assert.equal(new Set(manifest.muscles.map(m=>m.color)).size,24);
 for(const [i,m] of manifest.muscles.entries()){
  assert.equal(m.id,i);assert.equal(m.name,data.meta.muscles[i].name);
  assert.match(m.color,/^#[0-9a-f]{6}$/);assert.match(m.code,/^M\d\d$/);
 }
 assert.equal(manifest.views.find(v=>v.id==='front').azimuth,180);
 assert.equal(manifest.views.find(v=>v.id==='back').azimuth,0);
 assert.equal(manifest.views.find(v=>v.id==='left').azimuth,270);
});
test('published metadata contains relative model paths and finite, bounded inputs',()=>{
 assert.ok(!data.meta.model.includes(':')&&!data.meta.model.startsWith('/'));
 for(const [k,f] of data.frames.entries()){
  assert.ok(Math.abs(f.time_s-k/manifest.fps)<1e-8);
  assert.equal(f.length_mm.length,24);
  assert.ok(f.excitation.every(n=>n>=0&&n<=1));
  assert.ok(f.generalized_force.every(v=>v.length===5&&v.every(Number.isFinite)));
 }
 assert.deepEqual(data.meta.dofs.map(d=>d.type),['translation','translation','rotation','rotation','rotation']);
});
