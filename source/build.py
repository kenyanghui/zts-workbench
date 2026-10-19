#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compose the standalone 中通服项目评审工作台 HTML."""
import json
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEMO = ROOT / "ai-review-demo" / "00-本批总览"
BASE = HERE / "base.css"
OUT_NAMED = DEMO / "中通服项目评审工作台.html"
OUT_LEGACY = DEMO / "预审看板.html"
BACKUP = DEMO / "预审看板-电力工程版-备份.html"

style = BASE.read_text(encoding="utf-8")
extra = (HERE / "style-extra.css").read_text(encoding="utf-8")
shell = (HERE / "shell.html").read_text(encoding="utf-8")
data = json.loads((HERE / "data.json").read_text(encoding="utf-8"))
payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
app = (HERE / "app.js").read_text(encoding="utf-8")
if "__DATA__" not in app:
    raise SystemExit("app.js missing __DATA__")
app = app.replace("__DATA__", payload)
if "__DATA__" in app:
    raise SystemExit("__DATA__ still present")
if "</script" in payload.lower():
    raise SystemExit("data contains </script")

html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>中通服项目评审工作台 · 财政评审</title>
<style>
{style}
{extra}
</style>
</head>
<body>
{shell}
<script>
{app}
</script>
</body>
</html>
"""

if not BACKUP.exists():
    shutil.copy2(OUT_LEGACY, BACKUP)
    print("backup:", BACKUP.name)

OUT_NAMED.write_text(html, encoding="utf-8")
OUT_LEGACY.write_text(html, encoding="utf-8")
print("wrote:", OUT_NAMED.name, len(html.encode("utf-8")), "bytes")
print("wrote:", OUT_LEGACY.name, len(html.encode("utf-8")), "bytes")
print("data:", len(payload), "chars; app:", len(app), "chars")
