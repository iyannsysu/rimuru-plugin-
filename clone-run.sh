#!/usr/bin/env bash
# Supervisor untuk clone-runner (proses terpisah dari bot utama).
# Clone tetap hidup walau bot utama restart/update.
set -u
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCK="$BASE_DIR/clone-runner.lock"
LOG="$BASE_DIR/clone-runner.log"
PIDFILE="$BASE_DIR/clone-runner.pid"

echo $$ > "$PIDFILE"

# Single instance via flock
exec 9>"$LOCK"
if ! flock -n 9; then
	echo "clone-runner supervisor sudah jalan"
	exit 0
fi

CHILD=""
cleanup() { [ -n "$CHILD" ] && kill "$CHILD" 2>/dev/null; exit 0; }
trap cleanup TERM INT

while true; do
	echo "[$(date '+%F %T')] starting clone-runner..." >> "$LOG"
	cd "$BASE_DIR" && node src/clone-runner.js >> "$LOG" 2>&1 &
	CHILD=$!
	wait $CHILD
	EC=$?
	echo "[$(date '+%F %T')] clone-runner exit $EC, restart dalam 5 detik..." >> "$LOG"
	CHILD=""
	sleep 5
done
