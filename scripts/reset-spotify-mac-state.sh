#!/usr/bin/env bash
#
# reset-spotify-mac-state.sh
#
# 用途：让 Surge 的 Spotify 模块在 macOS 桌面端立即生效。
#
# 背景：Spotify for macOS 会把「产品状态」(product state) 持久化在
#   ~/Library/Application Support/Spotify/PersistentCache/offline.bnk
# 里。该缓存中保存的是登录时的旧值，例如：
#   <ads>1</ads> <catalogue>free</catalogue> <type>free</type>
#   <player-license>on-demand</player-license> <high-bitrate>0</high-bitrate>
# 只要这个缓存还在，Surge 改写过的 UCS 响应就不会被重新应用。
# 本脚本退出 Spotify 并备份/清理这些缓存，使客户端下次启动时重新拉取 UCS。
#
# 用法：
#   ./reset-spotify-mac-state.sh            # 交互确认后执行
#   ./reset-spotify-mac-state.sh -y         # 跳过确认
#   ./reset-spotify-mac-state.sh --dry-run  # 只显示将要做什么
#
# 所有被删除的文件都会先备份到：
#   ~/Library/Application Support/Spotify/.surge-module-backup/<时间戳>/
# 需要回滚时，把备份目录里的文件拷回 PersistentCache/ 即可。
#
set -euo pipefail

SPOTIFY_SUPPORT="${HOME}/Library/Application Support/Spotify"
CACHE_DIR="${SPOTIFY_SUPPORT}/PersistentCache"
HTTP_CACHE="${HOME}/Library/Caches/com.spotify.client"
BACKUP_ROOT="${SPOTIFY_SUPPORT}/.surge-module-backup"

# 需要清理的持久化状态文件（存在才处理）
TARGETS=(
  "offline.bnk"          # 产品状态 / 离线同步库（关键）
  "ad-state-storage.bnk" # 广告状态缓存
  "public.ldb"           # LevelDB 缓存
)

ASSUME_YES=0
DRY_RUN=0

usage() {
  sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    -y|--yes)   ASSUME_YES=1 ;;
    --dry-run)  DRY_RUN=1 ;;
    -h|--help)  usage ;;
    *) echo "未知参数: $arg（用 -h 查看用法）" >&2; exit 2 ;;
  esac
done

log()     { printf '  %s\n' "$*"; }
section() { printf '\n== %s\n' "$*"; }

if [ ! -d "$SPOTIFY_SUPPORT" ]; then
  echo "未找到 Spotify 数据目录：$SPOTIFY_SUPPORT" >&2
  echo "请先启动一次 Spotify for macOS。" >&2
  exit 1
fi

printf '\nSpotify for macOS 状态重置\n'
log "数据目录 : $SPOTIFY_SUPPORT"
log "缓存目录 : $CACHE_DIR"
[ "$DRY_RUN" -eq 1 ] && log "模式     : DRY-RUN（不会修改任何文件）"

if [ "$DRY_RUN" -eq 0 ] && [ "$ASSUME_YES" -eq 0 ]; then
  printf '\n将退出 Spotify 并清理其缓存（删除前会先备份）。继续？[y/N] '
  read -r reply || reply=""
  case "$reply" in
    [yY]|[yY][eE][sS]) ;;
    *) printf '已取消，未做任何修改。\n'; exit 0 ;;
  esac
fi

section "1/4 退出 Spotify"
if [ "$DRY_RUN" -eq 1 ]; then
  log "将会退出 Spotify（osascript quit）"
else
  if osascript -e 'quit app "Spotify"' >/dev/null 2>&1; then
    log "已发送退出指令"
  else
    log "Spotify 未在运行，或无法通过 osascript 退出"
  fi
  # 给客户端一点时间刷盘并释放 LevelDB 锁
  sleep 3
  # 兜底：仍在运行则强制结束（忽略失败）
  if pgrep -x "Spotify" >/dev/null 2>&1; then
    log "Spotify 仍在运行，强制结束"
    pkill -x "Spotify" 2>/dev/null || true
    sleep 2
  fi
fi

section "2/4 备份并清理持久化状态"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/${STAMP}"
FOUND=0
for name in "${TARGETS[@]}"; do
  src="${CACHE_DIR}/${name}"
  if [ ! -e "$src" ]; then
    log "跳过（不存在）: ${name}"
    continue
  fi
  FOUND=1
  if [ "$DRY_RUN" -eq 1 ]; then
    log "将会备份并删除: ${name}"
    continue
  fi
  mkdir -p "$BACKUP_DIR"
  cp -R "$src" "${BACKUP_DIR}/" 2>/dev/null || true
  rm -rf "$src"
  log "已清理: ${name}"
done

if [ "$FOUND" -eq 0 ]; then
  log "没有找到可清理的状态文件（可能已被清理过）"
fi

section "3/4 清理 HTTP 缓存"
if [ -d "$HTTP_CACHE" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    log "将会清空: $HTTP_CACHE"
  else
    rm -rf "${HTTP_CACHE:?}"/* 2>/dev/null || true
    log "已清空: $HTTP_CACHE"
  fi
else
  log "跳过（不存在）: $HTTP_CACHE"
fi

section "4/4 完成"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "  DRY-RUN 结束，未做任何修改。去掉 --dry-run 即可真正执行。"
  exit 0
fi
if [ -d "$BACKUP_DIR" ]; then
  echo "  备份位置: $BACKUP_DIR"
  echo "  回滚方式: cp -R \"$BACKUP_DIR\"/* \"$CACHE_DIR\"/"
fi
cat <<'EOF'

  接下来：
    1. 确认 Surge 已开启「增强模式(Enhanced Mode)」并已安装 Spotify 模块；
    2. 重新打开 Spotify。若仍显示免费版，请在客户端内「退出登录」后重新登录；
    3. 登录后播放一首歌，Surge 的脚本日志里应出现 bootstrap / customize 字样。

  说明：offline.bnk 同时保存离线歌曲索引，清理后客户端会重新同步离线内容。
EOF
