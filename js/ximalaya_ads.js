// 只清理已确认的普通广告位，保留初始化、激励广告及未知广告位。
(function () {
  let result = {};
  try {
    const match = /^https?:\/\/([^/?#:]+)(?::(?:80|443))?(\/[^?#]*)(?:\?[^#]*)?$/.exec($request.url);
    const raw = $response.status == null ? $response.statusCode : $response.status;
    const line = /^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s|$)/.exec(String(raw));
    if (!match || Number(line ? line[1] : raw) !== 200 || typeof $response.body !== 'string') return $done({});
    const data = JSON.parse($response.body);
    if (!data || Array.isArray(data) || (data.ret !== 0 && data.ret !== '0')) return $done({});
    const adHost = /^adse\.(wsa\.)?ximalaya\.com$/.test(match[1]);
    let changed = false;
    function clear(object, field, array) {
      const value = object[field];
      if (value && (array ? Array.isArray(value) : typeof value === 'object' && !Array.isArray(value)) && Object.keys(value).length) {
        object[field] = array ? [] : {};
        changed = true;
      }
    }
    if (adHost && /^\/ting\/loading(?:\/ts-\d+)?$/.test(match[2])) {
      clear(data, 'data', true);
      clear(data, 'adTypes', true);
      clear(data, 'bidSlotList', false);
    } else if (adHost && match[2] === '/adx/ad' && Array.isArray(data.slotAds)) {
      for (const slot of data.slotAds) {
        if (!slot || ![1, 28, 44, 293, 316, 318].some(id => slot.positionId === id || slot.positionId === String(id))) continue;
        clear(slot, 'ads', true);
        clear(slot, 'bidSlotList', false);
      }
    } else if (/^(mobile|mobilehera|mobwsa)\.ximalaya\.com$/.test(match[1]) && /^\/discovery-feed\/v4\/mix(?:\/ts-\d+)?$/.test(match[2])) {
      for (const field of ['body', 'heData']) {
        if (!Array.isArray(data[field])) continue;
        const keep = data[field].filter(item => !item || !['IndexFeedAd/DoubleStream', 'IndexFeedAd/BigPicture'].includes(item.itemType));
        if (keep.length !== data[field].length) { data[field] = keep; changed = true; }
      }
    }
    if (changed) {
      console.log('[喜马拉雅广告] 已清理普通广告位');
      result = {body: JSON.stringify(data)};
    }
  } catch (_) {}
  $done(result);
})();
