// Run: node tests/weibo-ads.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const moduleText = fs.readFileSync(require.resolve('../Weibo.module'), 'utf8');
const source = fs.readFileSync(require.resolve('../js/vendor/zmqcherish/weibo_main.js'), 'utf8');
const pattern = new RegExp(moduleText.split('\n').find(line => line.startsWith('微博去广告=')).match(/pattern=(.*?),requires-body/)[1]);
function rewrite(path, body) {
  const url = 'https://api.weibo.cn/2/' + path;
  if (!pattern.test(url)) return body;
  const calls = [];
  vm.runInNewContext(source, {
    $request: {url}, $response: {body: JSON.stringify(body)},
    $done: value => calls.push(value), $httpClient: {},
    $persistentStore: {read: () => null}, console: {log() {}}
  });
  assert.equal(calls.length, 1);
  return JSON.parse(calls[0].body);
}
const organic = {category: 'feed', data: {id: 'normal', text: '普通微博'}};
const ad = {category: 'feed', data: {id: 'ad', promotion: {type: 'ad'}}};
for (const path of ['statuses/container_timeline?count=20', 'statuses/container_timeline_unread?count=20', 'statuses/container_timeline_hot?count=20', 'profile/container_timeline?count=20']) {
  assert.deepEqual(rewrite(path, {items: [organic, ad], next_cursor: 'next'}), {items: [organic], next_cursor: 'next'}, path);
}
assert.deepEqual(rewrite('statuses/repost_timeline?count=20', {reposts: [organic.data, ad.data]}), {reposts: [organic.data]});
assert.deepEqual(rewrite('statuses/friends/timeline?count=20', {statuses: [organic.data, ad.data]}), {statuses: [organic.data]});
console.log('PASS: Weibo module routes supported feeds through ad removal and preserves normal posts/cursors');
const launchSource = fs.readFileSync(require.resolve('../js/vendor/zmqcherish/weibo_launch.js'), 'utf8');
const launchPattern = new RegExp(moduleText.split('\n').find(line => line.startsWith('微博去广告1=')).match(/pattern=(.*?),requires-body/)[1]);
function launch(url, body) {
  const original = typeof body === 'string' ? body : JSON.stringify(body);
  if (!launchPattern.test(url)) return original;
  const calls = [];
  vm.runInNewContext(launchSource, {$request: {url}, $response: {body: original}, $done: value => calls.push(value), console: {log() {}}});
  assert.equal(calls.length, 1);
  return calls[0].body;
}
const preloadURL = 'https://bootpreload.uve.weibo.com/v2/ad/preload?capture=1';
const preload = {code: 0, background_interval: 60, foreground_req_preload: true, ads: [{creatives: [{}]}]};
assert.deepEqual(JSON.parse(launch(preloadURL, preload)), {...preload, ads: []});
const cached = {cached_ad: {ads: [{id: 1}], delete_days: 7}};
assert.deepEqual(JSON.parse(launch('https://wbapp.uve.weibo.com/wbapplua/wbpullad.lua', cached)), {cached_ad: {ads: [], delete_days: 7}});
assert.equal(launch(preloadURL, 'invalid'), 'invalid');
assert.equal(launch(preloadURL, 'null'), 'null');
assert.equal(launch('https://bootpreload.uve.weibo.com/v2/ad/preload-extra', preload), JSON.stringify(preload));
console.log('PASS: captured splash preload and cached ads cleared; metadata and invalid responses preserved');
