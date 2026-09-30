// Run: node tests/ximalaya-ads.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script = fs.readFileSync(require.resolve('../js/ximalaya_ads.js'), 'utf8');
function run(path, body, host='adse.ximalaya.com', status=200) {
  const calls=[];
  vm.runInNewContext(script, {$request:{url:`https://${host}${path}`},
    $response:{status,body:typeof body==='string'?body:JSON.stringify(body)},
    $done:value=>calls.push(JSON.parse(JSON.stringify(value))),console:{log(){}}});
  assert.equal(calls.length,1);
  return calls[0].body ? JSON.parse(calls[0].body) : body;
}
const splash={ret:0,data:[{id:1}],adTypes:[1],bidSlotList:{keep:1},responseId:'preserve'};
assert.deepEqual(run('/ting/loading/ts-123',splash),{...splash,data:[],adTypes:[],bidSlotList:{}});
const feed={ret:0,body:[{itemType:'album'},{itemType:'IndexFeedAd/DoubleStream'}],
  heData:[{itemType:'IndexFeedAd/BigPicture'},{itemType:'bigCard'}],offset:123};
assert.deepEqual(run('/discovery-feed/v4/mix/ts-123',feed,'mobile.ximalaya.com'),
  {...feed,body:[{itemType:'album'}],heData:[{itemType:'bigCard'}]});
const slots=[1,28,44,293,316,318,88,93,94,254,279,292,295,999].map(positionId=>
  ({positionId,ads:[{id:1}],bidSlotList:{id:2},slotId:positionId}));
const adx=run('/adx/ad',{ret:0,slotAds:slots});
for(let i=0;i<slots.length;i++) assert.deepEqual(adx.slotAds[i],i<6?{...slots[i],ads:[],bidSlotList:{}}:slots[i]);
for(const path of ['/adx/init','/adx/parallel/config','/incentive/ting/currentDuration','/ting/loading-extra'])
  assert.deepEqual(run(path,splash),splash);
assert.deepEqual(run('/ting/loading',splash,'unrelated.example'),splash);
assert.deepEqual(run('/ting/loading',{...splash,ret:1}),{...splash,ret:1});
assert.deepEqual(run('/ting/loading',splash,undefined,500),splash);
for(const body of ['invalid','null','[]','{}']) assert.equal(run('/ting/loading',body),body);
console.log('PASS: splash/feed/known slots filtered; organic cards, rewards, errors and unknown slots retained');
