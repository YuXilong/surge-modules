// Run: node tests/ximalaya-vip.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const script = fs.readFileSync(require.resolve("../js/ximalaya_vip.js"), "utf8");
const base = "https://adse.ximalaya.com/incentive/ting/";
const response = { ret: 0, data: { success: true, balance: 60, duration: 600, continuePlay: false } };
function run(body, url = base + "currentDuration/ts-123", status = 200) {
  const calls = [];
  vm.runInNewContext(script, {
    $request: { url },
    $response: { body: typeof body === "string" ? body : JSON.stringify(body), status },
    $done: (result) => calls.push(JSON.parse(JSON.stringify(result))),
    console: { log() {} },
  });
  assert.equal(calls.length, 1, "must finish exactly once");
  return calls[0];
}

for (const endpoint of ["currentDuration", "decreaseDuration", "rewardDuration"]) {
  for (const suffix of ["", "/ts-123?device=example"]) {
    const actual = JSON.parse(run(response, base + endpoint + suffix).body);
    assert.deepEqual(actual, { ...response, data: { ...response.data, balance: 86400 } });
  }
}
const stringResponse = { ret: "0", data: { success: "true", balance: "0" } };
assert.equal(JSON.parse(run(stringResponse).body).data.balance, "86400");
for (const body of [
  "", "not json", "null", "[]", "42", {},
  { ...response, ret: 1 }, { data: response.data },
  { ...response, data: null }, { ...response, data: [] },
  ...[false, 0, "false", "0", null, undefined].map((success) => ({ ...response, data: { ...response.data, success } })),
  ...[86400, 100000, "100000", -1, 1.5, null, true, {}, "", "1e3", "oops", Number.MAX_SAFE_INTEGER + 1].map((balance) => ({ ...response, data: { ...response.data, balance } })),
]) assert.deepEqual(run(body), {}, JSON.stringify(body));
for (const url of [
  "https://www.ximalaya.com/incentive/ting/currentDuration",
  "https://adse.ximalaya.com.evil.test/incentive/ting/currentDuration",
  base + "durationConfig", base + "currentDurationOther", base + "rewardDuration/extra",
]) assert.deepEqual(run(response, url), {}, url);
assert.deepEqual(run(response, base + "currentDuration", 500), {});
assert.equal(JSON.parse(run(response, base.replace("https:", "http:") + "currentDuration").body).data.balance, 86400);
const moduleText = fs.readFileSync(require.resolve("../Ximalaya.module"), "utf8");
assert(moduleText.includes("hostname = %APPEND% adse.ximalaya.com"));
assert(moduleText.includes("/js/ximalaya_vip.js"));
// A module rule must allow the duration/reward host before the conflicting base-config block.
const moduleRules = moduleText.split("[Rule]")[1]?.split(/\n\[/)[0] || "";
const rules = (moduleRules + "\nDOMAIN-SUFFIX,adse.ximalaya.com,REJECT")
  .split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#"));
function route(host) {
  for (const rule of rules) {
    const [type, value, policy] = rule.split(",").map(part => part.trim());
    if ((type === "DOMAIN" && host === value) ||
        (type === "DOMAIN-SUFFIX" && (host === value || host.endsWith("." + value)))) return policy;
  }
}
assert.equal(route("adse.ximalaya.com"), "DIRECT", "free-listen host must override the base-config reject");
assert.equal(route("unrelated.example"), undefined);
console.log("PASS: three endpoints, passthrough, type preservation, unchanged reward fields, and module references");
