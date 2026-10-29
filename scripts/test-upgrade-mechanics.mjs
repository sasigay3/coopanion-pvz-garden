import assert from 'node:assert/strict';
import {cardMechanicsFacts} from '../src/render.ts';
assert.match(cardMechanicsFacts({type:40,imitates:null}).join('；'),/双发射手/);
assert.match(cardMechanicsFacts({type:43,imitates:null}).join('；'),/荷叶/);
assert.match(cardMechanicsFacts({type:42,imitates:null}).join('；'),/大喷菇/);
console.log('升级卡前置植物提示检查通过');
