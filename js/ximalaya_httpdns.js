// 仅将配置密文交给自有服务处理；不上传 URL、账号、Cookie 或设备标识。
(function () {
  const endpoint = 'https://uu.t-wk.com/v1/ximalaya/httpdns-config';
  const cacheKey = 'ximalaya-httpdns-service-v1';
  let finished = false;
  let timer;
  function finish(value) {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    $done(value || {});
  }
  function valid(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 96 * 1024 &&
      value.replace(/\s/g, '').length % 4 === 0 && /^[A-Za-z0-9+/\s]+={0,2}\s*$/.test(value);
  }
  function status(response) {
    const raw = response.status == null ? response.statusCode : response.status;
    const line = /^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s|$)/.exec(String(raw));
    return Number(line ? line[1] : raw);
  }
  function fail() {
    console.log('[喜马拉雅HTTPDNS] 配置服务未完成，已原样放行');
    finish();
  }
  try {
    const match = /^https:\/\/(gslbtx|gslbali)\.ximalaya\.com(?::443)?\/linkeye-cloud\/httpdns\/v3\/init\/(\d+)(?:\?[^#]*)?$/.exec($request.url);
    if (!match || ($request.method && $request.method !== 'GET')) return finish();
    if (typeof $response === 'undefined') {
      const versions = $request.url.match(/[?&]version=[^&#]*/g) || [];
      if (versions.length !== 1 || versions[0].endsWith('=0e')) return finish();
      return finish({url: $request.url.replace(/([?&]version=)[^&#]*/, '$10e')});
    }
    if (status($response) !== 200 || typeof $response.body !== 'string') return finish();
    const payload = JSON.parse($response.body);
    if (!payload || payload.rtn_code !== '200' || payload.timestamp !== match[2] || !valid(payload.rtn_data)) return finish();
    const original = payload.rtn_data;
    function apply(value, cached) {
      payload.rtn_data = value;
      console.log('[喜马拉雅HTTPDNS] 配置已处理' + (cached ? '（缓存）' : '（自有服务）'));
      finish({body: JSON.stringify(payload)});
    }
    try {
      const cache = JSON.parse($persistentStore.read(cacheKey) || 'null');
      if (cache && cache.input === original && valid(cache.output) &&
          cache.expires > Date.now() && cache.expires <= Date.now() + 86400000) return apply(cache.output, true);
    } catch (_) {}
    timer = setTimeout(fail, 5000);
    $httpClient.post({url: endpoint, timeout: 4, headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({rtn_data: original})}, function (error, response, data) {
      if (finished) return;
      try {
        if (error || !response || status(response) !== 200 || typeof data !== 'string' || data.length > 128 * 1024) return fail();
        const result = JSON.parse(data);
        if (!result || !valid(result.rtn_data)) return fail();
        try {
          $persistentStore.write(JSON.stringify({input: original, output: result.rtn_data, expires: Date.now() + 86400000}), cacheKey);
        } catch (_) {}
        apply(result.rtn_data, false);
      } catch (_) { fail(); }
    });
  } catch (_) { fail(); }
})();
