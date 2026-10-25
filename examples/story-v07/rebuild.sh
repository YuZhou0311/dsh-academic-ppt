#!/usr/bin/env bash
set -euo pipefail
task_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$task_dir/../.." && pwd)"
export TMPDIR="$repo_dir/.test-output/tmp"
export PYTHONDONTWRITEBYTECODE=1
mkdir -p "$TMPDIR"
export DSH_INPUT_DIR="${DSH_INPUT_DIR:-$task_dir/sources}"
python3 "$task_dir/analysis-independent/independent_fatigue_analysis.py" --input-dir "$DSH_INPUT_DIR"
node "$task_dir/rebuild.mjs" "${1:-all}" "${2:-$task_dir/report}"
