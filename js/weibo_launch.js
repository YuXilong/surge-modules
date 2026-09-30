//参考@yichahucha 的脚本

const launchAdUrl1 = '/interface/sdk/sdkad.php';
const launchAdUrl2 = '/wbapplua/wbpullad.lua';

function modifyMain(url, data) {
	if (/^https?:\/\/bootpreload\.uve\.weibo\.com\/v2\/ad\/preload(?:\?|$)/.test(url)) {
		const parsed = JSON.parse(data);
		if (!parsed || !Array.isArray(parsed.ads)) return data;
		parsed.ads = [];
		return JSON.stringify(parsed);
	}
	if(url.indexOf(launchAdUrl1) > -1) {
		let temp = data.match(/\{.*\}/);
		if(!temp) return data;
		data = JSON.parse(temp);
		if (data.ads) data.ads = [];
		if (data.background_delay_display_time) data.background_delay_display_time = 60 * 60 * 24 * 1000;
		if (data.show_push_splash_ad) data.show_push_splash_ad = false;
		return JSON.stringify(data) + 'OK';
	}
	if(url.indexOf(launchAdUrl2) > -1) {
		data = JSON.parse(data);
		if (data.cached_ad && data.cached_ad.ads) {
			data.cached_ad.ads = [];
		}
		return JSON.stringify(data);
	}
	return data;
}

var body = $response.body;
var url = $request.url;
try {
	body = modifyMain(url, body);
	if (body !== $response.body) console.log('[微博去广告] v20260930-1 开屏广告已清理');
} catch (error) {
	console.log('[微博去广告] 开屏响应解析失败，保留原响应');
}

$done({ body });
