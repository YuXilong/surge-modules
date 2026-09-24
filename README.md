# Surge Spotify 模块（支持 macOS 桌面端去广告）

针对 [yfamilys.com/module/spotifyVIP.module](https://yfamilys.com/module/spotifyVIP.module)（源自 [app2smile/rules](https://github.com/app2smile/rules)）的完善版本，重点是**让同一份模块在 macOS 桌面端也能真正去广告**。

## 文件

| 文件 | 说明 |
| --- | --- |
| `Spotify.module` | 完善后的 Surge 模块，iOS / iPadOS / macOS 通用 |
| `js/spotify-proto.js`<br>`js/spotify-json.js` | **已 vendor 的上游脚本**，运行时从本仓库加载，不再依赖上游 |
| `js/NOTICE.md` | 脚本来源、锁定的上游 commit、sha256 与供应链检查记录 |
| `scripts/reset-spotify-mac-state.sh` | macOS 一键清理 Spotify 产品状态缓存（模块生效的前提） |
| `scripts/update-upstream-scripts.sh` | 主动跟进上游脚本更新（平时不用跑） |

### 为什么不直接引用上游

原先 `script-path` 指向 `raw.githubusercontent.com/app2smile/rules/...`，一旦上游删库、改名或改分支，
模块就会静默失效。现在两个脚本已复制进 `js/`，模块指向本仓库，**上游删库也不影响使用**。

上游是 MIT 许可（Copyright (c) 2023 app2smile），复制时已保留版权声明，详见 [js/NOTICE.md](js/NOTICE.md)。

## 原模块做了什么

原模块只有三条核心配置：

- `[Header Rewrite]`：删掉 `user-customization-service/v1/customize` 请求的 `if-none-match`
- `[Script]`：改写 `bootstrap/v1/bootstrap` 与 `user-customization-service/v1/customize` 的 **protobuf 响应**，把账户属性改成 premium
- `[Script]`：把 `artistview` / `album-entity-view` 请求里的 `platform=iphone` 换成 `platform=ipad`

它的名字写的是 `Spotify(iOS15)`，`#!desc` 也完全是 iOS 语境，没有 macOS 相关配置。

## macOS 实测发现

在本机 **Spotify for macOS 1.3.1.234 (g59d6bf59)** 上，我把 `Spotify.app` 的主二进制和 `Contents/Resources/Apps/xpui.spa` 解包做了静态分析，结论如下。

**1) macOS 与 iOS 共用同一个 UCS 接口 —— 这是能支持 Mac 的基础**

```
$ strings Spotify.app/Contents/MacOS/Spotify | grep user-customization
https://spclient.wg.spotify.com/user-customization-service/v1/customize
```

桌面端二进制里同时存在 `spotify.remote_config.ucs.proto.UcsResponseWrapper`，与 iOS 是**同一套下发结构**。所以原模块里 `customize` 那一支改写逻辑对桌面端直接生效，不需要另写脚本。

**2) macOS 不调用 `bootstrap/v1/bootstrap`**

主二进制里搜 `bootstrap` 只有 `agent_bootstrap`、`bootstrap_completed`、`product state injection not supported during a non mandatory bootstrap` 这类内部状态字串，**没有 `bootstrap/v1/bootstrap` 这个路由**。也就是说原模块第二条 script pattern 里的 `bootstrap` 分支是纯 iOS 的，在 Mac 上不会命中（无害）。

**3) 桌面端消费的属性名与 iOS 一致**

桌面端会把产品状态持久化成一段 XML，缓存在
`~/Library/Application Support/Spotify/PersistentCache/offline.bnk`，实际抓到的内容（免费账号）是：

```xml
<type>free</type>
<catalogue>free</catalogue>
<player-license>on-demand</player-license>
<ads>1</ads>
<high-bitrate>0</high-bitrate>
<name>Spotify Free</name>
<financial-product>pr:free,tc:0</financial-product>
<smart-shuffle>UNAVAILABLE</smart-shuffle>
<mixing-tools>VIEW</mixing-tools>
```

而 `spotify-proto.js` 的 `processMapObj()` 恰好把 `type` / `catalogue` / `player-license` / `ads` / `high-bitrate` / `name` / `financial-product` / `smart-shuffle` / `mixing-tools` / `unrestricted` 全部改写为 premium 值，并且设置了关键的开关：

```
com.spotify.madprops.use.ucs.product.state = true
com.spotify.madprops.delivered.by.ucs     = true
```

这两个属性决定客户端是否采用 UCS 下发的产品状态。所以属性集是**覆盖到位的**，不需要为 Mac 补字段。

**4) 关键限制：桌面端广告服务器地址是动态下发的，无法按 URL 拦截**

桌面端二进制里有完整的广告 SDK proto 定义和动态配置逻辑：

```
spotify.ads.esperanto.proto.GetAdsRequest / GetAdsResponse
spotify.ads.esperanto.proto.UpdateAdServerEndpointRequest   # slot_ids + url
core-ad-config-requester / unified-ad-config-requester
VND.Spotify.Ads-Payload                                     # 广告响应 MIME
ad-state-storage.bnk                                        # 广告状态落盘
```

注意 `UpdateAdServerEndpointRequest` —— 广告服务器 URL 是**运行时按 slot 下发的**。整个二进制里既没有 `ad-formation` 也没有硬编码的广告域名列表。这意味着：

> 桌面端**不能**用「拦截固定广告 URL」的思路去广告，必须靠 UCS 解锁让客户端根本不进入广告流程。

这一点也解释了为什么很多只做域名黑名单的 Mac 去广告方案不稳定。

**5) 桌面端专有的广告面**

解包 `xpui.spa` 后额外发现桌面端独有的赞助推荐内嵌页（**这是本模块里唯一有本地实证的广告端点**）：

```
https://sponsored-recommendations.spotify.com/desktop   # iframe，播放列表页的"赞助推荐"
```

另外两个广告/归因域名 `adeventtracker.spotify.com`、`ads-fa.spotify.com` 来自社区广告黑名单，属于 legacy 端点：在 1.3.1.234 的二进制中**并未出现**，保留它们只是为了兜底旧版本，不作为有效性的依据。

> 注：用 `dig` 无法验证这几个域名是否真实存在——Surge 的 fake-IP 会对所有域名（包括确定存在的 `spclient.wg.spotify.com`）统一返回 `198.18.x.x`，因此该测试无区分力。

## 相比原模块的改动

1. **MITM 与说明补齐 macOS 语义**：明确标注哪些分支在 Mac 上生效、哪些是 iOS 专属。
2. **新增桌面端广告面拦截**（精确匹配不误伤 CDN）：
   `sponsored-recommendations.spotify.com`（有实证），外加 `adeventtracker.spotify.com`、`ads-fa.spotify.com` 作为 legacy 兜底。
3. **第三方广告网络与遥测按需开关**：默认注释掉，避免一个 Spotify 模块悄悄改掉全局网络行为。
4. **补充生效前提**：给出 `scripts/reset-spotify-mac-state.sh`，解决「模块装了但 Mac 上没效果」这个最常见的坑（见下）。
5. **修正描述**：模块名与 desc 反映真实的平台覆盖范围。

6. **脚本 vendor 进本仓库**：`script-path` 改为指向本仓库的 `js/`，运行时不再依赖上游，上游删库也不会失效；同时走 jsDelivr，兼顾国内可达性。来源、锁定的 commit 与 sha256 记录在 [js/NOTICE.md](js/NOTICE.md)。

> 我**没有**去改动 `spotify-proto.js` 的改写逻辑，因为实测属性集已覆盖桌面端所需字段，而重写一份 71KB 的 protobuf 脚本只会引入维护负担。脚本保持上游原样，只是从「运行时拉取」改为「复制进仓库 + 可主动同步」。

## 安装

Surge → 首页 → 模块 → 从 URL 安装：

```
https://raw.githubusercontent.com/YuXilong/surge-modules/main/Spotify.module
```

> 模块里的两个 `script-path` 指向本仓库：`https://fastly.jsdelivr.net/gh/YuXilong/surge-modules@main/js/...`
> 若 jsDelivr 不可达，把 `fastly.jsdelivr.net/gh/YuXilong/surge-modules@main` 换成
> `raw.githubusercontent.com/YuXilong/surge-modules/main` 即可（内容相同）。
> 可自行验证：`curl -sI <script-path>` 应返回 `200`。

## macOS 生效步骤（重要）

macOS 客户端把产品状态**落盘缓存**了。只装模块不改缓存的话，客户端会一直用旧的 `free` 状态，表现为「模块装了但没用」。正确顺序：

1. Surge 打开 **增强模式（Enhanced Mode）** —— 桌面端有自己的网络栈，仅靠系统代理不一定能覆盖。
2. 安装并启用 `Spotify.module`，确认 MITM 证书已信任。
3. 完全退出 Spotify，执行清理：

   ```bash
   ./scripts/reset-spotify-mac-state.sh
   ```

   脚本会先把 `offline.bnk` / `ad-state-storage.bnk` / `public.ldb` 备份到
   `~/Library/Application Support/Spotify/.surge-module-backup/<时间戳>/` 再删除，并清空 HTTP 缓存。

   先看它会做什么可以加 `--dry-run`。

4. 重新打开 Spotify。若界面仍显示免费版，在客户端内**退出登录后重新登录**（UCS 在会话建立时拉取）。
5. 播放一首歌，在 Surge 的脚本日志里应能看到 `bootstrap` / `customize` 字样。

## 验证是否生效

缓存文件是「`<key长度><key> \x09 <value长度><value>`」的二进制键值对。注意：**XML 形式只在未改写的旧缓存里出现**，改写成功后变成键值对，所以用 grep `<type>premium</type>` 反而会误判成"没生效"。

下面这段按 key 长度精确锚定，避免 `type` 命中 `assured-age-method-type`、`offline` 命中 `key-caching-auto-offline` 这类子串：

```bash
python3 - <<'PY'
import os
d = open(os.path.expanduser(
    "~/Library/Application Support/Spotify/PersistentCache/offline.bnk"), "rb").read()
for k in ("type", "catalogue", "player-license", "ads", "name", "financial-product"):
    kb = k.encode()
    m = d.find(bytes([len(kb)]) + kb + b"\x09")
    if m < 0:
        print(f"{k:18s} = 未找到"); continue
    p = m + len(kb) + 2
    print(f"{k:18s} = " + repr(d[p+1:p+1+d[p]].decode("utf-8", "replace")))
PY
```

### 实测结果（Spotify for macOS 1.3.1.234）

启用模块 → 清理缓存 → 重启客户端后，同一份 `offline.bnk` 的前后变化：

| 属性 | 改写前（免费） | 改写后 |
| --- | --- | --- |
| `type` | `free` | **`premium`** |
| `catalogue` | `free` | **`premium`** |
| `player-license` | `on-demand` | **`premium`** |
| `ads` | `1` | **`0`** |
| `name` | `Spotify Free` | **`Spotify Premium`** |
| `financial-product` | `pr:free,tc:0` | **`pr:premium,tc:0`** |
| `high-bitrate` | `0` | `1` |
| `smart-shuffle` | `UNAVAILABLE` | `AVAILABLE` |
| `mixing-tools` | `VIEW` | `EDIT` |

`product-expiry` / `subscription-enddate` 会被写成当前时间 **+1 个月**（实测 `2026-10-24T07:25:46Z`）。这是 `spotify-proto.js` 中 `expireDate.setMonth(+1)` 的独有指纹，可用来确认改写确实由该脚本完成，而非服务端本地下发。

网络链路同期确认：

- `spclient.wg.spotify.com` 的 MITM 证书签发者为 `Surge Generated CA`（即模块的 `%APPEND%` 已生效）
- Spotify 主进程有十余条到 `127.0.0.1:6152` 的 `ESTABLISHED` 连接，流量确实全程经过 Surge

仍是 `free` 时，按顺序排查：Surge 增强模式 → MITM 证书信任 → 是否已完全退出客户端并清理缓存 → 是否重新登录。

## 已知局限

- 属于**部分解锁**：音质不能设为「超高」，离线下载等能力不保证，这是上游脚本的既有边界。
- 桌面端广告走 CEF + 原生核心两套网络栈，若 Spotify 后续对 UCS 域名启用证书固定（certificate pinning），MITM 会失效——那是这套方案的共同天花板，不是本模块能绕过的。
- `reset-spotify-mac-state.sh` 会删除 `offline.bnk`，其中也包含离线歌曲索引，清理后客户端需要重新同步离线内容。
- **已验证**：macOS 客户端确实应用了改写后的账户属性（上表前后对比），网络链路（MITM + 代理连接）也已确认。
- **未验证**：实际听感层面的"不再播放广告"。账户状态已变为 premium 且 `ads=0`，按 Spotify 的判定逻辑应当不再插播广告，但这一点无法通过静态检查证实，需要实际听一首歌确认。

## 许可与署名

本仓库自身的配置与脚本以 [MIT](LICENSE) 发布。

`js/` 下的两个 JS 脚本**版权不属于本仓库**，是从上游复制进来的（vendor），遵循其 MIT 许可并保留版权声明：

- [app2smile/rules](https://github.com/app2smile/rules) — MIT License, Copyright (c) 2023 app2smile
  完整声明见 [js/LICENSE-app2smile.md](js/LICENSE-app2smile.md)，来源与版本见 [js/NOTICE.md](js/NOTICE.md)
- 模块原始版本来自 [yfamilys.com/module/spotifyVIP.module](https://yfamilys.com/module/spotifyVIP.module)

本仓库仅做 macOS 适配补强（广告面拦截、生效流程、文档与复位脚本）与脚本 vendor，并已在上文逐条标注哪些结论来自本地实证、哪些来自社区黑名单。

## 免责声明

仅供网络调试与个人学习使用。请遵守 Spotify 服务条款以及你所在地区的法律法规，由此产生的一切后果由使用者自行承担。

