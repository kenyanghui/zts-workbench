#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""构建单文件演示页：中通服项目评审工作台（财政评审）。

执行顺序（P-22）：python3 build_data.py（生成 data.json）→ python3 build.py（组装 + 校验）。
验证门链：build.py（数据契约 + 产物完整性，本脚本）→ python3 verify_data.py（数值对账与
data.json ↔ build_data.py 同步）→ node smoke_check.mjs（构建产物交互冒烟）。

用法：
  python3 build.py             # 构建：校验 → 组装 → 幂等写产物 → 完整性自检
  python3 build.py --check     # 只校验：全部门禁 + 既有产物与源逐字节比对；不写任何文件
  python3 build.py --out DIR   # 覆盖默认输出目录（默认 ../ai-review-demo/00-本批总览）
退出码：0 = 全部通过；1 = 任一门禁 FAIL；2 = 命令行用法错误。

幂等复跑：源与产物一致时零写入（产物 mtime 不变，报告 unchanged）；内容变化时经
同目录临时文件 + os.replace 原子替换（保留原文件权限），任何时刻磁盘上都是完整产物。

备份语义（P-21）：不再生成「电力工程版备份」。仅当用不同内容覆盖既有产物时，先把旧
内容滚动保存为 <输出目录>/预审看板-上一版快照.html（两产物内容恒同，一份快照即可代表
两者）；首次构建（输出目录尚无产物）不产生备份，也不因缺产物而失败。
历史遗留的 预审看板-电力工程版-备份.html 内容已失真（实为 2026-10-19 新版内容，并非
历史电力工程版，sha256 a242cd12…），本脚本不再读写它；归档或删除由项目所有者决定。
"""

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEMO = ROOT / "ai-review-demo" / "00-本批总览"

OUT_NAMED_NAME = "中通服项目评审工作台.html"
OUT_LEGACY_NAME = "预审看板.html"
SNAPSHOT_NAME = "预审看板-上一版快照.html"

# 关键导航锚点契约（产物完整性自检）：与 shell.html 侧栏 8 个导航项一一对应；
# shell.html 导航变动时必须同步更新此处——构建失败即强制对该契约做有意识评审。
EXPECTED_NAV_GO = ("overview", "projects", "fp/A", "cost/B", "tech", "kb", "audit/A", "arch")
# 渲染挂载点：全部导航的目标容器
EXPECTED_MOUNTS = ('id="view"',)

# 尺寸阈值（三层）：绝对带为量级守卫（防产物膨胀失控）；自校准带为精度守卫，产物字节
# 数必须落在「各源片段字节数之和」与「之和 + 组装包装预算」之间，可同时捕获组装缺片段
# （低于下界）与片段被重复拼入（超出包装预算）；源量级下限补住单一源被截断/清空的盲区
# ——此时自校准带会随之「合法」缩小、其余源仍撑住绝对带，只有按源下限才能探到。
SIZE_ABS_MIN = 50_000
SIZE_ABS_MAX = 6_000_000  # 含内联 vendor(mammoth/xlsx/pdfjs+worker)约 2.9MB
WRAPPER_BUDGET = 4096
MIN_SOURCE_BYTES = {"base.css": 10_000, "style-extra.css": 2_000, "shell.html": 2_000, "app.js": 20_000, "data.json": 10_000}

# 数据契约（P-23 最小结构校验：只查字段存在性与类型，不做数值对账——数值口径与
# data.json ↔ build_data.py 同步归 verify_data.py）。列表按 app.js 实际解引用面圈定：
# 缺任一项都会在默认导航路径（总览/卷宗/审定表/知识库）或对应页签上拿到 undefined。
TOP_LISTS = ("projects", "categoryTotals", "clientTotals", "topReductions", "commonIssues", "actions")
TOP_DICTS = ("stats", "knowledge", "meta")
STATS_KEYS = ("submitted", "approved", "reduction", "rate", "projects", "highRisk", "kbHit")
META_KEYS = ("batch", "date")
PROJECT_LISTS = ("versions", "functions", "costItems", "techIssues", "materials")
PROJECT_STRS = ("id", "name", "statusLabel")
VERSION_KEYS = ("id", "label", "date", "total", "comments")
TECH_KEYS = ("id", "finding", "severity", "category", "status", "evidence")
COMMON_KEYS = ("title", "text")
ACTION_KEYS = ("time", "project", "stage", "action", "actor", "result")
BAR_KEYS = ("name", "approved", "submitted")
KB_ENTRY_KEYS = ("id", "title", "type", "source", "date", "tags")
KB_QA_KEYS = ("q", "a", "citations")
# fpSummary 关键字段：functions 非空（或已声明 fpSummary）的项目必备；五点法项目另有
# 折算链四项（app.js fivePointTable 的审定 FP → 系数 → 人天 → 折算投资解引用）。
FP_BASE_KEYS = ("items", "approvedItems", "submittedFP", "approvedFP", "firstFP", "overSplit", "reclass", "unit")
FP_FIVE_KEYS = ("coefficient", "adjustedFP", "unitPrice", "personDays")


def parse_args():
    parser = argparse.ArgumentParser(
        description="组装并校验单文件演示 HTML（默认构建；--check 只校验不写盘）",
        epilog="顺序：python3 build_data.py → python3 build.py [--check] [--out DIR]",
    )
    parser.add_argument("--check", action="store_true", help="只跑全部门禁并核对既有产物，不写任何文件")
    parser.add_argument("--out", metavar="DIR", help=f"输出目录（默认 {DEMO}）")
    return parser.parse_args()


def read_sources():
    """读取全部源：源量级下限（截断/清空守卫）→ 解码/解析显式报错 → 组装级硬门。"""
    errs = []
    raw = {}
    for name, floor in MIN_SOURCE_BYTES.items():
        blob = (HERE / name).read_bytes()
        raw[name] = blob
        if len(blob) < floor:
            errs.append(f"{name}: {len(blob)}B 低于源量级下限 {floor}B（疑似截断/清空）")
    try:
        style = raw["base.css"].decode("utf-8")
        extra = raw["style-extra.css"].decode("utf-8")
        shell = raw["shell.html"].decode("utf-8")
        app = raw["app.js"].decode("utf-8")
    except UnicodeDecodeError as exc:
        raise SystemExit(f"源文件不是有效 UTF-8：{exc}")
    try:
        data = json.loads(raw["data.json"].decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SystemExit(f"data.json 解析失败：{exc}")
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    if "__DATA__" not in app:
        raise SystemExit("app.js missing __DATA__")
    app = app.replace("__DATA__", payload)
    if "__DATA__" in app:
        raise SystemExit("__DATA__ still present")
    vendor_dir = HERE / "vendor"
    VENDOR_FILES = ["mammoth.browser.min.js", "xlsx.full.min.js", "pdf.min.js", "pdf.worker.min.js"]
    worker_text = (vendor_dir / "pdf.worker.min.js").read_text(encoding="utf-8")
    worker_holder = "window.__INTAKE_PDF_WORKER_SRC__ = " + json.dumps(worker_text) + ";"
    vendor_blocks = ""
    for _name in VENDOR_FILES:
        _code = (vendor_dir / _name).read_text(encoding="utf-8")
        if "</script" in _code.lower():
            raise SystemExit(f"vendor {_name} contains </script>")
        vendor_blocks += "<script>" + _code + "</script>\n"
    bootstrap = (
        "window.__INTAKE_BUNDLED = { mammoth: true, xlsx: true, pdfjs: true };\n"
        "window.__INTAKE_PDF_WORKER_URL = URL.createObjectURL(new Blob([window.__INTAKE_PDF_WORKER_SRC__], { type: 'application/javascript' }));"
    )
    if "</script" in payload.lower():
        raise SystemExit("data contains </script")
    return style, extra, shell, app, data, payload, errs, worker_holder, vendor_blocks, bootstrap


def compose(style, extra, shell, app, worker_holder, vendor_blocks, bootstrap):
    """组装最终 HTML——模板必须保持原样，产物字节级确定性依赖它。"""
    return f"""<!DOCTYPE html>
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
{worker_holder}
</script>
{vendor_blocks}
<script>
{bootstrap}
</script>
<script>
{app}
</script>
</body>
</html>
"""


def shell_anchor_errors(shell):
    """源级核对：契约里的导航锚点必须先在 shell.html 中存在，错误归因更直接。"""
    return [
        f'shell.html 缺失关键导航锚点 data-go="{go}"（契约清单见 build.py EXPECTED_NAV_GO）'
        for go in EXPECTED_NAV_GO
        if f'data-go="{go}"' not in shell
    ]


def entry_errors(errs, path, items, keys):
    """列表逐项做字段存在性检查（不查值，值对账归 verify_data.py）。"""
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            errs.append(f"{path}[{i}]: 应为对象，实际 {type(item).__name__}")
            continue
        for key in keys:
            if key not in item:
                errs.append(f"{path}[{i}].{key}: 缺失")


def project_errors(errs, index, project, seen_ids):
    path = f"data.projects[{index}]"
    if not isinstance(project, dict):
        errs.append(f"{path}: 应为对象，实际 {type(project).__name__}")
        return
    pid = project.get("id")
    if not isinstance(pid, str) or not pid:
        errs.append(f"{path}.id: 缺失或非非空字符串")
    elif pid in seen_ids:
        errs.append(f"{path}.id: 与其他项目重复「{pid}」")
    else:
        seen_ids.add(pid)
    for key in PROJECT_STRS:
        if not isinstance(project.get(key), str):
            errs.append(f"{path}.{key}: 缺失或非字符串")
    if not isinstance(project.get("stageIndex"), int):
        errs.append(f"{path}.stageIndex: 缺失或非整数")
    for key in PROJECT_LISTS:
        value = project.get(key)
        if not isinstance(value, list):
            errs.append(f"{path}.{key}: 缺失或非列表")
        elif key == "versions" and not value:
            errs.append(f"{path}.versions: 为空列表（审定表取 versions[length-1]）")
    versions = project.get("versions")
    if isinstance(versions, list):
        entry_errors(errs, f"{path}.versions", versions, VERSION_KEYS)
    tech = project.get("techIssues")
    if isinstance(tech, list):
        entry_errors(errs, f"{path}.techIssues", tech, TECH_KEYS)
    fp = project.get("fpSummary")
    if project.get("functions") or fp is not None:
        if not isinstance(fp, dict):
            errs.append(f"{path}.fpSummary: 缺失（functions 非空或已声明 fpSummary 时必须提供）")
            return
        missing = [key for key in FP_BASE_KEYS if key not in fp]
        if missing:
            errs.append(f"{path}.fpSummary: 缺少关键字段 {','.join(missing)}")
        if project.get("methodKey") == "five":
            missing = [key for key in FP_FIVE_KEYS if key not in fp]
            if missing:
                errs.append(f"{path}.fpSummary: 五点法折算链缺少 {','.join(missing)}")


def contract_errors(data):
    """P-23 最小数据契约：收集全部违规字段路径（不短路），供一次性完整报告。"""
    errs = []
    if not isinstance(data, dict):
        return [f"data: 顶层应为对象，实际 {type(data).__name__}"]
    for key in TOP_LISTS:
        value = data.get(key)
        if not isinstance(value, list):
            errs.append(f"data.{key}: 缺失或非列表")
        elif key == "projects" and not value:
            errs.append("data.projects: 为空列表")
        elif key == "commonIssues":
            entry_errors(errs, "data.commonIssues", value, COMMON_KEYS)
        elif key == "actions":
            entry_errors(errs, "data.actions", value, ACTION_KEYS)
        elif key in ("categoryTotals", "clientTotals"):
            entry_errors(errs, f"data.{key}", value, BAR_KEYS)
    for key in TOP_DICTS:
        if not isinstance(data.get(key), dict):
            errs.append(f"data.{key}: 缺失或非对象")
    stats = data.get("stats")
    if isinstance(stats, dict):
        for key in STATS_KEYS:
            if key not in stats:
                errs.append(f"data.stats.{key}: 缺失")
    meta = data.get("meta")
    if isinstance(meta, dict):
        for key in META_KEYS:
            if key not in meta:
                errs.append(f"data.meta.{key}: 缺失")
    knowledge = data.get("knowledge")
    if isinstance(knowledge, dict):
        qa = knowledge.get("qa")
        if not isinstance(qa, list) or not qa:
            errs.append("data.knowledge.qa: 缺失、非列表或为空（知识库问答默认取 qa[0]）")
        else:
            entry_errors(errs, "data.knowledge.qa", qa, KB_QA_KEYS)
        entries = knowledge.get("entries")
        if not isinstance(entries, list):
            errs.append("data.knowledge.entries: 缺失或非列表")
        else:
            entry_errors(errs, "data.knowledge.entries", entries, KB_ENTRY_KEYS)
    projects = data.get("projects")
    if isinstance(projects, list):
        seen_ids = set()
        for i, project in enumerate(projects):
            project_errors(errs, i, project, seen_ids)
    return errs


def integrity_errors(html_bytes, parts_bytes_sum):
    """产物完整性自检：残留占位符、导航锚点/挂载点、双层尺寸阈值。"""
    errs = []
    if b"__DATA__" in html_bytes:
        errs.append("产物残留 __DATA__ 占位符")
    for go in EXPECTED_NAV_GO:
        needle = f'data-go="{go}"'.encode("utf-8")
        if needle not in html_bytes:
            errs.append(f"产物缺失关键导航锚点：data-go=\"{go}\"")
    for mount in EXPECTED_MOUNTS:
        if mount.encode("utf-8") not in html_bytes:
            errs.append(f"产物缺失关键挂载点：{mount}")
    size = len(html_bytes)
    if size < SIZE_ABS_MIN:
        errs.append(f"产物尺寸 {size}B 低于量级下限 {SIZE_ABS_MIN}B（疑似源被清空/截断）")
    if size > SIZE_ABS_MAX:
        errs.append(f"产物尺寸 {size}B 超过量级上限 {SIZE_ABS_MAX}B（疑似膨胀失控）")
    if size < parts_bytes_sum:
        errs.append(f"产物 {size}B < 源片段合计 {parts_bytes_sum}B（组装缺片段/截断）")
    if size > parts_bytes_sum + WRAPPER_BUDGET:
        errs.append(f"产物 {size}B 超出源片段合计+包装预算 {parts_bytes_sum + WRAPPER_BUDGET}B（疑似片段重复拼入）")
    return errs


def artifact_errors(out_dir, html_bytes):
    """--check 产物核对：存在性 + 与 freshly 组装的参考逐字节比对（陈旧检测）。"""
    errs = []
    if not out_dir.is_dir():
        errs.append(f"输出目录不存在：{out_dir}（先运行 python3 build.py）")
        return errs
    for name in (OUT_NAMED_NAME, OUT_LEGACY_NAME):
        path = out_dir / name
        if not path.is_file():
            errs.append(f"产物缺失：{path}（先运行 python3 build.py）")
            continue
        on_disk = path.read_bytes()
        if on_disk != html_bytes:
            errs.append(
                f"产物与源不一致（陈旧）：{name}（盘上 {len(on_disk)}B vs 参考 {len(html_bytes)}B）；请重新运行 python3 build.py"
            )
    return errs


def atomic_write(path, data):
    """原子写：先写同目录临时文件再 os.replace，异常清理现场；目标已存在时保留其权限。"""
    tmp = path.with_name("." + path.name + ".tmp")
    try:
        with open(tmp, "wb") as fh:
            fh.write(data)
        if path.exists():
            os.chmod(tmp, path.stat().st_mode & 0o777)
        os.replace(tmp, path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def build_outputs(out_dir, html_bytes):
    """幂等写两份产物；覆盖内容不同的既有产物前先滚动保存上一版快照（P-21）。"""
    out_dir.mkdir(parents=True, exist_ok=True)
    named = out_dir / OUT_NAMED_NAME
    legacy = out_dir / OUT_LEGACY_NAME
    snapshot = out_dir / SNAPSHOT_NAME
    events = []
    source = named if named.is_file() else legacy
    if source.is_file() and source.read_bytes() != html_bytes:
        atomic_write(snapshot, source.read_bytes())
        events.append(f"snapshot: {snapshot.name}（保存上一版 {source.name} {source.stat().st_size} bytes）")
    for path in (named, legacy):
        if path.is_file() and path.read_bytes() == html_bytes:
            events.append(f"unchanged: {path.name}（与源一致，零写入）")
        else:
            atomic_write(path, html_bytes)
            events.append(f"wrote: {path.name} {len(html_bytes)} bytes")
    return events


def main():
    args = parse_args()
    out_dir = Path(args.out).resolve() if args.out else DEMO
    style, extra, shell, app, data, payload, source_errors, worker_holder, vendor_blocks, bootstrap = read_sources()
    html = compose(style, extra, shell, app, worker_holder, vendor_blocks, bootstrap)
    html_bytes = html.encode("utf-8")
    parts_sum = sum(len(part.encode("utf-8")) for part in (style, extra, shell, app, worker_holder, vendor_blocks, bootstrap))
    gate_errors = source_errors + shell_anchor_errors(shell) + contract_errors(data) + integrity_errors(html_bytes, parts_sum)
    events = []
    if args.check:
        gate_errors += artifact_errors(out_dir, html_bytes)
        if not out_dir.is_dir():
            print(f"note: 输出目录（未构建）：{out_dir}")
        else:
            for name in (SNAPSHOT_NAME, "预审看板-电力工程版-备份.html"):
                note = "（上一版快照）" if name == SNAPSHOT_NAME else "（历史遗留，内容已失真，本脚本不管理）"
                if (out_dir / name).is_file():
                    print(f"note: {name} 存在{note}")
    elif not gate_errors:
        try:
            events = build_outputs(out_dir, html_bytes)
        except OSError as exc:
            raise SystemExit(f"输出路径不可用：{exc}")
        for event in events:
            print(event)
        for name in (OUT_NAMED_NAME, OUT_LEGACY_NAME):
            if (out_dir / name).read_bytes() != html_bytes:
                gate_errors.append(f"写后回读不一致：{name}")
    print(f"out: {out_dir}")
    print(f"data: {len(payload)} chars; app: {len(app)} chars")
    print(f"integrity: {len(EXPECTED_NAV_GO)} 导航锚点 + {len(EXPECTED_MOUNTS)} 挂载点 + 尺寸 {len(html_bytes)}B PASS")
    print(f"sha256: {hashlib.sha256(html_bytes).hexdigest()[:12]}")
    if gate_errors:
        for err in gate_errors:
            print(f"FAIL: {err}", file=sys.stderr)
        label = "check" if args.check else "build"
        print(f"{label} failed: {len(gate_errors)} gate(s) FAILED", file=sys.stderr)
        return 1
    if not args.check:
        print(f"gates: 源量级+数据契约+导航锚点+尺寸阈值+写后回读 PASS（{len(events)} 个产物事件）")
    else:
        print("check: 全部门禁 PASS（源、契约、组装、产物一致性；未写任何文件）")
    return 0

if __name__ == "__main__":
    sys.exit(main())
