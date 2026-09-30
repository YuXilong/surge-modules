// Run: node tests/ximalaya-httpdns-sdk.test.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
for(const name of ['Ximalaya','XimalayaShadowrocket']) {
 const text=fs.readFileSync(require.resolve('../'+name+'.module'),'utf8');
 assert(!text.includes('abtest-portal'));
 assert(!text.includes('<ip-address>'));
 for(const type of ['response']) {
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
const source=fs.readFileSync(require.resolve('../js/ximalaya_httpdns.js'),'utf8');
assert(!/uu\.t-wk\.com|\$httpClient|\$persistentStore/.test(source));
assert.equal(fs.readFileSync(require.resolve('../Ximalaya.module'),'utf8'),fs.readFileSync(require.resolve('../XimalayaShadowrocket.module'),'utf8'));
console.log('PASS: local-only HTTPDNS and identical cross-client module aliases');

for (const name of ['Ximalaya','XimalayaShadowrocket']) {
  const text=fs.readFileSync(require.resolve('../'+name+'.module'),'utf8');
  const paths=[...text.matchAll(/script-path=(\S+)/g)].map(m=>m[1]);
  assert(paths.length>0);
  for(const path of paths) assert(/^https:\/\/raw\.githubusercontent\.com\/YuXilong\/surge-modules\/[a-f0-9]{40}\/js\//.test(path),'Ximalaya scripts must use an immutable revision');
}

// Regression: avoid Shadowrocket's request-script URL rewrite / response handoff.
for (const name of ['Ximalaya','XimalayaShadowrocket']) {
  const text=fs.readFileSync(require.resolve('../'+name+'.module'),'utf8');
  assert(!text.includes('ximalaya-httpdns-sdk-request ='));
  const section=text.split('[URL Rewrite]')[1];
  assert(section, 'full-config requests must use native URL rewriting');
  const [pattern,replacement,type]=section.trim().split('\n')[0].split(/\s+/);
  assert.equal(type,'header');
  const regex=new RegExp(pattern);
  for(const host of ['gslbtx','gslbali']) {
    for(const port of ['',':443']) {
      const base='https://'+host+'.ximalaya.com'+port+'/linkeye-cloud/httpdns/v3/init/1790755605';
      for(const query of ['version=2572e','version=2572e&app=default','app=default&version=2572e&clientType=','app=default&version=2572e']) {
        const url=base+'?'+query;
        const rewritten=url.replace(regex,replacement);
        assert.equal(rewritten,url.replace('version=2572e','version=0e'));
        assert.equal(rewritten.replace(regex,replacement),rewritten);
      }
      for(const query of ['app=default','version=','version=1e&version=2e','version=1e&app=default&version=2e','app=version=1e','version=1e#fragment']) {
        assert(!regex.test(base+'?'+query),query);
      }
      for(const url of [base.replace('https:','http:')+'?version=1e',base.replace(host+'.ximalaya.com','203.0.113.1')+'?version=1e',base.replace('.com','.com.evil.test')+'?version=1e',base+'extra?version=1e']) assert(!regex.test(url));
    }
  }
}
console.log('PASS: native full-config URL rewrite preserves parameters and domain boundaries');
