let result = {};
try {
  const url = $request.url;
  const status = String($response.status == null ? $response.statusCode : $response.status);
  if (/^(?:200|HTTP\/\d(?:\.\d)? 200(?: .*)?)$/.test(status)) {
    const data = JSON.parse($response.body);
    let changed = false;
    const headers = $request.headers || {};
    const ua = Object.keys(headers).find(key => key.toLowerCase() === 'user-agent');
    if (/^https?:\/\/s\.baertt\.com(?::443)?\/qm\/newad\/(?:platform\/config|ad\/list)(?:\?[^#]*)?$/.test(url) && ua && /^xiaobai\//i.test(headers[ua]) && data && data.code === 200 && data.data) {
      for (const key of ['platform_configs', 'preload_configs']) {
        if (Array.isArray(data.data[key])) {
          data.data[key] = [];
          changed = true;
        }
      }
      if (data.data.bidding_config && Array.isArray(data.data.bidding_config.slot_configs)) {
        data.data.bidding_config.slot_configs = [];
        changed = true;
      }
    } else if (/^https?:\/\/b\.welife001\.com(?::443)?\/app\/getAdConfV2(?:\?[^#]*)?$/.test(url) && data && data.code === 0 && Array.isArray(data.data)) {
      for (const slot of data.data) {
        if (slot && typeof slot === 'object' && slot.ad_show === true) {
          slot.ad_show = false;
          changed = true;
        }
      }
    } else if (/^https?:\/\/(?:admin\.hzjizhun\.cn(?::443)?\/infoConfig\/(?:833931|090774)|ad\.baihemob\.com(?::443)?\/infoConfig\/926475)(?:\?[^#]*)?$/.test(url) && data && data.msg === 'ok' && data.result && Array.isArray(data.result.posIdRelationList)) {
      changed = data.result.posIdRelationList.length > 0;
      data.result.posIdRelationList = [];
    }
    if (changed) {
      result = {body: JSON.stringify(data)};
      console.log('[班级小管家/小白智慧打印] v20260930-2 已清理广告配置：' + url.split('?')[0]);
    }
  }
} catch (_) {
  console.log('[班级小管家/小白智慧打印] 响应格式异常，原样放行');
}
$done(result);
