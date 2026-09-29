// Run: node tests/ximalaya-body-rewrite.test.js (requires jq)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const text = fs.readFileSync(require.resolve('../XimalayaShadowrocket.module'), 'utf8');
const rules = text.split('\n').filter(line => line.startsWith('http-response-jq '));
assert.equal(rules.length, 2);
assert(!text.includes('[Script]'));
for (const [index, line] of rules.entries()) {
  const match = /^http-response-jq (\S+) '(.*)'$/.exec(line);
  assert(match);
  const pattern = new RegExp(match[1]);
  const field = index === 0 ? 'balance' : 'durationBalance';
  const endpoints = index === 0 ? ['currentDuration', 'decreaseDuration', 'rewardDuration'] : ['recAlbumInfo'];
  for (const endpoint of endpoints) {
    // Match both hosts.
    for (const host of ['adse.ximalaya.com', 'adse.wsa.ximalaya.com']) {
      assert(pattern.test('https://' + host + '/incentive/ting/' + endpoint + '/ts-123?device=test'));
    }
  }
  assert(!pattern.test('https://adse.ximalaya.com/welfare/queryListenTime'));
  assert(!pattern.test('https://evil.adse.wsa.ximalaya.com.attacker.test/incentive/ting/' + endpoints[0]));
  const run = value => JSON.parse(execFileSync('jq', ['-c', match[2]], { input: JSON.stringify(value), encoding: 'utf8' }));
  const response = { ret: 0, data: { [field]: 975, ...(index === 0 ? { success: true } : {}), duration: 0, rewardInfos: [{ rewardDuration: 1800 }] } };
  assert.deepEqual(run(response), { ...response, data: { ...response.data, [field]: 86400 } });
  for (const value of [null, [], 42, {}, { ...response, ret: 1 }, ...[-1, 1.5, 86400, 100000, null, 'invalid'].map(balance => ({ ...response, data: { ...response.data, [field]: balance } }))]) assert.deepEqual(run(value), value);
  if (index === 0) {
    const failure = { ...response, data: { ...response.data, success: false } };
    assert.deepEqual(run(failure), failure);
  }
}
const requests = text.split('\n').filter(line => line.startsWith('http-request-jq '));
assert.equal(requests.length, 2);
const request = /^http-request-jq (\S+) '(.*)'$/.exec(requests[0]);
assert(request);
const requestPattern = new RegExp(request[1]);
for (const host of ['adse.ximalaya.com', 'adse.wsa.ximalaya.com']) {
  for (const suffix of ['', '/ts-123?device=test']) {
    assert(requestPattern.test('https://' + host + '/incentive/ting/decreaseDuration' + suffix));
  }
}
for (const url of ['https://adse.ximalaya.com/incentive/ting/currentDuration', 'https://adse.ximalaya.com/incentive/ting/decreaseDurationOther', 'https://evil.test/incentive/ting/decreaseDuration']) assert(!requestPattern.test(url));
const runRequest = value => JSON.parse(execFileSync('jq', ['-c', request[2]], { input: JSON.stringify(value), encoding: 'utf8' }));
const body = {
  duration: 60, localDuration: 120, albumId: 123, trackId: 456,
  eventExt: '{"kind":"example","duration":99}', ext: '{"enabled":true}',
  data: { duration: 99 },
};
assert.deepEqual(runRequest(body), { ...body, duration: 0 });
for (const value of [null, [], 42, {}, { data: { duration: 60 } }]) assert.deepEqual(runRequest(value), value);
const syncRequest = /^http-request-jq (\S+) '(.*)'$/.exec(requests[1]);
assert(syncRequest);
assert.equal(syncRequest[2], request[2]);
const syncPattern = new RegExp(syncRequest[1]);
const syncUrl = 'https://ad-incentive.ximalaya.com/incentive-sync/ting/welfare/syncListenTime';
for (const suffix of ['', '/ts-123?device=test']) {
  assert(syncPattern.test(syncUrl + suffix));
  assert(new RegExp(rules[0].split(' ')[1]).test(syncUrl + suffix));
}
const balanceFilter = /^http-response-jq (\S+) '(.*)'$/.exec(rules[0])[2];
const syncResponse = { ret: 0, data: { duration: 0, balance: 60, success: true, code: 200, msg: null } };
const result = JSON.parse(execFileSync('jq', ['-c', balanceFilter], { input: JSON.stringify(syncResponse), encoding: 'utf8' }));
assert.deepEqual(result, { ...syncResponse, data: { ...syncResponse.data, balance: 86400 } });
for (const url of [syncUrl + 'Other', syncUrl + '/extra', syncUrl.replace('ad-incentive.ximalaya.com', 'evil.test'), syncUrl.replace('ad-incentive.ximalaya.com', 'adse.ximalaya.com')]) assert(!syncPattern.test(url));
assert(text.split('[Rule]')[1].split('[Body Rewrite]')[0].includes('DOMAIN,ad-incentive.ximalaya.com,DIRECT'));
assert(text.split('[MITM]')[1].includes('ad-incentive.ximalaya.com'));
console.log('PASS: native jq request duration=0, response balances, endpoint matching and passthrough');
