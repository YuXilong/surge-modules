# Surge Modules

Surge 模块与配套脚本，目前提供 Spotify 模块，适用于 iOS / iPadOS / macOS。

## 安装

在 Surge → 模块 → 从 URL 安装中填入：

```text
https://raw.githubusercontent.com/YuXilong/surge-modules/main/Spotify.module
```

启用模块，并安装、信任 Surge MITM 证书。macOS 还需开启 **增强模式（Enhanced Mode）**。

脚本保存在本仓库，通过 jsDelivr 加载。若无法访问，可将模块中的
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
| [js/](js/) | 本地保存的上游 Spotify 脚本 |
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
原模块来自 [yfamilys](https://yfamilys.com/module/spotifyVIP.module)。

仅供网络调试与个人学习使用，请遵守相关服务条款及法律法规。
