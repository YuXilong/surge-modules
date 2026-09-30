// Run: node tests/ximalaya-httpdns-sdk.test.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
for(const name of ['Ximalaya','XimalayaShadowrocket']) {
 const text=fs.readFileSync(require.resolve('../'+name+'.module'),'utf8');
 assert(!text.includes('abtest-portal'));
 assert(!text.includes('<ip-address>'));
 for(const type of ['request','response']) {
  const line=text.split('\n').find(l=>l.startsWith('ximalaya-httpdns-sdk-'+type+' ='));
  const pattern=new RegExp(line.match(/pattern=([^,]+)/)[1]);
  for(const host of ['gslbtx','gslbali']) assert(pattern.test('https://'+host+'.ximalaya.com/linkeye-cloud/httpdns/v3/init/123?version=1'));
  assert(!pattern.test('https://203.0.113.1/linkeye-cloud/httpdns/v3/init/123'));
 }
 const ads=text.split('\n').find(l=>l.startsWith('ximalaya-ads ='));
 const pattern=new RegExp(ads.match(/pattern=(.*?),requires-body/)[1]);
 for(const url of ['https://adse.ximalaya.com/ting/loading/ts-123','https://adse.wsa.ximalaya.com/adx/ad','https://mobile.ximalaya.com/discovery-feed/v4/mix/ts-123']) assert(pattern.test(url));
 for(const p of ['/adx/init','/incentive/ting/currentDuration','/incentive/ting/rewardDuration']) assert(!pattern.test('https://adse.ximalaya.com'+p));
}
const script=fs.readFileSync(require.resolve('../js/ximalaya_httpdns.js'),'utf8');
assert(!/CryptoJS|signingKey|MD5|AES|HTTPDNS_SWITCH/.test(script));
assert(script.length<5000);
console.log('PASS: narrow module routes and crypto-free client');
