// Run: node tests/class-print-ads.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../js/class_print_ads.js'), 'utf8');
function run(url, body, status=200, headers={}) {
  const calls=[];
  vm.runInNewContext(source, {$request:{url,headers},$response:{status,body:typeof body==='string'?body:JSON.stringify(body)},$done:r=>calls.push(r),console:{log(){}}});
  assert.equal(calls.length,1);
  return calls[0].body ? JSON.parse(calls[0].body) : null;
}
const url='https://b.welife001.com/app/getAdConfV2';
const data={code:0,msg:'ok',data:[{name:'app_ad_splash',ad_show:true,type:1},{name:'app_ad_chapin',ad_show:true,type:2},{name:'app_ad_reward_by_integral',ad_show:true,type:3},{name:'app_ad_feed_by_integral',ad_show:true,type:5},{name:'future_slot',ad_show:true}]};
const output=run(url,data);
assert.deepEqual(output,{...data,data:data.data.map(v=>({...v,ad_show:false}))});
const sdk={msg:'ok',result:{infoConfigBoList:[{appid:'090774'}],posIdRelationList:[{posid:'98030074'}],reportUrlList:[],other:1}};
for(const target of ['https://admin.hzjizhun.cn/infoConfig/090774','https://admin.hzjizhun.cn/infoConfig/833931','https://ad.baihemob.com/infoConfig/926475']) {
  assert.deepEqual(run(target,sdk),{...sdk,result:{...sdk.result,posIdRelationList:[]}});
}
for(const target of ['https://admin.hzjizhun.cn/infoConfig/123456','https://b.welife001.com/applet/getUser','https://epbox.gongfudou.com/graphql',url+'extra','https://b.welife001.com.evil.test/app/getAdConfV2']) assert.equal(run(target,data),null);
for(const body of ['invalid','null',{code:40001,data:data.data},{code:0,data:null}]) assert.equal(run(url,body),null);
assert.equal(run(url,data,500),null);
const moduleText=fs.readFileSync(require.resolve('../AdUltraPlus.module'),'utf8');
const line=moduleText.split('\n').find(l=>l.startsWith('class-print-ads='));
assert(line);
const pattern=new RegExp(line.match(/pattern=(.*?),requires-body/)[1]);
for(const target of [url,url+'?v=1','https://admin.hzjizhun.cn/infoConfig/090774','https://admin.hzjizhun.cn/infoConfig/833931','https://ad.baihemob.com/infoConfig/926475']) assert(pattern.test(target));
for(const target of [url+'extra','https://admin.hzjizhun.cn/infoConfig/123456','https://epbox.gongfudou.com/graphql']) assert(!pattern.test(target));
for(const host of ['b.welife001.com','admin.hzjizhun.cn','ad.baihemob.com']) assert(moduleText.split('[MITM]')[1].split('[Map Local]')[0].includes(host));
console.log('PASS: captured ad configurations, all slots including rewards, business APIs and error passthrough');
const rules=moduleText.split('[URL Rewrite]')[1].split('[Script]')[0].trim().split('\n').slice(0,4).map(line=>new RegExp(line.split(' ')[0]));
const blocked=url=>rules.some(r=>r.test(url));
for(const target of [
 'https://api.yfanads.com/api/v1/ads/app?appID=1077&ver=30',
 'https://api.yfanads.com/api/v1/ads/app?ver=30&appID=1072',
 'https://g.fancyapi.com/s2s?mt=1&mid=750',
 'http://sdkg.fancyapi.com/s2s?mt=1&mid=750',
 'https://sdkg.fancyapi.com/s2s?mid=750',
 'https://g.fancyapi.com/rtb?v=1&mid=427&slot=36290284&fan=1',
 'https://g.fancyapi.com/rtb?slot=36290284&mid=427',
 'https://bid.buluken.com/bid?mid=3156',
]) assert(blocked(target),target);
for(const target of [
 'https://api.yfanads.com/api/v1/ads/app?appID=1124',
 'https://api.yfanads.com/api/v1/ads/app?appID=10770',
 'https://g.fancyapi.com/s2s?mid=751',
 'http://sdkg.fancyapi.com/s2s?mid=751',
 'https://g.fancyapi.com/rtb?mid=427&slot=36290285',
 'https://g.fancyapi.com/rtb?mid=428&slot=36290284',
 'https://g.fancyapi.com/rtb?mid=427&notslot=36290284',
 'https://bid.buluken.com/bid?mid=31560',
 'https://epbox.gongfudou.com/graphql',
 'https://b.welife001.com/applet/getAllMsg',
]) assert(!blocked(target),target);
console.log('PASS: captured app/slot-specific ad requests and unrelated app passthrough');
const ua={'User-Agent':'xiaobai/4.12.4 (iPhone; iOS 27.0; Scale/3.00)'};
const configURL='https://s.baertt.com/qm/newad/platform/config';
const listURL='https://s.baertt.com/qm/newad/ad/list';
const platform={code:200,data:{platform_configs:[{platform_name:'CSJ'}],preload_configs:[],global_configs:{other:true}}};
const slots={code:200,data:{position_name:'系统开屏',position_config_verify:'opaque',bidding_config:{slot_configs:[{slot_type:'Splash',slot_id:'103836572'}],other:1}}};
assert.deepEqual(run(configURL,platform,200,ua),{...platform,data:{...platform.data,platform_configs:[],preload_configs:[]}});
assert.deepEqual(run(listURL,slots,200,ua),{...slots,data:{...slots.data,bidding_config:{...slots.data.bidding_config,slot_configs:[]}}});
assert.equal(run(listURL,slots,200,{'User-Agent':'OtherApp/1'}),null);
assert.equal(run(listURL,slots,200,{}),null);
assert.equal(run(listURL,{code:500,data:slots.data},200,ua),null);
assert.equal(run(listURL,{code:200,data:null},200,ua),null);
assert(pattern.test(configURL) && pattern.test(listURL));
assert(!pattern.test('https://s.baertt.com/qm/newad/other'));
console.log('PASS: Xiaobai mediation platforms and splash slots cleared; other apps preserved');
