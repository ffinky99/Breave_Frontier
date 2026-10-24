import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('..',import.meta.url));
const json=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const manifest=await json('docs/apk-inventory.json'),units=await json('dist/units.json'),animations=await json('dist/animations.json');
assert.equal(units.units.length,24);assert.equal(manifest.copiedAssets.length,141);
assert.equal(new Set(units.units.map(u=>u.id)).size,24);
const names=new Set(await readdir(path.join(root,'dist/assets')));
assert.equal(names.size,manifest.copiedAssets.length,'모든 배포 자산은 원본 해시 목록에 있어야 한다');
for(const item of manifest.copiedAssets){
  const buf=await readFile(path.join(root,'dist/assets',item.file));
  assert.equal(buf.length,item.bytes,item.file);assert.equal(createHash('sha256').update(buf).digest('hex'),item.sha256,item.file);
}
const ui=await json('dist/ui.json');
for(const [key,f] of Object.entries(ui)){
  const png=await readFile(path.join(root,'dist/assets',f.image)),width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  const [x,y,w,h]=f.rect;assert.ok(x>=0&&y>=0&&x+(f.rotated?h:w)<=width&&y+(f.rotated?w:h)<=height,`UI crop ${key}`);
  assert.ok(f.size[0]>0&&f.size[1]>0);
}
for(const unit of units.units){
  assert.match(unit.name,/[가-힣]/);assert.doesNotMatch(unit.name,/[A-Za-z]/);
  for(const kind of ['anime','ills_battle','ills_thum',...(unit.hasIllustration?['ills_full']:[])])assert.ok(names.has(`unit_${kind}_${unit.id}.png`),`${unit.id} ${kind}`);
  const a=animations[unit.id];assert.ok(a);
  const png=await readFile(path.join(root,'dist/assets',`unit_anime_${unit.id}.png`));const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  for(const frame of a.frames){assert.equal(frame.length,2+frame[1]*11);for(let i=0;i<frame[1];i++){const p=frame.slice(2+i*11,13+i*11);assert.ok(p.every(Number.isFinite));assert.ok(p[6]>=0&&p[7]>=0&&p[6]+p[8]<=width&&p[7]+p[9]<=height,`atlas crop ${unit.id}`);assert.equal(p[10],0,'only included atlas page');}}
  for(const action of ['idle','move','atk']){assert.ok(a.actions[action].length);for(const row of a.actions[action])assert.ok(row[0]>=0&&row[0]<a.frames.length&&row[3]>=0);}
}
for(const name of ['index.html','style.css','native.css','app.js','sprites.js','ui.js']){
  const text=await readFile(path.join(root,'dist',name),'utf8');
  for(const match of text.matchAll(/assets\/([A-Za-z0-9_.-]+\.(?:png|jpg|mp3))/g))assert.ok(names.has(match[1]),`missing ${match[1]}`);
  assert.doesNotMatch(text,/https?:\/\//,'runtime must use bundled resources only');
}
assert.match(await readFile(path.join(root,'dist/index.html'),'utf8'),/<html lang="ko">/);
console.log(`검증 완료: 유닛 ${units.units.length}종, 원본 자산 ${manifest.copiedAssets.length}개, 이미지 해시·모션 범위·로컬 참조 일치`);
