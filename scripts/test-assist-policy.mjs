import {test} from 'node:test';import assert from 'node:assert/strict';import {planAssist} from '../src/assist-policy.mjs';
const b={screen:'board',modeKind:'adventure',board:{runId:1,paused:false,sun:75,cards:[{slot:0,active:true,refreshing:true},{slot:1,active:false,refreshing:true}]}};
test('默认关闭，普通关卡仅选需要补充的阳光与冷却中卡片',()=>{assert.equal(planAssist(b).reason,'inactive');assert.deepEqual(planAssist(b,{enabled:true}),{sun:1000,cards:[0],reason:'ok'})});
test('菜单、暂停、关卡结算、传送带及特殊关卡不触发',()=>{for(const x of [{...b,screen:'seed_picker'},{...b,board:{...b.board,paused:true}},{...b,lastRun:{runId:1}},{...b,board:{...b.board,conveyor:true}},{...b,board:{...b.board,special:{}}},{...b,modeKind:'puzzle'}])assert.equal(planAssist(x,{enabled:true}).sun,null)});
