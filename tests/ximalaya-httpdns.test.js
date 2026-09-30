// Run: node tests/ximalaya-httpdns.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const script = fs.readFileSync(require.resolve('../js/ximalaya_httpdns.js'), 'utf8');
const key = Buffer.from('8c551bee2bfc37b3');
function encrypt(value) {
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
  return Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]).toString('base64');
}
function decrypt(value) {
  const cipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  return JSON.parse(Buffer.concat([cipher.update(value, 'base64'), cipher.final()]).toString());
}
function run(url, body, fields = {}) {
  const calls = [];
  const context = {$request: {url, method:'GET'}, $done: v => calls.push(JSON.parse(JSON.stringify(v))), console:{log(){}}};
  if (body !== undefined) context.$response = {status:200, body: typeof body === 'string' ? body : JSON.stringify(body), ...fields};
  vm.runInNewContext(script, context, {timeout:3000});
  assert.equal(calls.length, 1);
  return calls[0];
}
const config = {HTTPDNS_SWITCH:'1', VERSION:'2572', RETRY_COUNT_PER_REQUEST:'2', DOMAIN_SUPPORT_LIST:['mobile.ximalaya.com'], note:'中文 😀'};
const payload = {rtn_code:'200', rtn_message:'success', timestamp:'123', rtn_data:encrypt(config)};
for (const host of ['gslbtx.ximalaya.com','gslbali.ximalaya.com']) {
  const url = `https://${host}/linkeye-cloud/httpdns/v3/init/123?version=2572e&app=default`;
  assert.deepEqual(run(url), {url:url.replace('2572e','0e')}, 'request full config instead of cached 304');
  const result = JSON.parse(run(url,payload).body);
  assert.deepEqual(decrypt(result.rtn_data), {...config,HTTPDNS_SWITCH:'0'});
  assert.deepEqual({...result,rtn_data:payload.rtn_data},payload);
  assert.deepEqual(run(url,result),{});
  assert(run(url,{...payload,rtn_data:payload.rtn_data.match(/.{1,64}/g).join('\n')}).body);
  assert(run(url,payload,{status:'HTTP/2 200'}).body);
  assert(run(url,payload,{status:undefined,statusCode:200}).body);
  for (const bad of [{...payload,timestamp:'124'},{...payload,rtn_code:'304'}, {...payload,rtn_data:'bad'}, {...payload,rtn_data:encrypt([])}, {...payload,rtn_data:encrypt({HTTPDNS_SWITCH:true})}, 'null','broken']) assert.deepEqual(run(url,bad),{});
  assert.deepEqual(run(url,payload,{status:500}),{});
}
for (const url of ['https://203.0.113.1/linkeye-cloud/httpdns/v3/init/123?version=1e', 'https://gslbtx.ximalaya.com.evil.test/linkeye-cloud/httpdns/v3/init/123?version=1e', 'https://gslbtx.ximalaya.com/linkeye-cloud/httpdns/v3/init/123extra?version=1e', 'http://gslbtx.ximalaya.com/linkeye-cloud/httpdns/v3/init/123?version=1e']) {
  assert.deepEqual(run(url),{});assert.deepEqual(run(url,payload),{});
}
console.log('PASS: domain-only SDK config, AES against Node crypto, complete config preservation, timestamp and failure passthrough');
for (const name of ['Ximalaya','XimalayaShadowrocket']) {
  const text=fs.readFileSync(require.resolve(`../${name}.module`),'utf8');
  for (const phase of ['request','response']) {
    const line=text.split('\n').find(l=>l.startsWith(`ximalaya-httpdns-sdk-${phase} =`));
    assert(line && line.includes(`type=http-${phase}`) && line.includes('/js/ximalaya_httpdns.js?v=20260930-5'));
    const pattern=new RegExp(line.match(/pattern=(.*?),(?:requires-body|timeout)/)[1]);
    for (const host of ['gslbtx.ximalaya.com','gslbali.ximalaya.com']) assert(pattern.test(`https://${host}/linkeye-cloud/httpdns/v3/init/123?version=2572e`));
    assert(!pattern.test('https://203.0.113.1/linkeye-cloud/httpdns/v3/init/123'));
  }
  const mitm=text.split('[MITM]')[1];
  for (const host of ['gslbtx.ximalaya.com','gslbali.ximalaya.com']) assert(mitm.includes(host));
  assert(!mitm.includes('<ip-address>'));
}
