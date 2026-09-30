// Run: node tests/ximalaya-httpdns.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const vm = require("node:vm");
const script = fs.readFileSync(require.resolve("../js/ximalaya_httpdns.js"), "utf8");
const key = script.match(/const signingKey = "([a-f0-9]{64})";/)[1];
const sign = text => crypto.createHash("md5").update(("plans=" + text).toLowerCase() + "&" + key).digest("hex");
const plans = [{ action: { actionType: "item", payload: { "ios&dnsEffectEnable": "true", other: "中文 Test 😀 ]" } }, version: 2 },
  { action: { payload: { keep: "unchanged" } } }];
function signed(value = plans) {
  return JSON.stringify({ ret: 0, signature: sign(JSON.stringify(value)), plans: value });
}
function run(body = signed(), url = "https://mobile.ximalaya.com/abtest-portal/sync/123", headers = {}, fields = {}) {
  const calls = [];
  vm.runInNewContext(script, {
    $request: { url, headers }, $response: { body, status: 200, ...fields },
    $done: value => calls.push(JSON.parse(JSON.stringify(value))), console: { log() {} },
  }, { timeout: 3000 });
  assert.equal(calls.length, 1);
  return calls[0];
}
const expected = JSON.parse(JSON.stringify(plans));
expected[0].action.payload["ios&dnsEffectEnable"] = "false";
for (const host of ["mobile.ximalaya.com", "mobilehera.ximalaya.com", "mobwsa.ximalaya.com"]) {
  for (const authority of [host, "203.0.113.45", "[2001:db8::7]"]) {
    const result = run(signed(), `https://${authority}/abtest-portal/sync/123?device=test`, { hOsT: host });
    const body = JSON.parse(result.body);
    assert.deepEqual(body, { ret: 0, signature: sign(JSON.stringify(expected)), plans: expected });
    assert.deepEqual(run(result.body), {}, "already disabled must pass through");
  }
}
for (const fields of [{ status: "HTTP/2 200" }, { status: undefined, statusCode: 200 }]) {
  assert(run(signed(), undefined, undefined, fields).body);
}
for (const [body, url, headers, fields] of [
  [signed(), "https://203.0.113.45/abtest-portal/sync/123"],
  [signed(), "https://unrelated.example/abtest-portal/sync/123"],
  [signed(), "https://mobile.ximalaya.com.evil.test/abtest-portal/sync/123"],
  [signed(), "https://mobile.ximalaya.com/abtest-portal/sync/123extra"],
  [signed(), "https://mobile.ximalaya.com/abtest-portal/sync/123", { Host: "unrelated.example" }],
  [signed(), undefined, undefined, { status: 500 }],
  [signed().replace('"ret":0', '"ret":1')],
  [signed().replace('"true"', '"false"')], // stale signature
  [signed([])], [signed([null, {}, { action: null }])],
  ["not json"], ["null"], ["[]"], ["{}"],
]) assert.deepEqual(run(body, url, headers, fields), {});
// Independent MD5 reference, including UTF-8 and block-padding boundaries.
const context = vm.createContext({ $request: { url: "" }, $response: {}, $done() {}, console: { log() {} } });
vm.runInContext(script, context);
for (const value of ["", "abc", "中文😀", ...[55, 56, 63, 64, 65, 1000].map(n => "a".repeat(n))]) {
  context.input = value;
  assert.equal(vm.runInContext("md5(input)", context), crypto.createHash("md5").update(value).digest("hex"));
}
for (const name of ["Ximalaya", "XimalayaShadowrocket"]) {
  const text = fs.readFileSync(require.resolve(`../${name}.module`), "utf8");
  const line = text.split("\n").find(l => l.startsWith("ximalaya-httpdns ="));
  assert(line && line.includes("requires-body=1") && line.includes("/js/ximalaya_httpdns.js"));
  const pattern = new RegExp(line.match(/pattern=(.*?),requires-body/)[1]);
  for (const authority of ["mobile.ximalaya.com", "mobilehera.ximalaya.com", "mobwsa.ximalaya.com", "203.0.113.45", "[2001:db8::7]"]) {
    assert(pattern.test(`https://${authority}/abtest-portal/sync/123`));
  }
  assert(!pattern.test("https://mobile.ximalaya.com/abtest-portal/sync/123extra"));
  const mitm = text.split("[MITM]")[1];
  for (const host of ["mobile.ximalaya.com", "mobilehera.ximalaya.com", "mobwsa.ximalaya.com"]) assert(mitm.includes(host));
  assert(!mitm.includes("<ip-address>"), "normal module must not decrypt unrelated IP traffic");
}
console.log("PASS: signed HTTPDNS switch, dynamic IP/Host, status variants, passthrough, MD5 and module wiring");
