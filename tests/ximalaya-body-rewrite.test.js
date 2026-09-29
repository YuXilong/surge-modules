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
    assert(pattern.test('https://adse.ximalaya.com/incentive/ting/' + endpoint + '/ts-123?device=test'));
  }
  assert(!pattern.test('https://adse.ximalaya.com/welfare/queryListenTime'));
  const run = value => JSON.parse(execFileSync('jq', ['-c', match[2]], { input: JSON.stringify(value), encoding: 'utf8' }));
  const response = { ret: 0, data: { [field]: 975, ...(index === 0 ? { success: true } : {}), duration: 0, rewardInfos: [{ rewardDuration: 1800 }] } };
  assert.deepEqual(run(response), { ...response, data: { ...response.data, [field]: 86400 } });
  for (const value of [null, [], 42, {}, { ...response, ret: 1 }, ...[-1, 1.5, 86400, 100000, null, 'invalid'].map(balance => ({ ...response, data: { ...response.data, [field]: balance } }))]) assert.deepEqual(run(value), value);
  if (index === 0) {
    const failure = { ...response, data: { ...response.data, success: false } };
    assert.deepEqual(run(failure), failure);
  }
}
console.log('PASS: native jq balance rewrite, endpoint matching, unchanged fields and failure passthrough');
