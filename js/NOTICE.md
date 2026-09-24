# 第三方脚本来源说明

`spotify-json.js` 与 `spotify-proto.js` **不是本仓库原创**，是从上游复制（vendor）进来的，
目的是避免上游删库或改名后模块失效。版权归原作者所有，遵循 MIT 许可，见 [LICENSE-app2smile.md](LICENSE-app2smile.md)。

## 来源

| 项目 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/app2smile/rules |
| 上游路径 | `js/spotify-json.js`、`js/spotify-proto.js` |
| 上游许可 | MIT License, Copyright (c) 2023 app2smile |

## 当前锁定的版本

| 文件 | 上游 commit | commit 日期 | 脚本内版本标记 | sha256 |
| --- | --- | --- | --- | --- |
| `spotify-json.js` | `5fa39a5fbc670e13878b774d8436f6e559850d04` | 2025-06-20 | `spotify-json-2025.06.20` | `41cf1074770cdef3948baa12ff4a8db9045d1cac888714c8b7e69909eb531bc9` |
| `spotify-proto.js` | `e2c6f341eff294ce863658b95a490143183314b9` | 2026-02-25 | `2026-02-25` | `2e6850e888d092905c766f0bbedc4b4afb9a712330970cc1265105d7fb4995d0` |

## 复制时的供应链检查

复制前对两个文件做了静态检查，结论：**只做数据改写，不发起任何网络请求。**

- 无任何 `http(s)://` 外链字面量
- 入口点仅 `$request` / `$response` / `$done` / `$task`（QuantumultX 探测）/ `$notification`
- `spotify-proto.js` 中出现的 `fetch(`、`XMLHttpRequest`、`eval("require")`、`Function(`
  全部位于内嵌的 **protobuf.js 库内部**（`util.fetch` / `util.xhr` / `inquire` / codegen），
  仅在调用 `Root.load()` 远程加载 `.proto` 文件时可达。本脚本只走 `Root.fromJSON()`，
  因此这些属于不可达路径。

复核命令：

```bash
grep -o -E 'https?://[a-zA-Z0-9._:/-]+' js/spotify-proto.js | sort -u    # 期望为空
grep -o -E '\$(request|response|done|notification|task)' js/spotify-proto.js | sort | uniq -c
shasum -a 256 js/*.js
```

## 如何更新

```bash
./scripts/update-upstream-scripts.sh          # 只拉取并对比，不写入
./scripts/update-upstream-scripts.sh --write  # 确认无差异或已复核后写入
```

更新后请同步修改上面「当前锁定的版本」表格里的 commit / 日期 / sha256。

> 注意：本仓库只是搬运，不对上游脚本的正确性负责。上游变更可能导致解锁行为改变，
> 更新前建议先看 `git diff` 与上游 commit message。
