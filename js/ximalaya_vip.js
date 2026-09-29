/*
 * 喜马拉雅 9.5.10：实验性免费听本地时长改写。
 * 仅提高成功响应的 data.balance，不增加服务端额度，也不保证音频授权。
 * 原始模板：YuXilong/module_scripts，yuxilong，2026/06/04。
 */
const minimumBalance = 86400; // 秒；实验值，不是服务端赠送时长。
let result = {};
try {
  const endpoint = /^https?:\/\/adse\.ximalaya\.com\/incentive\/ting\/(currentDuration|decreaseDuration|rewardDuration)(?:\/ts-\d+)?(?:\?[^#]*)?$/.exec($request.url);
  const status = Number($response.status);
  if (endpoint && status >= 200 && status < 300 && $response.body) {
    const payload = JSON.parse($response.body);
    const data = payload && payload.data;
    if (payload && (payload.ret === 0 || payload.ret === "0") && data &&
        !Array.isArray(data) && [true, 1, "1", "true"].includes(data.success)) {
      const original = data.balance;
      const balance = typeof original === "number" ? original :
        typeof original === "string" && /^\d+$/.test(original) ? Number(original) : NaN;
      if (Number.isSafeInteger(balance) && balance >= 0 && balance < minimumBalance) {
        data.balance = typeof original === "string" ? String(minimumBalance) : minimumBalance;
        result = { body: JSON.stringify(payload) };
        console.log(`[喜马拉雅] ${endpoint[1]} 本地 balance: ${balance} -> ${minimumBalance} 秒（服务端额度未修改）`);
      }
    }
  }
} catch (_) {
  // 接口结构变化或非 JSON 响应时原样放行。
}
$done(result);
