// Run: node tests/ximalaya-vip.test.js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const script = fs.readFileSync(require.resolve("../js/ximalaya_vip.js"), "utf8");
const base = "https://adse.ximalaya.com/incentive/ting/";
const response = { ret: 0, data: { success: true, balance: 60, duration: 600, continuePlay: false } };
function run(body, url = base + "currentDuration/ts-123", status = 200, responseFields = {}) {
  const calls = [];
  vm.runInNewContext(script, {
    $request: { url },
    $response: { body: typeof body === "string" ? body : JSON.stringify(body), status, ...responseFields },
    $done: (result) => calls.push(JSON.parse(JSON.stringify(result))),
    console: { log() {} },
  });
  assert.equal(calls.length, 1, "must finish exactly once");
  return calls[0];
}

const wsaBase = "https://adse.wsa.ximalaya.com/incentive/ting/";
for (const endpoint of ["currentDuration", "decreaseDuration", "rewardDuration"]) {
  for (const host of [base, wsaBase]) {
    for (const suffix of ["", "/ts-123?device=example"]) {
      const actual = JSON.parse(run(response, host + endpoint + suffix).body);
      assert.deepEqual(actual, { ...response, data: { ...response.data, balance: 86400 } });
    }
  }
}
// The free-listen page uses durationBalance and has no success flag.
const page = { ret: 0, data: { durationBalance: 975, freeListenType: 0, rewardInfos: [{ rewardDuration: 1800, addedDuration: 0 }] } };
// Match both hosts for recAlbumInfo.
for (const host of [base, wsaBase]) {
  for (const suffix of ["", "/ts-123?device=example"]) {
    assert.deepEqual(JSON.parse(run(page, host + "recAlbumInfo" + suffix).body),
      { ...page, data: { ...page.data, durationBalance: 86400 } });
  }
}
for (const body of [{ ...page, ret: 1 }, { ret: 0, data: { durationBalance: -1 } },
  { ret: 0, data: { durationBalance: "invalid" } }, { ret: 0, data: { balance: 975 } }]) {
  assert.deepEqual(run(body, base + "recAlbumInfo"), {});
}
assert.deepEqual(run(page, base + "recAlbumInfo", 500), {});
assert.deepEqual(run(response, "https://adse.ximalaya.com/welfare/queryListenTime/ts-123"), {});
// Proxy runtimes can expose either statusCode or an HTTP status line.
for (const fields of [{ status: undefined, statusCode: 200 }, { status: "HTTP/1.1 200 OK" }, { status: "HTTP/2 200" }]) {
  assert.equal(JSON.parse(run(response, base + "currentDuration", 200, fields).body).data.balance, 86400);
}
for (const fields of [{ status: undefined }, { status: "HTTP/1.1 500 Internal Server Error" }, { status: undefined, statusCode: 403 }]) {
  assert.deepEqual(run(response, base + "currentDuration", 200, fields), {});
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
const pattern = new RegExp(moduleText.match(/ximalaya-free-listen = .*?pattern=(.*?),requires-body/)[1]);
assert(pattern.test(base + "recAlbumInfo/ts-123?device=example"));
const requestRule = moduleText.match(/ximalaya-decrease-request = type=http-request,pattern=(.*?),requires-body=1,script-path=(\S+)/);
assert(requestRule);
assert(requestRule[2].includes("/js/ximalaya_vip.js?v=20260930-2"));
const requestPattern = new RegExp(requestRule[1]);
function runRequest(body, url = base + "decreaseDuration/ts-123") {
  const calls = [];
  vm.runInNewContext(script, {
    $request: { url, method: "POST", headers: { "content-type": "application/json", "x-example": "test-only" }, body: typeof body === "string" ? body : JSON.stringify(body) },
    $done: value => calls.push(JSON.parse(JSON.stringify(value))),
    console: { log() {} },
  });
  assert.equal(calls.length, 1);
  return calls[0];
}
for (const host of [base, wsaBase]) {
  for (const suffix of ["", "/ts-123?device=example"]) {
    const url = host + "decreaseDuration" + suffix;
    assert(requestPattern.test(url));
    const body = {
      duration: 60, localDuration: 120, albumId: 123, trackId: 456,
      eventExt: '{"kind":"example","duration":99}', ext: '{"enabled":true}',
      data: { duration: 99 },
    };
    const result = runRequest(body, url);
    assert.deepEqual(Object.keys(result), ["body"], "must preserve URL and headers");
    assert.deepEqual(JSON.parse(result.body), { ...body, duration: 0 });
  }
}
for (const body of ["", "invalid json", null, [], 42, {}, { data: { duration: 60 } }]) {
  assert.deepEqual(runRequest(body), {});
}
for (const url of [base + "currentDuration", base + "decreaseDurationOther", "https://evil.test/incentive/ting/decreaseDuration"]) {
  assert(!requestPattern.test(url));
  assert.deepEqual(runRequest({ duration: 60 }, url), {});
}
const syncUrl = "https://ad-incentive.ximalaya.com/incentive-sync/ting/welfare/syncListenTime";
const syncRule = moduleText.match(/ximalaya-sync-listen-request = type=http-request,pattern=(.*?),requires-body=1,script-path=(\S+)/);
assert(syncRule);
assert.equal(syncRule[2], requestRule[2]);
const syncPattern = new RegExp(syncRule[1]);
const syncBody = { duration: 60, localDuration: 120, type: 2, signature: "test-signature", data: { duration: 99 } };
for (const suffix of ["", "/ts-123?device=example"]) {
  assert(syncPattern.test(syncUrl + suffix));
  const result = runRequest(syncBody, syncUrl + suffix);
  assert.deepEqual(Object.keys(result), ["body"]);
  assert.deepEqual(JSON.parse(result.body), { ...syncBody, duration: 0 });
  assert.deepEqual(JSON.parse(run(response, syncUrl + suffix).body), { ...response, data: { ...response.data, balance: 86400 } });
  assert(pattern.test(syncUrl + suffix));
}
for (const body of ["invalid json", { ...response, ret: 1 }, { ...response, data: { ...response.data, success: false } },
  ...[86400, 100000, -1, 1.5, null].map(balance => ({ ...response, data: { ...response.data, balance } }))]) {
  assert.deepEqual(run(body, syncUrl), {});
}
assert.deepEqual(run(response, syncUrl, 500), {});
for (const body of ["invalid json", null, [], {}, { localDuration: 120 }]) assert.deepEqual(runRequest(body, syncUrl), {});
for (const url of [syncUrl + "Other", syncUrl + "/extra", syncUrl.replace("ad-incentive.ximalaya.com", "evil.test"), syncUrl.replace("ad-incentive.ximalaya.com", "adse.ximalaya.com")]) {
  assert(!syncPattern.test(url));
  assert.deepEqual(runRequest(syncBody, url), {});
}
assert.equal(route("ad-incentive.ximalaya.com"), "DIRECT");
assert(moduleText.split("[MITM]")[1].includes("ad-incentive.ximalaya.com"));
console.log("PASS: both request durations=0, five response endpoints, passthrough and module references");
