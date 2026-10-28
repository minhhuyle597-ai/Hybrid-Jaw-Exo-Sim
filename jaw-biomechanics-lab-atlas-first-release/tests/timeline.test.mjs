import {test} from 'node:test';
import assert from 'node:assert/strict';
import {frameIndex,seekTime} from '../src/timeline.mjs';
test('video PTS selects the visible frame and clamps boundaries',()=>{
  assert.equal(frameIndex(0,25,536),0);
  assert.equal(frameIndex(.039,25,536),0);
  assert.equal(frameIndex(.04,25,536),1);
  assert.equal(frameIndex(21.44,25,536),535);
  assert.equal(frameIndex(-1,25,536),0);
});
test('every frame survives forward and backward seeking',()=>{
  for(let i=535;i>=0;i--) assert.equal(frameIndex(seekTime(i,25,536),25,536),i);
});
