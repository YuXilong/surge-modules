(function () {
try {
/***********************************************
> 应用名称：墨鱼自用彩云天气去广告脚本
> 脚本作者：@ddgksf2013
> 微信账号：墨鱼手记
> 更新时间：2024-09-01
> 通知频道：https://t.me/ddgksf2021
> 贡献投稿：https://t.me/ddgksf2013_bot
> 问题反馈：ddgksf2013@163.com
> 特别提醒：如需转载请注明出处，谢谢合作！
***********************************************/




const url = $request.url.split('?')[0];
const object = value => value && typeof value === 'object' && !Array.isArray(value);
if (/\/v\d+\/(user|user_detail|vip_info)\/?$/.test(url)) {
  const body = JSON.parse($response.body);
  if (!object(body) || Number($response.status || 200) >= 400 || body.status === 'error') return $done({});
  const expiry = 4092599349;
  const update = info => {
    info.show_upcoming_renewal = false;
    for (const key of ['vip', 'svip']) info[key] = { ...(object(info[key]) ? info[key] : {}), expires_time: expiry, is_auto_renewal: true };
  };
  if (/\/user\/?$/.test(url)) {
    if (!object(body.result)) return $done({});
    const result = body.result;
    Object.assign(result, { is_vip: 1, vip_type: 's', vip_expired_at: expiry, svip_expired_at: expiry, vip_take_effect: 1, svip_take_effect: 1 });
    if (!object(result.wt)) result.wt = {};
    result.wt.vip = { ...(object(result.wt.vip) ? result.wt.vip : {}), enabled: true, expired_at: expiry, svip_expired_at: expiry, svip_apple_expired_at: expiry };
  } else if (/\/user_detail\/?$/.test(url)) {
    if (!object(body.vip_info)) return $done({});
    update(body.vip_info);
  } else {
    if (!('vip' in body) && !('svip' in body)) return $done({});
    update(body);
  }
  console.log('彩云天气：已处理 ' + url.split('/').filter(Boolean).pop());
  return $done({ body: JSON.stringify(body) });
}

const version = 'V1.0.8';

let responseBody={};$request.url.includes("/v2/user")?((responseBody=JSON.parse($response.body)).result.is_vip=1,responseBody.result.svip_expired_at=1892260800,responseBody.result.wt.vip.expired_at=1892260800,responseBody.result.svip_take_effect=1,responseBody.result.vip_type="s"):$request.url.includes("user_detail")?(responseBody=JSON.parse($response.body),["svip","vip"].forEach(e=>{responseBody.vip_info[e]&&(responseBody.vip_info[e]={expires_time:"1892260800",is_auto_renewal:!0})})):$request.url.includes("activity")?responseBody=$request.url.includes("type_id=A03")?{status:"ok",activities:[{type:"tabbar",name:"aichat",feature:!1}]}:{status:"ok",activities:[{items:[{}]}]}:$request.url.includes("operation/homefeatures")?responseBody={data:[]}:$request.url.includes("operation/feeds")?(responseBody=JSON.parse($response.body)).data=responseBody.data.filter(e=>-1!=e.category_times_text.indexOf("人查看")):$request.url.includes("operation/banners")?responseBody={data:[{avatar:"https://cdn-w.caiyunapp.com/p/app/operation/prod/banner/668502d5c3a2362582a2a5da/d9f198473e7f387d13ea892719959ddb.jpg",url:"https://cdn-w.caiyunapp.com/p/app/operation/prod/article/66850143c3a2362582a2a5d9/index.html",title:"暴雨来袭，这些避险“秘籍”你学会了吗？",banner_type:"article"}]}:$request.url.includes("operation/features")?(responseBody=JSON.parse($response.body)).data=responseBody.data.filter(e=>-1!=e.url.indexOf("cy://")):$request.url.includes("campaigns")?responseBody={campaigns:[{name:"driveweather",title:"驾驶天气新功能",url:"cy://page_driving_weather",cover:"https://cdn-w.caiyunapp.com/p/banner/test/668d442c4fe75aca7251c161.png"}]}:$request.url.includes("notification/message_center")?responseBody={messages:[]}:$request.url.includes("config/cypage")?responseBody={popups:[],actions:[]}:$done({}),$done({body:JSON.stringify(responseBody)});

} catch (error) {
  console.log('彩云天气：响应处理失败 ' + error.name);
  $done({});
}

})();
