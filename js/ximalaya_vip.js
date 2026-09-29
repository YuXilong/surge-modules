/*
 * 喜马拉雅：实验性免费听本地时长改写。
 * decreaseDuration 的 JSON 请求字段 duration 归零；成功响应的 data.balance / data.durationBalance 提高到本地实验值。
 * 原始模板：YuXilong/module_scripts，yuxilong，2026/06/04。
 */
const minimumBalance = 86400; // 秒；实验值，不是服务端赠送时长。
let result = {};
try {
  const endpoint = /^https?:\/\/adse\.(?:wsa\.)?ximalaya\.com\/incentive\/ting\/(currentDuration|decreaseDuration|rewardDuration|recAlbumInfo)(?:\/ts-\d+)?(?:\?[^#]*)?$/.exec($request.url);
  if (typeof $response === "undefined") {
    if (endpoint && endpoint[1] === "decreaseDuration" && $request.body) {
      const payload = JSON.parse($request.body);
      if (payload && typeof payload === "object" && !Array.isArray(payload) &&
          Object.prototype.hasOwnProperty.call(payload, "duration")) {
        payload.duration = 0;
        result = { body: JSON.stringify(payload) };
        console.log("[喜马拉雅] v20260929-6 decreaseDuration 请求 duration -> 0");
      }
    }
  } else {
    const rawStatus = $response.status == null ? $response.statusCode : $response.status;
    const statusLine = /^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s|$)/.exec(String(rawStatus));
    const status = Number(statusLine ? statusLine[1] : rawStatus);
    if (endpoint) console.log(`[喜马拉雅] v20260929-6 已匹配 ${endpoint[1]}，HTTP ${status}，status=${JSON.stringify($response.status)}，statusCode=${JSON.stringify($response.statusCode)}，body=${typeof $response.body}/${($response.body || "").length}`);
    if (endpoint && status >= 200 && status < 300 && $response.body) {
      const payload = JSON.parse($response.body);
      const data = payload && payload.data;
      if (payload && (payload.ret === 0 || payload.ret === "0") && data &&
          typeof data === "object" && !Array.isArray(data) &&
          (endpoint[1] === "recAlbumInfo" || [true, 1, "1", "true"].includes(data.success))) {
        const field = endpoint[1] === "recAlbumInfo" ? "durationBalance" : "balance";
        const original = data[field];
        const balance = typeof original === "number" ? original :
          typeof original === "string" && /^\d+$/.test(original) ? Number(original) : NaN;
        if (Number.isSafeInteger(balance) && balance >= 0 && balance < minimumBalance) {
          data[field] = typeof original === "string" ? String(minimumBalance) : minimumBalance;
          result = { body: JSON.stringify(payload) };
          console.log(`[喜马拉雅] ${endpoint[1]} 本地 ${field}: ${balance} -> ${minimumBalance} 秒（服务端额度未修改）`);
        }
      }
    }
    if (endpoint && !result.body) console.log("[喜马拉雅] 未改写：响应状态、成功标志或余额不满足改写条件");
  }
} catch (_) {
  // 接口结构变化或非 JSON 响应时原样放行。
  console.log("[喜马拉雅] JSON 解析失败，已原样放行");
}
$done(result);
