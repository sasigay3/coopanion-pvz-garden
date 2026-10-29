import {test} from 'node:test';import assert from 'node:assert/strict';
import {pickAutoTargets} from '../src/auto-pickups.mjs';
const board={collectibles:[{id:1,kind:'sun'},{id:2,kind:'gold_coin'},{id:3,kind:'seed_packet'},{id:4,kind:'diamond'}]};
test('阳光与金币分批，金币最多等待五秒',()=>{
 assert.deepEqual(pickAutoTargets(board,2000,0),{kind:'sun',ids:[1]});
 assert.deepEqual(pickAutoTargets(board,5000,0),{kind:'coins',ids:[2,4]});
 assert.deepEqual(pickAutoTargets({collectibles:board.collectibles.slice(1)},2000,0),{kind:'coins',ids:[2,4]});
});
test('不自动收集通关卡等其他掉落物，金币每批最多四个',()=>{
 const b={collectibles:[...Array.from({length:6},(_,i)=>({id:i,kind:'silver_coin'})),{id:9,kind:'seed_packet'}]};
 assert.deepEqual(pickAutoTargets(b,0,0).ids,[0,1,2,3]);
 assert.deepEqual(pickAutoTargets(b,0,0,false).ids,[]);
});
