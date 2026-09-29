# Surge Modules

Surge 模块与配套脚本。脚本和拦截响应文件均保存在本仓库；安装前需启用并信任 MITM 证书。

## 模块安装

在 Surge → 模块 → 从 URL 安装中填入对应地址：

| 模块 | 安装地址 | 功能 |
| --- | --- | --- |
| Spotify | [Spotify.module](https://raw.githubusercontent.com/YuXilong/surge-modules/main/Spotify.module) | 部分账户属性改写与去广告 |
| 通用去广告 | [AdUltraPlus.module](https://raw.githubusercontent.com/YuXilong/surge-modules/main/AdUltraPlus.module) | 启动页、信息流等广告拦截 |
| 彩云天气 | [Caiyun.module](https://raw.githubusercontent.com/YuXilong/surge-modules/main/Caiyun.module) | 本地会员字段改写与广告拦截 |
| 微博 | [Weibo.module](https://raw.githubusercontent.com/YuXilong/surge-modules/main/Weibo.module) | 开屏、信息流广告与推广清理 |
| 喜马拉雅 | [Ximalaya.module](https://raw.githubusercontent.com/YuXilong/surge-modules/main/Ximalaya.module) | 去广告与实验性免费听时长改写 |
| 历史价格 | [HistoryPrice.module](https://raw.githubusercontent.com/YuXilong/surge-modules/main/HistoryPrice.module) | 京东商品页比价 |

- 通用去广告已移除喜马拉雅规则和微博普通版响应脚本；这两款 App 请启用对应独立模块。
- 喜马拉雅保留激励广告接口，将三个时长接口成功响应的 `balance` 提高到至少 86400 秒；不增加服务端额度、不保证付费音频授权。
- 历史价格仅覆盖京东，向 `browser.bijiago.com` 发送商品链接查询价格；无外部脚本更新检查。
- 新增模块尚未真机验证，彩云会员字段改写不保证服务端会员能力。提交并推送到 `main` 后，远程安装地址才能加载新增文件。

## Shadowrocket 更新与排错

喜马拉雅模块将 `adse.ximalaya.com` 设为直连，以免基础配置的整域广告拦截阻断时长和奖励接口。若其他模块仍命中该域名的 `REJECT`，需调整模块优先级或移除冲突规则。全局路由使用「配置」。

更新喜马拉雅模块后，重新连接并退出、重开 App，再进入免费听页面刷新时长。脚本日志出现「已匹配」表示接口触发，出现「本地 balance」才表示余额已改写；仅看到页面剩余分钟数不足以判断生效。

更新模块后重新连接，并彻底退出再打开京东、彩云天气。当前配置需要开启 HTTPS 解密，且证书已安装并完全信任。

在「数据 → 代理」开启日志，复现后检查 `api.m.jd.com`、`cyapi.cn`、`caiyunapp.com` 的记录是否标记 `MITM`。
京东比价服务若要求验证，商品页会显示原因；该状态下无法获取历史价格。彩云模块改写本地会员展示，不保证服务器授权功能。

## Spotify 安装

在 Surge → 模块 → 从 URL 安装中填入：

```text
https://raw.githubusercontent.com/YuXilong/surge-modules/main/Spotify.module
```

启用模块，并安装、信任 Surge MITM 证书。macOS 还需开启 **增强模式（Enhanced Mode）**。

Spotify 脚本保存在本仓库，通过 jsDelivr 加载。若无法访问，可将模块中的
`fastly.jsdelivr.net/gh/YuXilong/surge-modules@main` 替换为
`raw.githubusercontent.com/YuXilong/surge-modules/main`。

## macOS 首次使用

桌面端可能缓存旧的账户状态。在本仓库目录执行：

```bash
./scripts/reset-spotify-mac-state.sh --dry-run  # 预览
./scripts/reset-spotify-mac-state.sh            # 确认后退出 Spotify 并清理缓存
```

脚本会尝试将 `offline.bnk`、`ad-state-storage.bnk`、`public.ldb` 备份至
`~/Library/Application Support/Spotify/.surge-module-backup/<时间戳>/` 后删除，并清空 HTTP 缓存。
**当前脚本未强制检查备份成功，重要数据请先自行备份；HTTP 缓存不备份。**
`offline.bnk` 包含离线歌曲索引，清理后需要重新同步离线内容。

重新打开 Spotify，若仍显示免费版，退出登录后重新登录。macOS 可检查 Surge 脚本日志是否出现
`customize`；移动端还可能出现 `bootstrap`。未生效时依次检查增强模式、MITM 证书、缓存和登录状态。

## 功能与限制

- 改写 UCS 账户属性，部分解锁 Premium，并拦截部分 Spotify 广告与归因域名。
- 原 README 记录了 macOS Spotify **1.3.1.234** 的账户属性改写结果（`type=premium`、`ads=0`）；实际播放不再插播广告尚未验证，也不代表后续版本均有效。
- 不保证超高音质、离线下载等服务端能力；接口变化或证书固定可能导致模块失效。
- 第三方广告网络与遥测拦截默认关闭，可在模块中按需启用。

## 文件与维护

| 文件 | 用途 |
| --- | --- |
| [Spotify.module](Spotify.module) | 模块配置及 macOS 适配说明 |
| [js/](js/) | 模块配套脚本（含 js/vendor/） |
| [js/NOTICE.md](js/NOTICE.md) | 脚本来源、版本、校验值与更新说明 |
| [scripts/reset-spotify-mac-state.sh](scripts/reset-spotify-mac-state.sh) | macOS 状态缓存清理 |
| [scripts/update-upstream-scripts.sh](scripts/update-upstream-scripts.sh) | 上游脚本对比与更新 |

```bash
./scripts/update-upstream-scripts.sh          # 仅拉取并对比
./scripts/update-upstream-scripts.sh --write  # 复核后更新本地脚本
```

更新后同步维护 `js/NOTICE.md` 中的版本与校验值。

## 来源与许可

本仓库配置及自有脚本采用 [MIT](LICENSE) 许可。Spotify 脚本来自
[app2smile/rules](https://github.com/app2smile/rules)，保留其 [MIT 版权声明](js/LICENSE-app2smile.md)；
其他脚本保留各自文件内的版权声明。

仅供网络调试与个人学习使用，请遵守相关服务条款及法律法规。
