// Run: node tests/jd-price.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../js/vendor/deezertidal/jdprice.js'), 'utf8');
async function run(product, price) {
  const calls = [];
  vm.runInNewContext(source, {
    $request: {url: 'https://api.m.jd.com/client.action?functionId=wareBusiness'},
    $response: {body: JSON.stringify(product)}, $done: result => calls.push(result),
    $persistentStore: {read: () => null, write: () => true},
    $notification: {post() {}}, console: {log() {}},
    $httpClient: {get: (options, callback) => queueMicrotask(() => callback(null,
      {status: options.url.includes('price_towards') && price.is_ban ? 202 : 200, headers: {}},
      JSON.stringify(options.url.includes('price_towards') ? price : {})))}
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  return JSON.parse(calls[0].body);
}
(async () => {
  const product = {
    commonBaseInfo: {data: {wareInfo: {skuId: '123', name: '原商品标题', shortTitle: '原短标题'}, keep: true}},
    floors: [{mId: 'bpName', useNewTNFramework: true, data: {}},
      {mId: 'bpShop', data: {wareInfo: {skuId: '123'}}}]
  };
  for (const price of [{is_ban: 1}, {store: [{last_price: 12345, lowest: 100, highest: 150}]}]) {
    const output = await run(product, price);
    assert.deepEqual(output.floors, product.floors, '新版页面应复用已有标题组件，不插入废弃楼层');
    const info = output.commonBaseInfo.data.wareInfo;
    assert(info.name.startsWith('历史价格：'));
    assert(info.name.endsWith('\n原商品标题'));
    assert(info.shortTitle.endsWith('\n原短标题'));
    assert(info.name.includes(price.is_ban ? '要求验证' : '123.45'));
    assert.equal(info.forceExpandTitle, true);
    assert.equal(output.commonBaseInfo.data.keep, true);
  }
  console.log('PASS: JD current title component shows price/verification state and preserves product floors');
})().catch(error => {console.error(error); process.exitCode = 1;});
