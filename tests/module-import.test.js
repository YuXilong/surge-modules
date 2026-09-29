// Run: node tests/module-import.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const prefix = 'https://raw.githubusercontent.com/YuXilong/surge-modules/main/';
const modules = ['AdUltraPlus', 'Caiyun', 'Weibo', 'Ximalaya', 'HistoryPrice'];
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
      const file = path.join(root, match[2].slice(prefix.length));
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
assert(blockers.some(regex => regex.test('https://adse.ximalaya.com/ting/loading?test=1')));

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
  const ximalaya = 'js/vendor/ddgksf2013/ximalaya_json.js';
  const feed = JSON.parse((await run(ximalaya, 'https://mobile.ximalaya.com/discovery-feed/v3/mix', {
    body: [{ item: { adInfo: {} } }, { item: { moduleType: 'mix_ad' } }, { item: { id: 1 } }],
  })).body);
  assert.deepEqual(feed.body, [{ item: { id: 1 } }]);
  const caiyun = 'js/vendor/ddgksf2013/caiyun_json.js';
  const userUrl = 'https://biz.caiyunapp.com/v2/user?app_name=weather';
  assert.equal(JSON.parse((await run(caiyun, userUrl, { result: { wt: { vip: {} } } })).body).result.is_vip, 1);
  assert.deepEqual(await run(caiyun, userUrl, 'invalid json'), {});
  const price = 'js/vendor/deezertidal/jdprice.js';
  const jd = 'https://api.m.jd.com/client.action?functionId=';
  assert.deepEqual(JSON.parse((await run(price, jd + 'serverConfig', {
    serverConfig: { httpdns: 'x', dnsvip: 'x', dnsvip_v6: 'x', keep: true },
  })).body), { serverConfig: { keep: true } });
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
  console.log(`PASS: ${scripts.size} local scripts compile; references, incentive endpoints, ad filtering, Caiyun and price failure paths verified`);

})().catch(error => { console.error(error); process.exitCode = 1; });
