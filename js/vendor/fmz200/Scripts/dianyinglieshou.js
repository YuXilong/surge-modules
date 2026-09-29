/**
 * @author fmz200
 * @function 电影猎手
 * @date 2024-10-11 20:16:13
 */

let requestUrl = $request.url;
let responseBody = $response.body;

let obj = JSON.parse(responseBody);

// ^https:\/\/app-v1\.ecoliving168\.com\/api\/v1\/movie\/index_recommend\? url script-response-body https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/dianyinglieshou.js
//
// hostname = app-v1.ecoliving168.com
if (requestUrl.includes("/api/v1/movie/index_recommend?")) {
  // 判断obj.data是否存在且是数组
  if (Array.isArray(obj.data)) {
    console.log('去广告开始💕');
    // 遍历obj.data中的每个元素
    obj.data = obj.data.filter(item => {
      // 如果item.layout等于'advert_self'，则不保留这个元素
      if (item.layout === 'advert_self') {
        return false;
      }

      // 如果item.list是数组，则遍历并处理list中的元素
      if (Array.isArray(item.list)) {
        item.list = item.list.filter(subItem => subItem.type !== 3);
      }

      return true; // 保留其他元素
    });
  }
  console.log('去广告结束💕');
}

$done({body: JSON.stringify(obj)});
