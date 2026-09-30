// Run: node tests/module-import.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const prefix = 'https://raw.githubusercontent.com/YuXilong/surge-modules/main/';
const modules = ['AdUltraPlus', 'Caiyun', 'Weibo', 'Ximalaya', 'XimalayaShadowrocket', 'HistoryPrice'];
const scripts = new Set();
const blockers = [];
for (const name of modules) {
  const text = fs.readFileSync(path.join(root, name + '.module'), 'utf8');
  const names = new Set();
  let section = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('[')) section = line;
    if (!line.trim() || line.startsWith('#')) continue;
    for (const match of line.matchAll(/(script-path=|data=")(https?:\/\/[^\s,"]+)/g)) {
      assert(match[2].startsWith(prefix), `${name}: external dependency ${match[2]}`);
      const file = path.join(root, match[2].slice(prefix.length).split('?')[0]);
      assert(fs.statSync(file).size > 0, file);
      if (match[1] === 'script-path=') scripts.add(file);
    }
    if (section === '[Script]' && line.includes('script-path=')) {
      const id = line.split('=')[0].trim();
      assert(!names.has(id), `${name}: duplicate script ${id}`);
      names.add(id);
    }
    if (['AdUltraPlus', 'Ximalaya'].includes(name) &&
        ['[URL Rewrite]', '[Map Local]'].includes(section) && !line.startsWith('[')) {
      // Surge supports atomic groups; noncapturing groups suffice for these regression URLs.
      blockers.push(new RegExp(line.split(/\s/)[0].replaceAll('(?>', '(?:')));
    }
  }
}
for (const file of scripts) new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
for (const endpoint of ['currentDuration', 'decreaseDuration', 'rewardDuration', 'durationConfig']) {
  for (const scheme of ['http', 'https']) {
    const url = `${scheme}://adse.ximalaya.com/incentive/ting/${endpoint}/ts-123?device=test`;
    assert(!blockers.some(regex => regex.test(url)), `blocked reward endpoint: ${url}`);
  }
}
for (const url of [
  'https://adse.ximalaya.com/ting/loading?test=1',
  'https://adbehavior.ximalaya.com/api/v1/adRealTime',
  'https://adbehavior.wsa.ximalaya.com:443/api/v1/adRealTime',
  'https://xdcs-collector.ximalaya.com/api/v1/realtime',
  'https://mres.ximalaya.com/dog-portal/checkOld/ios_remote/123',
]) assert(!blockers.some(regex => regex.test(url)), `blocked Ximalaya endpoint: ${url}`);
assert(blockers.some(regex => regex.test('https://ads.example.test/api/v1/adRealTime')));
const ximalayaModule = fs.readFileSync(path.join(root, 'Ximalaya.module'), 'utf8');
assert(!ximalayaModule.includes('[URL Rewrite]'));
assert(!ximalayaModule.includes('/js/vendor/ddgksf2013/ximalaya_json.js'));

async function run(file, url, body, get) {
  const calls = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), {
    $request: { url },
    $response: { status: 200, body: typeof body === 'string' ? body : JSON.stringify(body) },
    $done: value => calls.push(JSON.parse(JSON.stringify(value))),
    $httpClient: { get: (...args) => queueMicrotask(() => (get || (() => assert.fail('unexpected network request')))(...args)) },
    $persistentStore: { read: () => null, write: () => true },
    $notification: { post() {} },
    console: { log() {} },
  }, { timeout: 3000 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1, `${file}: must finish exactly once`);
  return calls[0];
}
(async () => {
  function matches(name, url) {
    return [...fs.readFileSync(path.join(root, name + '.module'), 'utf8').matchAll(/pattern=(.*?),(?=[a-z-]+=)/g)]
      .some(match => new RegExp(match[1]).test(url));
  }
  assert(matches('HistoryPrice', 'https://api.m.jd.com/client.action?client=apple&functionId=wareBusiness&x=1'));
  assert(matches('HistoryPrice', 'https://api.m.jd.com/api?functionId=wareBusiness'));
  assert(!matches('HistoryPrice', 'https://api.m.jd.com/api?functionId=wareBusinessOther'));
  for (const endpoint of ['user_detail', 'vip_info']) {
    assert(matches('Caiyun', 'https://biz.cyapi.cn/api/v1/' + endpoint));
  }

  const caiyun = 'js/vendor/ddgksf2013/caiyun_json.js';
  const userUrl = 'https://biz.caiyunapp.com/v2/user?app_name=weather';
  assert.equal(JSON.parse((await run(caiyun, userUrl, { result: { wt: { vip: {} } } })).body).result.is_vip, 1);
  assert.deepEqual(await run(caiyun, userUrl, 'invalid json'), {});
  assert.equal(JSON.parse((await run(caiyun, userUrl, { result: { name: 'keep' } })).body).result.wt.vip.enabled, true);
  const detail = JSON.parse((await run(caiyun, 'https://biz.cyapi.cn/api/v1/user_detail', { vip_info: { vip: { keep: true } } })).body);
  assert(detail.vip_info.svip.expires_time > Date.now() / 1000);
  assert.equal(detail.vip_info.vip.keep, true);
  const vip = JSON.parse((await run(caiyun, 'https://wrapper.cyapi.cn/api/v1/vip_info', { svip: null })).body);
  assert(vip.svip.expires_time > Date.now() / 1000);
  assert.deepEqual(await run(caiyun, userUrl, { status: 'error', result: null }), {});

  const price = 'js/vendor/deezertidal/jdprice.js';
  const jd = 'https://api.m.jd.com/client.action?functionId=';
  assert.deepEqual(JSON.parse((await run(price, jd + 'serverConfig', {
    serverConfig: { httpdns: 'x', dnsvip: 'x', dnsvip_v6: 'x', keep: true },
  })).body), { serverConfig: { keep: true } });
  const product = { floors: [{ data: { wareInfo: { skuId: '123' } } }, { mId: 'bpAdword', data: { ad: { adword: '原促销', adLink: 'keep' } } }, { mId: 'tail' }] };
  for (const mode of ['partial', 'blocked', 'jsonp']) {
    const result = await run(price, jd + 'wareBusiness', product, (options, callback) => {
      if (!options.url.includes('price_towards')) return callback(null, { status: 200, headers: {} }, '{}');
      const data = mode === 'blocked' ? { is_ban: 1 } : { store: [{ last_price: 12345, lowest: 100, highest: 150 }] };
      callback(null, { status: mode === 'blocked' ? 202 : 200 }, mode === 'jsonp' ? 'cb(' + JSON.stringify(data) + ');' : JSON.stringify(data));
    });
    const output = JSON.parse(result.body);
    assert.equal(output.floors.length, 3);
    const ad = output.floors[1].data.ad;
    assert(ad.adword.includes(mode === 'blocked' ? '验证' : '123.45'));
    assert(ad.adword.includes('原促销'));
    assert.equal(ad.adLink, 'keep');
  }
  for (const mode of ['offline', 'invalid', 'empty-cookie', 'success']) {
    const requests = [];
    const result = await run(price, jd + 'wareBusiness', {
      floors: [{ data: { wareInfo: { skuId: '123' } }, sortId: 20 }],
    }, (options, callback) => {
      requests.push(options.url);
      assert(options.url.startsWith('https://browser.bijiago.com/'));
      if (mode === 'offline') callback('network error');
      else if (options.url.includes('price_towards')) callback(null, { status: 200 }, mode === 'invalid' ? '<html>' : '{"store":[]}');
      else callback(null, { status: 200, headers: mode === 'empty-cookie' ? {} : { 'set-cookie': 'gwdang_permanent=test;path=/' } }, '{}');
    });
    assert.equal(requests.length, 2);
    assert.equal(JSON.parse(result.body).floors.length, 2);
  }
  console.log(`PASS: ${scripts.size} local scripts compile; references, Ximalaya passthrough, Caiyun and price failure paths verified`);

})().catch(error => { console.error(error); process.exitCode = 1; });
