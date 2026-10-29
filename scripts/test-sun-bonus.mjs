import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifiedSunPickupCount} from '../src/sun-bonus.mjs';
const batch={requested:3,attempted:2,released:2,verified:2,stale:1,scopeStopped:false};
test('只奖励确实收到的阳光',()=>assert.equal(verifiedSunPickupCount({status:'verified',batch},3),2));
test('失败、作用域改变、数量不一致均不奖励',()=>{
  assert.equal(verifiedSunPickupCount({status:'unverified',batch},3),0);
  assert.equal(verifiedSunPickupCount({status:'verified',batch:{...batch,scopeStopped:true}},3),0);
  assert.equal(verifiedSunPickupCount({status:'verified',batch:{...batch,released:1}},3),0);
  assert.equal(verifiedSunPickupCount({status:'verified',batch},4),0);
});
