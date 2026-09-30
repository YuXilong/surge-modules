// Run: node tests/ximalaya-httpdns.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script = fs.readFileSync(require.resolve('../js/ximalaya_httpdns.js'), 'utf8');
const url = 'https://gslbtx.ximalaya.com/linkeye-cloud/httpdns/v3/init/123?version=2572&device=private';
const input = Buffer.alloc(32, 1).toString('base64');
const output = Buffer.alloc(32, 2).toString('base64');
const payload = {rtn_code:'200', timestamp:'123', rtn_data:input, keep:'unchanged'};
async function run({requestUrl=url, response=payload, status=200, mode='ok', cache=null}={}) {
  const calls=[], requests=[]; let written=null;
  const context = {
    $request:{url:requestUrl,method:'GET',headers:{Cookie:'private'}},
    $done:value=>calls.push(JSON.parse(JSON.stringify(value))),
    $persistentStore:{read:()=>cache,write:value=>{written=value;return true;}},
    $httpClient:{post:(options, cb)=>{requests.push(options);queueMicrotask(()=>{
      if(mode==='hang') return;
      if(mode==='offline') return cb('offline');
      cb(null,{status:mode==='limited'?429:200},mode==='bad'?'{}':JSON.stringify({rtn_data:output}));
      if(mode==='twice') cb(null,{status:200},JSON.stringify({rtn_data:output}));
    });}}, console:{log(){}},setTimeout:fn=>mode==='hang'?setTimeout(fn,1):setTimeout(fn,5000),clearTimeout,
  };
  if(response!==false) context.$response={body:typeof response==='string'?response:JSON.stringify(response),status};
  vm.runInNewContext(script,context,{timeout:1000});
  await new Promise(resolve=>mode==='hang'?setTimeout(resolve,10):setImmediate(resolve));
  assert.equal(calls.length,1);
  return {result:calls[0],requests,written};
}
(async()=>{
  assert.equal((await run({response:false})).result.url,url.replace('version=2572','version=0e'));
  const first=await run();
  assert.deepEqual(JSON.parse(first.result.body),{...payload,rtn_data:output});
  assert.equal(first.requests[0].url,'https://uu.t-wk.com/v1/ximalaya/httpdns-config');
  assert.deepEqual(JSON.parse(first.requests[0].body),{rtn_data:input});
  assert(!JSON.stringify(first.requests).includes('private'));
  const cached=await run({cache:first.written});
  assert.equal(cached.requests.length,0);
  assert.deepEqual(cached.result,first.result);
  assert((await run({cache:'broken'})).result.body);
  const changed=await run({cache:first.written,response:{...payload,rtn_data:Buffer.alloc(32,3).toString('base64')}});
  assert.equal(changed.requests.length,1);
  for(const mode of ['offline','limited','bad','hang']) assert.deepEqual((await run({mode})).result,{});
  assert((await run({mode:'twice'})).result.body);
  for(const options of [{status:500},{response:'broken'},{response:{...payload,timestamp:'124'}},
    {response:{...payload,rtn_code:'304'}},{response:{...payload,rtn_data:'x'}},
    {requestUrl:'https://203.0.113.1/linkeye-cloud/httpdns/v3/init/123'},
    {requestUrl:'https://gslbtx.ximalaya.com.evil.test/linkeye-cloud/httpdns/v3/init/123'}]) {
    const value=await run(options); assert.deepEqual(value.result,{});assert.equal(value.requests.length,0);
  }
  console.log('PASS: service client, exact-input cache, privacy, failure passthrough and single completion');
})().catch(error=>{console.error(error);process.exitCode=1;});
