#!/usr/bin/env bash
#
# update-upstream-scripts.sh
#
# 用途：把 js/ 下 vendor 的 Spotify 脚本与上游 app2smile/rules 对比、按需更新。
#
# 本仓库已把上游脚本复制进 js/，运行时不再依赖上游，上游删库也不影响。
# 这个脚本只用于「主动跟进上游更新」，平时不需要跑。
#
# 用法：
#   ./scripts/update-upstream-scripts.sh           # 只对比，不写入（默认）
#   ./scripts/update-upstream-scripts.sh --write   # 确认后写入 js/
#
# 写入后请同步更新 js/NOTICE.md 里的 commit / 日期 / sha256 表格。
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JS_DIR="${REPO_ROOT}/js"
UPSTREAM_REPO="app2smile/rules"
UPSTREAM_BRANCH="master"

# 依次尝试，命中第一个可用的
MIRRORS=(
  "https://raw.githubusercontent.com/${UPSTREAM_REPO}/${UPSTREAM_BRANCH}"
  "https://fastly.jsdelivr.net/gh/${UPSTREAM_REPO}@${UPSTREAM_BRANCH}"
)
FILES=(spotify-json.js spotify-proto.js)

WRITE=0
for arg in "$@"; do
  case "$arg" in
    --write)   WRITE=1 ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "未知参数: $arg（用 -h 查看用法）" >&2; exit 2 ;;
  esac
done

log()     { printf '  %s\n' "$*"; }
section() { printf '\n== %s\n' "$*"; }

sha() { shasum -a 256 "$1" | cut -d' ' -f1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[ "$WRITE" -eq 0 ] && printf '\n模式：只对比（加 --write 才会写入）\n'

section "1/3 拉取上游脚本"
CHANGED=0
for f in "${FILES[@]}"; do
  ok=0
  for m in "${MIRRORS[@]}"; do
    if curl -fsSL --max-time 40 "${m}/js/${f}" -o "${TMP}/${f}" 2>/dev/null; then
      # 基本健全性检查，避免把错误页当成脚本
      if [ -s "${TMP}/${f}" ] && head -c 200 "${TMP}/${f}" | grep -q . ; then
        log "已获取 ${f}  ← $(echo "$m" | sed -E 's#https://([^/]+).*#\1#')"
        ok=1
        break
      fi
    fi
  done
  if [ "$ok" -eq 0 ]; then
    echo "  !! 无法从任何镜像获取 ${f}" >&2
    exit 1
  fi
done

section "2/3 对比"
for f in "${FILES[@]}"; do
  local_new="$(sha "${TMP}/${f}")"
  if [ -f "${JS_DIR}/${f}" ]; then
    local_cur="$(sha "${JS_DIR}/${f}")"
  else
    local_cur="(缺失)"
  fi
  printf '  %-18s 本地 %s\n' "$f" "${local_cur:0:16}"
  printf '  %-18s 上游 %s\n' "" "${local_new:0:16}"
  if [ "$local_cur" = "$local_new" ]; then
    printf '  %-18s => 已是最新\n' ""
  else
    printf '  %-18s => 有差异\n' ""
    CHANGED=1
    # 显示脚本自带的版本标记，便于判断上游改了什么
    v=$(grep -o -m1 -E 'console\.log\(`[^`]*`\)' "${TMP}/${f}" 2>/dev/null || true)
    [ -n "$v" ] && printf '  %-18s 上游版本标记: %s\n' "" "$v"
  fi
  echo
done

if [ "$CHANGED" -eq 0 ]; then
  printf '  结果：全部一致，无需更新。\n'
  exit 0
fi

if [ "$WRITE" -eq 0 ]; then
  cat <<'EOF'
  结果：存在差异，但未写入。
  建议先人工复核上游改动（上游可能调整解锁逻辑）：
      git -C /tmp clone --depth 1 https://github.com/app2smile/rules 后自行 diff
  确认无误后执行：
      ./scripts/update-upstream-scripts.sh --write
EOF
  exit 0
fi

section "3/3 写入"
for f in "${FILES[@]}"; do
  if [ "$(sha "${TMP}/${f}")" != "$(sha "${JS_DIR}/${f}" 2>/dev/null || echo none)" ]; then
    cp "${TMP}/${f}" "${JS_DIR}/${f}"
    log "已更新 ${f}  →  ${f} sha256=$(sha "${JS_DIR}/${f}")"
  else
    log "未变化 ${f}"
  fi
done

if command -v gh >/dev/null 2>&1; then
  echo
  echo "  上游最新 commit："
  for f in "${FILES[@]}"; do
    s=$(gh api "repos/${UPSTREAM_REPO}/commits?path=js/${f}&per_page=1" --jq '.[0].sha' 2>/dev/null || echo '?')
    printf '    %-18s %s\n' "$f" "$s"
  done
fi

cat <<'EOF'

  下一步（务必）：
    1. 更新 js/NOTICE.md 里「当前锁定的版本」表格的 commit / 日期 / sha256
    2. git add -A && git commit && git push
    3. 等待 jsDelivr 缓存刷新（@main 最长约 12 小时），或到
       https://www.jsdelivr.com/tools/purge 手动刷新
EOF
