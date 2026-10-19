#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build synthetic data for the 中通服项目评审工作台 fiscal-review demo."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / "data.json"

STAGES = ["接件", "形式审查", "审核", "内部复核", "专家意见", "定稿", "归档"]

STD_ILF = {
    "source": "标准规范（示例）",
    "clause": "ILF 定义：在本系统内维护、可独立增删改的数据组",
    "excerpt": "外部系统只读引用的数据组属于 EIF；报表、查询、统计展示属于事务功能，财政两点法不计。",
}
STD_EIF = {
    "source": "标准规范（示例）",
    "clause": "EIF 定义：本系统只读引用的外部系统数据组",
    "excerpt": "若数据在本系统内维护，应改判 ILF；仅引用外部数据且不维护的，计 EIF。",
}
STD_TXN = {
    "source": "财政两点法口径（示例）",
    "clause": "只计 ILF / EIF，事务功能不计",
    "excerpt": "报表查询、统计大屏、消息展示等事务功能，不构成可独立维护的数据组，不计入两点法功能点。",
}
STD_ONCE = {
    "source": "标准规范（示例）",
    "clause": "一次性迁移/初始化不计功能点",
    "excerpt": "历史数据迁移属于一次性实施工作，不是持续维护的功能点，不计入软件开发投资。",
}
STD_PRICE = {
    "source": "政府采购网（示例）",
    "clause": "同期同类均价",
    "excerpt": "报价高于同期政府采购网均价的部分，按均价审减；需提供合同和询价记录。",
}
STD_RATIO = {
    "source": "运维评审细则（示例）",
    "clause": "保修期内 / 保修期外比例",
    "excerpt": "保修期内按 8%，保修期外按 6.5%；本项目已过保修期，应按 6.5% 重算。",
}
STD_OPS = {
    "source": "运营评审口径（示例）",
    "clause": "人头 / 人天 / 工作量对标",
    "excerpt": "运营无统一标准，按人头、人天和实际工作量对标；增值配置需有依据，专家确认。",
}
STD_CONTRACT = {
    "source": "合同（示例）",
    "clause": "服务范围与报价一致性",
    "excerpt": "合同范围外的服务不计；合同缺页、附件不全的，先补正再审定。",
}
STD_FIVE = {
    "source": "南网可研评审细则（示例）",
    "clause": "五点法权重与系数",
    "excerpt": "ILF≈10、EIF≈7、EI≈4、EO≈5、EQ≈4；功能点×权重后乘需求不确定系数 1.39，再按人天单价折算。",
}


def project(**kw):
    p = {
        "stageIndex": 2,
        "riskKey": "mid",
        "statusTone": "blue",
        "materials": [],
        "functions": [],
        "costItems": [],
        "techIssues": [],
        "versions": [],
    }
    p.update(kw)
    p["reduction"] = round(p["submitted"] - p["approved"], 1)
    p["rate"] = round(p["reduction"] / p["submitted"] * 100, 1)
    return p


projects = []

# ------------------------------------------------------------------ A
a_functions = [
    {
        "id": "A-01", "name": "用户管理", "desc": "用户、角色、组织、权限的统一管理，含新增、修改、停用、查询。",
        "proposedType": "ILF", "approvedType": "ILF",
        "rawFP": 18, "firstFP": 10, "approvedFP": 8,
        "submittedAmount": 45, "firstAmount": 30, "approvedAmount": 24,
        "adjustment": "过度拆分",
        "reason": "用户、角色、组织拆成 3 个 ILF，实际共享同一数据组，合并为 1 个 ILF。",
        "basis": STD_ILF, "caseRef": "CASE-2025-037 某厅局用户管理模块审减 42%",
        "aiSuggestion": "合并 3 项为 1 项", "confidence": 0.91, "decision": "已采纳",
    },
    {
        "id": "A-02", "name": "事项管理", "desc": "事项配置、流程编排、状态流转和办件查询。",
        "proposedType": "EIF", "approvedType": "ILF",
        "rawFP": 14, "firstFP": 9, "approvedFP": 8,
        "submittedAmount": 36, "firstAmount": 30, "approvedAmount": 24,
        "adjustment": "分类修正",
        "reason": "事项数据在本系统内维护，不是外部系统只读接口，应由 EIF 改判 ILF；金额按合并后口径重算。",
        "basis": STD_EIF, "caseRef": "CASE-2026-014 某市事项管理 EIF 改判 ILF",
        "aiSuggestion": "改判 ILF", "confidence": 0.84, "decision": "已采纳",
    },
    {
        "id": "A-03", "name": "支付接口", "desc": "对接财政非税支付平台，只读查询支付结果。",
        "proposedType": "EIF", "approvedType": "EIF",
        "rawFP": 8, "firstFP": 8, "approvedFP": 8,
        "submittedAmount": 24, "firstAmount": 24, "approvedAmount": 24,
        "adjustment": "符合",
        "reason": "外部系统只读引用，分类和金额均成立。",
        "basis": STD_EIF, "caseRef": "—",
        "aiSuggestion": "保留", "confidence": 0.95, "decision": "已采纳",
    },
    {
        "id": "A-04", "name": "报表查询", "desc": "按事项、时间、部门组合查询并导出报表。",
        "proposedType": "ILF", "approvedType": "不计（事务功能）",
        "rawFP": 10, "firstFP": 4, "approvedFP": 0,
        "submittedAmount": 30, "firstAmount": 12, "approvedAmount": 0,
        "adjustment": "不计（事务功能）",
        "reason": "报表查询是事务功能，财政两点法只计 ILF/EIF，不计入功能点。",
        "basis": STD_TXN, "caseRef": "2026-09-18 专家会纪要：报表查询不计 ILF",
        "aiSuggestion": "不计（事务功能）", "confidence": 0.78, "decision": "待确认",
    },
    {
        "id": "A-05", "name": "数据同步", "desc": "与支付接口、地图接口之间的数据同步任务。",
        "proposedType": "EIF", "approvedType": "不计（重复）",
        "rawFP": 8, "firstFP": 0, "approvedFP": 0,
        "submittedAmount": 24, "firstAmount": 0, "approvedAmount": 0,
        "adjustment": "重复删除",
        "reason": "与支付接口、第三方地图接口重复，不单独计功能点。",
        "basis": STD_EIF, "caseRef": "CASE-2026-019 某市接口重复计列",
        "aiSuggestion": "删除重复", "confidence": 0.88, "decision": "已采纳",
    },
    {
        "id": "A-06", "name": "权限配置", "desc": "菜单、按钮、数据权限配置。",
        "proposedType": "ILF", "approvedType": "ILF",
        "rawFP": 10, "firstFP": 6, "approvedFP": 4,
        "submittedAmount": 30, "firstAmount": 18, "approvedAmount": 12,
        "adjustment": "过度拆分",
        "reason": "从用户管理中拆出，数据组不独立；合并后保留 4 FP。",
        "basis": STD_ILF, "caseRef": "CASE-2025-037 某厅局用户管理模块审减 42%",
        "aiSuggestion": "合并", "confidence": 0.82, "decision": "已采纳",
    },
    {
        "id": "A-07", "name": "日志审计", "desc": "操作日志、登录日志记录与查询。",
        "proposedType": "ILF", "approvedType": "不计（无独立数据组）",
        "rawFP": 8, "firstFP": 4, "approvedFP": 0,
        "submittedAmount": 24, "firstAmount": 12, "approvedAmount": 0,
        "adjustment": "无独立数据组",
        "reason": "日志依附于业务表，不能独立维护，不构成 ILF。",
        "basis": STD_ILF, "caseRef": "CASE-2026-021 某局日志审计不计 ILF",
        "aiSuggestion": "删除", "confidence": 0.74, "decision": "已采纳",
    },
    {
        "id": "A-08", "name": "移动端适配", "desc": "移动端页面适配、响应式改造。",
        "proposedType": "ILF", "approvedType": "不计（非数据功能）",
        "rawFP": 12, "firstFP": 8, "approvedFP": 0,
        "submittedAmount": 36, "firstAmount": 24, "approvedAmount": 0,
        "adjustment": "非数据功能",
        "reason": "适配是技术实现，不构成独立数据组。",
        "basis": STD_ILF, "caseRef": "2026-09-18 专家会纪要：适配不计功能点",
        "aiSuggestion": "删除（非数据功能）", "confidence": 0.86, "decision": "待确认",
    },
    {
        "id": "A-09", "name": "第三方地图接口", "desc": "只读调用第三方地图服务。",
        "proposedType": "EIF", "approvedType": "EIF",
        "rawFP": 6, "firstFP": 6, "approvedFP": 6,
        "submittedAmount": 18, "firstAmount": 18, "approvedAmount": 18,
        "adjustment": "符合",
        "reason": "外部只读接口，分类和金额成立。",
        "basis": STD_EIF, "caseRef": "—",
        "aiSuggestion": "保留", "confidence": 0.93, "decision": "已采纳",
    },
    {
        "id": "A-10", "name": "消息推送", "desc": "短信、站内信、模板消息推送。",
        "proposedType": "EIF", "approvedType": "EIF",
        "rawFP": 5, "firstFP": 5, "approvedFP": 5,
        "submittedAmount": 15, "firstAmount": 15, "approvedAmount": 15,
        "adjustment": "符合",
        "reason": "外部只读接口，分类和金额成立。",
        "basis": STD_EIF, "caseRef": "—",
        "aiSuggestion": "保留", "confidence": 0.92, "decision": "已采纳",
    },
    {
        "id": "A-11", "name": "统计大屏", "desc": "办件量、满意度、趋势统计展示。",
        "proposedType": "ILF", "approvedType": "不计（事务功能）",
        "rawFP": 14, "firstFP": 6, "approvedFP": 0,
        "submittedAmount": 42, "firstAmount": 18, "approvedAmount": 0,
        "adjustment": "不计（事务功能）",
        "reason": "展示类事务功能，不是可独立维护的数据组。",
        "basis": STD_TXN, "caseRef": "2026-09-18 专家会纪要：统计展示不计 ILF",
        "aiSuggestion": "不计（事务功能）", "confidence": 0.81, "decision": "已采纳",
    },
    {
        "id": "A-12", "name": "历史数据迁移", "desc": "旧系统历史办件数据迁移、清洗、校验。",
        "proposedType": "ILF", "approvedType": "不计（一次性）",
        "rawFP": 18, "firstFP": 0, "approvedFP": 0,
        "submittedAmount": 54, "firstAmount": 0, "approvedAmount": 0,
        "adjustment": "一次性不计",
        "reason": "一次性迁移，不属于持续维护的功能点。",
        "basis": STD_ONCE, "caseRef": "CASE-2026-027 某市历史迁移不计功能点",
        "aiSuggestion": "删除（一次性）", "confidence": 0.89, "decision": "已采纳",
    },
]

A = project(
    id="A", name="省一体化政务服务平台（二期）软件开发", client="广东省财政厅",
    category="软件开发", method="财政两点法（ILF + EIF）", methodKey="two",
    submitted=558, firstApproved=269, approved=193,
    stage="定稿", stageIndex=5, risk="高", riskKey="high",
    statusLabel="定稿 · 已出审定表", statusTone="green",
    updated="2026-10-16",
    owner="省政务服务和数据管理局（合成）", reviewer="中通服评审组", expert="专家库（5 人）",
    summary="86 项功能点，合并 12 项过度拆分、修正 3 项 EIF/ILF 误判、删除 2 项重复、剔除 1 项无依据；初稿 269 万，专家意见后定稿 193 万。",
    conclusion="审定 193 万；只出审定表，不提整改建议；甲方按审定价招标。",
    next="归档审定表；锁定 V3；专家意见闭环。",
    fpSummary={
        "submittedFP": 186, "firstFP": 90, "approvedFP": 64,
        "items": 86, "approvedItems": 74, "overSplit": 12, "reclass": 3,
        "duplicate": 2, "excluded": 1, "unit": "综合单价约 3.0 万元/FP（演示参数）",
    },
    functions=a_functions,
    materials=[
        {"name": "报价书", "pages": 42, "type": "PDF", "ocr": "已解析", "note": "含功能清单和分项报价"},
        {"name": "功能清单", "pages": 86, "type": "Excel", "ocr": "已解析", "note": "86 项功能点原始清单"},
        {"name": "需求规格说明书", "pages": 120, "type": "PDF", "ocr": "已 OCR", "note": "功能描述与数据组边界"},
        {"name": "专家意见", "pages": 5, "type": "Word", "ocr": "已结构化", "note": "2026-10-08 专家会"},
        {"name": "会议纪要", "pages": 1, "type": "录音/转写", "ocr": "已转写", "note": "2026-09-18 专家会"},
    ],
    techIssues=[
        {"id": "T-A-01", "category": "一致性", "severity": "高", "finding": "需求规格 4.2 功能清单与报价书 86 项不一致，报价书多 6 项。", "evidence": "需求规格 P42 vs 报价书 P8", "status": "待修改"},
        {"id": "T-A-02", "category": "架构", "severity": "中", "finding": "数据架构章节缺失，未说明数据组边界和主数据来源。", "evidence": "技术方案目录 P3", "status": "待修改"},
        {"id": "T-A-03", "category": "绩效", "severity": "中", "finding": "绩效指标只有“提升效率”，缺用户数、并发、吞吐量等量化指标。", "evidence": "可研报告 P56", "status": "已闭环"},
        {"id": "T-A-04", "category": "形式", "severity": "中", "finding": "项目命名与审批细则命名规则不一致；立项函缺函号。", "evidence": "审批细则 P2 vs 立项函", "status": "待修改"},
        {"id": "T-A-05", "category": "依据", "severity": "中", "finding": "政策依据引用已过期规划（十三五），未衔接最新省级文件要点，牛头不对马嘴。", "evidence": "可研报告 P10-P12", "status": "待修改"},
    ],
    versions=[
        {"id": "V1", "label": "初稿", "date": "2026-09-20", "total": 269, "note": "按两点法逐项复核，形成送审/审定对比。", "comments": []},
        {"id": "V2", "label": "修改稿", "date": "2026-10-08", "total": 214, "note": "专家意见 5 条，完成合并、改判、删除。", "comments": [
            "用户管理/权限配置合并，审减 24 万。",
            "事项管理改判 ILF，金额不变，依据补齐。",
            "报表查询、统计大屏不计入 ILF，审减 30 万。",
            "历史数据迁移属一次性，审减 54 万。",
            "移动端适配不构成独立数据组，审减 24 万。",
        ]},
        {"id": "V3", "label": "定稿", "date": "2026-10-16", "total": 193, "note": "专家意见全部闭环，版本锁定，出审定表。", "comments": [
            "专家意见全部闭环。",
            "审定表签字版归档。",
        ]},
    ],
)
projects.append(A)

# ------------------------------------------------------------------ B
B = project(
    id="B", name="某市政务云基础设施扩容及软件租赁", client="广东省财政厅（地市）",
    category="基础设施 / 租用软件", method="采购价 + 合同审核", methodKey="cost",
    submitted=420, firstApproved=380, approved=356,
    stage="内部复核", stageIndex=3, risk="中", riskKey="mid",
    statusLabel="复核中", statusTone="amber", updated="2026-10-17",
    owner="某市政务服务数据管理局（合成）", reviewer="中通服评审组", expert="价格/合同专家",
    summary="4 项费用：服务器/存储/网络按采购网低价，租赁软件合同缺页且高于采购网 12%；审定 356 万。",
    conclusion="审定 356 万；合同缺页和高于采购网部分已审减。",
    next="补齐合同附件，出审定表。",
    costItems=[
        {"id": "B-01", "name": "服务器", "spec": "2×Xeon / 512G / 8×3.84T", "qty": 40, "unit": "台", "unitPrice": 3.0,
         "submitted": 120, "firstAmount": 114, "approvedAmount": 108,
         "priceSource": "政府采购网 2026-08 均价 2.7 万/台", "basis": STD_PRICE,
         "adjustment": "价格审减", "reason": "报价 3.0 万/台，高于采购网均价 10%，按 2.7 万/台审定。"},
        {"id": "B-02", "name": "存储", "spec": "分布式存储 200TB", "qty": 200, "unit": "TB", "unitPrice": 0.4,
         "submitted": 80, "firstAmount": 76, "approvedAmount": 72,
         "priceSource": "政府采购网 2026-08 均价 0.36 万/TB", "basis": STD_PRICE,
         "adjustment": "价格审减", "reason": "报价 0.4 万/TB，高于均价 11%，按 0.36 万/TB 审定。"},
        {"id": "B-03", "name": "网络设备", "spec": "核心/汇聚/接入", "qty": 1, "unit": "批", "unitPrice": 60,
         "submitted": 60, "firstAmount": 57, "approvedAmount": 54,
         "priceSource": "历史合同 2025-11 + 采购网", "basis": STD_PRICE,
         "adjustment": "价格审减", "reason": "部分型号高于历史合同价，按低价审定。"},
        {"id": "B-04", "name": "软件租赁", "spec": "办公套件/安全组件 3 年", "qty": 3, "unit": "年", "unitPrice": 53.3,
         "submitted": 160, "firstAmount": 133, "approvedAmount": 122,
         "priceSource": "采购网 2026-08 + 合同第 3.2 条", "basis": STD_CONTRACT,
         "adjustment": "合同 + 价格审减", "reason": "合同缺附件 2 页，报价高于采购网 12%，按采购网价并扣除缺页服务审定。"},
    ],
    materials=[
        {"name": "报价书", "pages": 28, "type": "PDF", "ocr": "已解析", "note": "含 4 项费用明细"},
        {"name": "软件租赁合同", "pages": 36, "type": "PDF", "ocr": "已 OCR", "note": "缺附件 2 页"},
        {"name": "采购网询价", "pages": 6, "type": "截图", "ocr": "已结构化", "note": "2026-08 同期均价"},
        {"name": "机房现状", "pages": 8, "type": "Word", "ocr": "已解析", "note": "机柜、电力、网络现状"},
    ],
    techIssues=[
        {"id": "T-B-01", "category": "材料", "severity": "高", "finding": "软件租赁合同缺第 3.2 条附件 2 页，服务范围无法完整核对。", "evidence": "合同 P18-P19", "status": "待补正"},
        {"id": "T-B-02", "category": "价格", "severity": "高", "finding": "服务器、存储报价分别高于采购网均价 10% 和 11%。", "evidence": "报价书 P8 vs 采购网截图", "status": "已闭环"},
        {"id": "T-B-03", "category": "一致性", "severity": "中", "finding": "机柜数量与机房现状不符，扩容后电力容量不足。", "evidence": "机房现状 P4", "status": "待修改"},
    ],
    versions=[
        {"id": "V1", "label": "初稿", "date": "2026-10-05", "total": 380, "note": "按采购网均价初核。", "comments": []},
        {"id": "V2", "label": "复核稿", "date": "2026-10-17", "total": 356, "note": "补充合同缺页、租赁价格复核。", "comments": [
            "租赁软件缺页部分不计，审减 11 万。",
            "服务器/存储按采购网均价审减 13 万。",
        ]},
    ],
)
projects.append(B)

# ------------------------------------------------------------------ C
C = project(
    id="C", name="某厅局信息系统运维服务（2026—2027）", client="广东省财政厅",
    category="运维", method="运维比例标准", methodKey="cost",
    submitted=180, firstApproved=160, approved=142,
    stage="内部复核", stageIndex=3, risk="中", riskKey="mid",
    statusLabel="复核中", statusTone="amber", updated="2026-10-17",
    owner="某厅局信息中心（合成）", reviewer="中通服评审组", expert="运维专家",
    summary="运维比例按保修期外 6.5% 重算，基础运维+安全运维审定 142 万。",
    conclusion="审定 142 万；按保修期外比例执行。",
    next="复核 SLA 指标，出审定表。",
    costItems=[
        {"id": "C-01", "name": "基础运维", "spec": "主机/存储/网络/数据库", "qty": 1, "unit": "年", "unitPrice": 120,
         "submitted": 120, "firstAmount": 107, "approvedAmount": 98,
         "priceSource": "运维基数 1,500 万 × 6.5%", "basis": STD_RATIO,
         "adjustment": "比例审减", "reason": "申报按保修期内 8% 计算；项目已过保修期，应按 6.5% 重算。"},
        {"id": "C-02", "name": "安全运维", "spec": "等保/漏洞/监测", "qty": 1, "unit": "年", "unitPrice": 60,
         "submitted": 60, "firstAmount": 53, "approvedAmount": 44,
         "priceSource": "运维基数 1,500 万 × 6.5% 中的安全部分", "basis": STD_RATIO,
         "adjustment": "比例审减", "reason": "安全运维随基础运维比例同步调整，剔除重复监测项。"},
    ],
    materials=[
        {"name": "运维方案", "pages": 32, "type": "PDF", "ocr": "已解析", "note": "服务内容/SLA/人员"},
        {"name": "服务清单", "pages": 18, "type": "Excel", "ocr": "已解析", "note": "缺 3 项服务"},
        {"name": "历史合同", "pages": 24, "type": "PDF", "ocr": "已 OCR", "note": "上一年度运维合同"},
    ],
    techIssues=[
        {"id": "T-C-01", "category": "比例", "severity": "高", "finding": "运维比例按保修期内 8% 计算，项目已过保修期，应适用 6.5%。", "evidence": "运维方案 P6", "status": "已闭环"},
        {"id": "T-C-02", "category": "绩效", "severity": "中", "finding": "SLA 指标不可量化，缺可用率、响应时间、恢复时间。", "evidence": "运维方案 P18", "status": "待修改"},
        {"id": "T-C-03", "category": "材料", "severity": "中", "finding": "服务清单缺 3 项，与运维方案章节不一致。", "evidence": "服务清单 P2", "status": "待补正"},
    ],
    versions=[
        {"id": "V1", "label": "初稿", "date": "2026-10-06", "total": 160, "note": "按 8% 初步测算。", "comments": []},
        {"id": "V2", "label": "复核稿", "date": "2026-10-17", "total": 142, "note": "按 6.5% 重算，剔除重复项。", "comments": [
            "比例从 8% 调整为 6.5%，审减 18 万。",
        ]},
    ],
)
projects.append(C)

# ------------------------------------------------------------------ D
D = project(
    id="D", name="某市数字政府运营服务（内容/活动/数据）", client="广东省财政厅（地市）",
    category="运营", method="人天 + 专家判断", methodKey="cost",
    submitted=260, firstApproved=240, approved=210,
    stage="专家意见", stageIndex=4, risk="高", riskKey="high",
    statusLabel="专家意见", statusTone="blue", updated="2026-10-18",
    owner="某市政务服务数据管理局（合成）", reviewer="中通服评审组", expert="运营/绩效专家",
    summary="运营无严格标准，按人头/人天与工作量对标，12 人核减为 9 人；审定 210 万。",
    conclusion="审定 210 万；运营单价与人头仍需专家确认。",
    next="专家确认人头，补绩效指标。",
    costItems=[
        {"id": "D-01", "name": "内容运营", "spec": "12 人→9 人，250 人天", "qty": 9, "unit": "人", "unitPrice": 10.7,
         "submitted": 120, "firstAmount": 110, "approvedAmount": 96,
         "priceSource": "人天单价 2,600 元 × 工作量", "basis": STD_OPS,
         "adjustment": "人头核减", "reason": "12 人配置与内容更新量不匹配，按 9 人核定。"},
        {"id": "D-02", "name": "活动运营", "spec": "4 场/年，含策划/执行/复盘", "qty": 4, "unit": "场", "unitPrice": 20,
         "submitted": 80, "firstAmount": 74, "approvedAmount": 64,
         "priceSource": "历史活动合同 + 人天", "basis": STD_OPS,
         "adjustment": "单价审减", "reason": "单场报价高于历史合同 15%，按历史均价审定。"},
        {"id": "D-03", "name": "数据运营", "spec": "数据治理/分析/月报", "qty": 1, "unit": "年", "unitPrice": 60,
         "submitted": 60, "firstAmount": 56, "approvedAmount": 50,
         "priceSource": "人天 + 历史项目", "basis": STD_OPS,
         "adjustment": "工作量审减", "reason": "月报和数据治理工作量重复，核减 10 万。"},
    ],
    materials=[
        {"name": "运营方案", "pages": 40, "type": "PDF", "ocr": "已解析", "note": "内容/活动/数据三块"},
        {"name": "人员配置", "pages": 6, "type": "Excel", "ocr": "已解析", "note": "12 人名单与单价"},
        {"name": "活动清单", "pages": 12, "type": "Word", "ocr": "已解析", "note": "4 场活动方案"},
    ],
    techIssues=[
        {"id": "T-D-01", "category": "绩效", "severity": "高", "finding": "无用户数、活跃度、内容产出量等绩效指标；最大用户 5,000 却写并发 2,000，前后矛盾。", "evidence": "运营方案 P30", "status": "待补正"},
        {"id": "T-D-02", "category": "运营", "severity": "高", "finding": "12 人配置与工作量不匹配，缺岗位职责和工作量测算。", "evidence": "人员配置 P2", "status": "待修改"},
        {"id": "T-D-03", "category": "依据", "severity": "中", "finding": "增值配置（数据看板）无单独报价和依据。", "evidence": "运营方案 P36", "status": "待补正"},
    ],
    versions=[
        {"id": "V1", "label": "初稿", "date": "2026-10-07", "total": 240, "note": "按 12 人配置初核。", "comments": []},
        {"id": "V2", "label": "修改稿", "date": "2026-10-18", "total": 210, "note": "按 9 人、历史活动价重算。", "comments": [
            "内容运营 12 人核减为 9 人，审减 14 万。",
            "活动单价按历史合同下调，审减 10 万。",
            "数据运营工作量核减 6 万。",
        ]},
    ],
)
projects.append(D)

# ------------------------------------------------------------------ E
E = project(
    id="E", name="某局第三方测评与监理服务", client="广东烟草",
    category="第三方服务", method="合同 + 市场价", methodKey="cost",
    submitted=96, firstApproved=92, approved=88,
    stage="定稿", stageIndex=5, risk="低", riskKey="low",
    statusLabel="定稿", statusTone="green", updated="2026-10-17",
    owner="某局信息中心（合成）", reviewer="中通服评审组", expert="合同/测评专家",
    summary="第三方测评/监理/培训按合同与市场价核对，审定 88 万。",
    conclusion="审定 88 万；合同范围外服务不计。",
    next="补合同范围说明，出审定表。",
    costItems=[
        {"id": "E-01", "name": "等保测评", "spec": "三级系统 2 个", "qty": 2, "unit": "个", "unitPrice": 18,
         "submitted": 36, "firstAmount": 34, "approvedAmount": 32,
         "priceSource": "市场价 16 万/个", "basis": STD_CONTRACT,
         "adjustment": "单价审减", "reason": "报价 18 万/个，高于市场均价 12.5%，按 16 万/个审定。"},
        {"id": "E-02", "name": "监理", "spec": "项目全过程监理", "qty": 1, "unit": "项", "unitPrice": 30,
         "submitted": 30, "firstAmount": 29, "approvedAmount": 28,
         "priceSource": "历史合同 + 市场价", "basis": STD_CONTRACT,
         "adjustment": "范围审减", "reason": "合同外增加 2 次现场会，未在报价中单列，按合同范围审定。"},
        {"id": "E-03", "name": "培训", "spec": "3 期，60 人", "qty": 3, "unit": "期", "unitPrice": 10,
         "submitted": 30, "firstAmount": 29, "approvedAmount": 28,
         "priceSource": "市场价 9.3 万/期", "basis": STD_CONTRACT,
         "adjustment": "人数审减", "reason": "方案 60 人，报价按 80 人计，按 60 人审定。"},
    ],
    materials=[
        {"name": "合同", "pages": 22, "type": "PDF", "ocr": "已 OCR", "note": "服务范围条款"},
        {"name": "测评方案", "pages": 18, "type": "PDF", "ocr": "已解析", "note": "2 个三级系统"},
        {"name": "培训方案", "pages": 10, "type": "Word", "ocr": "已解析", "note": "3 期 60 人"},
    ],
    techIssues=[
        {"id": "T-E-01", "category": "合同", "severity": "中", "finding": "合同服务范围表述不清，测评/监理/培训边界重叠。", "evidence": "合同 P6", "status": "待修改"},
        {"id": "T-E-02", "category": "一致性", "severity": "中", "finding": "培训方案 60 人，报价按 80 人计。", "evidence": "培训方案 P3 vs 报价书 P5", "status": "已闭环"},
        {"id": "T-E-03", "category": "必要性", "severity": "中", "finding": "未列密码应用测评；按等保要求属必要第三方服务，应补充或说明。", "evidence": "等保要求 + 报价书", "status": "待补正"},
    ],
    versions=[
        {"id": "V1", "label": "初稿", "date": "2026-10-08", "total": 92, "note": "按合同和市场价初核。", "comments": []},
        {"id": "V2", "label": "定稿", "date": "2026-10-17", "total": 88, "note": "培训人数、监理范围审减。", "comments": [
            "培训人数按 60 人审定，审减 2 万。",
            "监理范围外服务不计，审减 2 万。",
        ]},
    ],
)
projects.append(E)

# ------------------------------------------------------------------ F
f_functions = [
    {"id": "F-ILF", "name": "内部逻辑文件（ILF）", "desc": "平台主数据、业务数据等 12 个数据组；送审 13 个，合并 1 个。",
     "proposedType": "ILF", "approvedType": "ILF", "quantity": 13, "approvedQty": 12, "weight": 10,
     "rawFP": 130, "firstFP": 130, "approvedFP": 120,
     "submittedAmount": 53.7, "firstAmount": 48.6, "approvedAmount": 43.4,
     "adjustment": "合并 1 个数据组", "reason": "客户主数据与供应商主数据共享同一数据组，合并为 1 个 ILF。",
     "basis": STD_FIVE, "caseRef": "CASE-2026-031 南网五点法分类复核",
     "aiSuggestion": "合并 1 个 ILF", "confidence": 0.88, "decision": "已采纳"},
    {"id": "F-EIF", "name": "外部接口文件（EIF）", "desc": "只读引用外部系统数据组 8 个；送审 9 个，剔除 1 个重复接口。",
     "proposedType": "EIF", "approvedType": "EIF", "quantity": 9, "approvedQty": 8, "weight": 7,
     "rawFP": 63, "firstFP": 63, "approvedFP": 56,
     "submittedAmount": 26.0, "firstAmount": 22.8, "approvedAmount": 20.3,
     "adjustment": "删除 1 个重复接口", "reason": "与已有接口重复，不单独计。",
     "basis": STD_FIVE, "caseRef": "CASE-2026-031",
     "aiSuggestion": "删除重复接口", "confidence": 0.84, "decision": "已采纳"},
    {"id": "F-EI", "name": "外部输入（EI）", "desc": "外部输入事务 22 个；送审 22 个，合并 2 个。",
     "proposedType": "EI", "approvedType": "EI", "quantity": 22, "approvedQty": 20, "weight": 4,
     "rawFP": 88, "firstFP": 88, "approvedFP": 80,
     "submittedAmount": 36.3, "firstAmount": 32.5, "approvedAmount": 29.0,
     "adjustment": "合并 2 个输入", "reason": "同一业务对象的两个录入入口合并。",
     "basis": STD_FIVE, "caseRef": "CASE-2026-031",
     "aiSuggestion": "合并 2 个 EI", "confidence": 0.79, "decision": "待确认"},
    {"id": "F-EO", "name": "外部输出（EO）", "desc": "外部输出事务 15 个；送审 15 个，合并 1 个。",
     "proposedType": "EO", "approvedType": "EO", "quantity": 15, "approvedQty": 14, "weight": 5,
     "rawFP": 75, "firstFP": 75, "approvedFP": 70,
     "submittedAmount": 31.0, "firstAmount": 28.4, "approvedAmount": 25.3,
     "adjustment": "合并 1 个输出；1 个无计算改判 EQ", "reason": "两个报表输出共用同一数据源和格式，合并；另有 1 个无公式计算、只是呈现，应改判为外部查询（EQ），按 EQ 审减。",
     "basis": STD_FIVE, "caseRef": "CASE-2026-031",
     "aiSuggestion": "合并 1 个 EO", "confidence": 0.81, "decision": "已采纳"},
    {"id": "F-EQ", "name": "外部查询（EQ）", "desc": "外部查询事务 20 个；送审 20 个，合并 2 个。",
     "proposedType": "EQ", "approvedType": "EQ", "quantity": 20, "approvedQty": 18, "weight": 4,
     "rawFP": 80, "firstFP": 80, "approvedFP": 72,
     "submittedAmount": 33.0, "firstAmount": 29.7, "approvedAmount": 26.0,
     "adjustment": "合并 2 个查询", "reason": "同一查询条件的两个入口合并。",
     "basis": STD_FIVE, "caseRef": "CASE-2026-031",
     "aiSuggestion": "合并 2 个 EQ", "confidence": 0.77, "decision": "已采纳"},
]

F = project(
    id="F", name="南方电网某数字化平台可研（五点法）", client="南方电网",
    category="软件开发", method="南网五点法（ILF/EIF/EI/EO/EQ）", methodKey="five",
    submitted=180, firstApproved=162, approved=144,
    stage="专家意见", stageIndex=4, risk="中", riskKey="mid",
    statusLabel="专家会", statusTone="blue", updated="2026-10-18",
    owner="南方电网某单位（合成）", reviewer="中通服评审组", expert="可研/造价专家",
    summary="五点法识别 398 FP，×1.39=553.2 调整 FP，按 2600 元/人天折算 144 万；可研深度不足，专家会退回补充分类依据。",
    conclusion="审定 144 万；可研补充后再提交专家会。",
    next="补充功能点分类依据，再开专家会。",
    fpSummary={
        "submittedFP": 436, "firstFP": 436, "approvedFP": 398,
        "adjustedFP": 553.2, "personDays": 553.2, "unitPrice": 2600,
        "coefficient": 1.39, "items": 5, "approvedItems": 5,
        "overSplit": 0, "reclass": 0, "duplicate": 2, "excluded": 0,
        "unit": "南网五点法：权重 ILF 10 / EIF 7 / EI 4 / EO 5 / EQ 4；系数 1.39；2600 元/人天",
    },
    functions=f_functions,
    materials=[
        {"name": "可研报告", "pages": 96, "type": "PDF", "ocr": "已解析", "note": "含功能清单和估算"},
        {"name": "投资估算书", "pages": 24, "type": "Excel", "ocr": "已解析", "note": "五点法明细"},
        {"name": "专家会纪要", "pages": 1, "type": "录音/转写", "ocr": "已转写", "note": "2026-10-18"},
    ],
    techIssues=[
        {"id": "T-F-01", "category": "技术", "severity": "高", "finding": "可研深度不足，未达到初设程度，五点法分类缺依据。", "evidence": "可研报告 P12", "status": "待补正"},
        {"id": "T-F-02", "category": "功能点", "severity": "高", "finding": "ILF/EIF 边界描述不清，部分数据组未说明维护主体。", "evidence": "可研报告 P28", "status": "待修改"},
        {"id": "T-F-03", "category": "绩效", "severity": "中", "finding": "缺用户数、并发、吞吐量等绩效指标。", "evidence": "可研报告 P64", "status": "待补正"},
    ],
    versions=[
        {"id": "V1", "label": "初稿", "date": "2026-10-09", "total": 162, "note": "按五点法初核。", "comments": []},
        {"id": "V2", "label": "专家会后", "date": "2026-10-18", "total": 144, "note": "按专家意见合并重复接口/输入。", "comments": [
            "合并 1 个 EIF、2 个 EI、1 个 EO、2 个 EQ。",
            "可研深度不足，补充后再提交专家会。",
        ]},
    ],
)
projects.append(F)

# ------------------------------------------------------------------ knowledge
knowledge = {
    "sources": [
        {"id": "std", "name": "标准规范", "count": 12, "updated": "2026-10-12", "desc": "国标/行标/业主细则/功能点定义"},
        {"id": "guide", "name": "审核要点", "count": 1, "updated": "2026-10-12", "desc": "2025 版现行；工作规定只用最新版"},
        {"id": "case", "name": "历史案例", "count": 86, "updated": "2026-10-15", "desc": "历史审定表、问题清单、专家批注"},
        {"id": "minutes", "name": "会议纪要", "count": 24, "updated": "2026-10-18", "desc": "专家会录音转写与摘要"},
        {"id": "price", "name": "价格库", "count": 1240, "updated": "2026-10-19", "desc": "政府采购网/合同/历史成交价"},
        {"id": "contract", "name": "合同库", "count": 320, "updated": "2026-10-10", "desc": "租赁/运维/第三方服务合同"},
        {"id": "template", "name": "业主模板", "count": 18, "updated": "2026-09-30", "desc": "财政/南网/烟草审定表模板"},
    ],
    "qa": [
        {"q": "报表查询算不算 ILF？", "a": "不算。ILF 必须是可独立维护的数据组；报表查询属于事务功能，财政两点法不计入。",
         "citations": ["标准规范（示例）· ILF 定义", "历史案例 CASE-2026-011", "2026-09-18 专家会纪要"]},
        {"q": "运维比例怎么取？", "a": "先看保修期：保修期内和保修期外比例不同；本项目应按保修期外 6.5%，不是 8%。",
         "citations": ["运维评审细则（示例）第 4.3 条", "历史案例 CASE-2025-052"]},
        {"q": "租赁软件价格高于采购网怎么办？", "a": "以采购网/合同低价为审定依据；要求补齐合同页，超出部分审减。",
         "citations": ["政府采购网 2026-08 价格", "B 项目合同第 3.2 条"]},
        {"q": "南网五点法的 1.39 怎么用？", "a": "功能点×权重得到总 FP；×1.39（需求不确定）×通用性系数得到调整 FP；再按人天折算和 2600 元/人天计算投资。",
         "citations": ["南网可研评审细则（示例）", "F 项目专家会纪要"]},
        {"q": "EO 和 EQ 怎么区分？", "a": "EO 必须通过计算对外输出；只是查询、筛选、统计、直接呈现、没有公式计算的，是 EQ。申报写成 EO 的按 EQ 认定，审减。",
         "citations": ["标准规范（示例）· EO/EQ 定义", "CASE-2026-031 南网五点法分类复核"]},
        {"q": "没有“修改/维护”字眼就不是 ILF 吗？", "a": "不能只靠关键词。要回到标准定义（可独立维护的数据组）+ 历史相似案例判断；描述换一种说法就判错，正是关键词规则的坑。",
         "citations": ["标准规范（示例）· ILF 定义", "CASE-2025-037"]},
    ],
    "entries": [
        {"id": "K-01", "type": "标准", "title": "ILF / EIF 定义与边界（示例）", "source": "标准规范库", "date": "2026-10-12", "tags": ["功能点", "两点法", "ILF"]},
        {"id": "K-02", "type": "案例", "title": "某厅局用户管理模块审减 42%", "source": "历史案例库", "date": "2026-09-30", "tags": ["过度拆分", "用户管理"]},
        {"id": "K-03", "type": "纪要", "title": "2026-09-18 专家会：报表查询不计 ILF", "source": "会议纪要库", "date": "2026-09-18", "tags": ["事务功能", "报表"]},
        {"id": "K-04", "type": "价格", "title": "2026-08 政府采购网服务器均价 2.7 万/台", "source": "价格库", "date": "2026-08-31", "tags": ["服务器", "采购价"]},
        {"id": "K-05", "type": "合同", "title": "某市软件租赁合同第 3.2 条：服务范围与附件", "source": "合同库", "date": "2026-09-22", "tags": ["租赁", "合同"]},
        {"id": "K-06", "type": "模板", "title": "南网可研投资估算表（五点法）", "source": "业主模板库", "date": "2026-09-30", "tags": ["南网", "五点法"]},
    ],
}

common_issues = [
    {"title": "功能点过度拆分", "text": "A 项目用户管理/权限配置拆成 3 个 ILF，实际共享同一数据组；合并后 FP 降 45%。"},
    {"title": "EIF / ILF 分类误判", "text": "A 项目事项管理按外部接口申报，实际在本系统内维护，应改判 ILF。"},
    {"title": "事务功能混入数据功能", "text": "报表查询、统计大屏在财政两点法中不应计入 ILF；A 项目因此审减 30 万。"},
    {"title": "租赁软件价格与合同缺页", "text": "B 项目租赁软件报价高于采购网 12%，合同缺 2 页，审减 11 万。"},
    {"title": "运维比例按保修期内计算", "text": "C 项目应按保修期外 6.5%，申报按 8%，审减 18 万。"},
    {"title": "运营无绩效指标、人头不匹配", "text": "D 项目 12 人配置与工作量不匹配，缺用户数/活跃度指标；最大用户 5,000 却写并发 2,000；核减为 9 人。"},
    {"title": "服务内容与架构模块不一致", "text": "方案架构画 5 个模块，服务内容写了 8 个；前后不对应，多出部分审减。"},
    {"title": "手搓表格公式错误", "text": "政数局部分项目无统一表格，从 Word 复制到 Excel 手搓套公式；标准 35 误作 15，需逐项纠错。"},
]

actions = [
    {"time": "2026-10-18 17:00", "project": "F", "stage": "专家意见", "action": "专家会：可研深度不足，退回补充功能点分类依据", "actor": "专家库", "result": "待修改"},
    {"time": "2026-10-18 15:30", "project": "D", "stage": "专家意见", "action": "运营人头 12→9，补绩效指标", "actor": "运营专家", "result": "待确认"},
    {"time": "2026-10-17 16:00", "project": "C", "stage": "内部复核", "action": "运维比例按保修期外 6.5% 重算", "actor": "评审组", "result": "已复核"},
    {"time": "2026-10-17 11:00", "project": "B", "stage": "内部复核", "action": "租赁软件价格复核，合同缺页扣减", "actor": "价格专家", "result": "已复核"},
    {"time": "2026-10-16 17:00", "project": "A", "stage": "定稿", "action": "V3 定稿，审定 193 万，锁定版本", "actor": "评审组", "result": "已定稿"},
    {"time": "2026-10-16 10:00", "project": "A", "stage": "定稿", "action": "专家意见 5 条全部闭环", "actor": "专家库", "result": "已闭环"},
    {"time": "2026-10-15 14:00", "project": "E", "stage": "定稿", "action": "培训人数按 60 人审定", "actor": "评审组", "result": "已定稿"},
    {"time": "2026-10-12 09:00", "project": "—", "stage": "知识库", "action": "新增历史案例 6 条、价格记录 120 条", "actor": "知识库管理员", "result": "已入库"},
]

# ------------------------------------------------------------------ stats & totals
submitted = round(sum(p["submitted"] for p in projects), 1)
approved = round(sum(p["approved"] for p in projects), 1)
reduction = round(submitted - approved, 1)
rate = round(reduction / submitted * 100, 1)
high_risk = sum(1 for p in projects if p["riskKey"] == "high")

cat_order = ["软件开发", "基础设施 / 租用软件", "运维", "运营", "第三方服务"]
cat_totals = []
for cat in cat_order:
    items = [p for p in projects if p["category"] == cat]
    if items:
        cat_totals.append({
            "name": cat,
            "submitted": round(sum(p["submitted"] for p in items), 1),
            "approved": round(sum(p["approved"] for p in items), 1),
            "reduction": round(sum(p["reduction"] for p in items), 1),
        })

client_groups = {"财政体系": [], "南方电网": [], "广东烟草": []}
for p in projects:
    if p["client"].startswith("广东省财政厅"):
        client_groups["财政体系"].append(p)
    elif p["client"] == "南方电网":
        client_groups["南方电网"].append(p)
    else:
        client_groups["广东烟草"].append(p)
client_totals = []
for name, items in client_groups.items():
    client_totals.append({
        "name": name,
        "projects": len(items),
        "submitted": round(sum(p["submitted"] for p in items), 1),
        "approved": round(sum(p["approved"] for p in items), 1),
    })

top_reductions = sorted(projects, key=lambda p: p["reduction"], reverse=True)

data = {
    "meta": {
        "brand": "中通服项目评审工作台",
        "owner": "中通服评审中心",
        "batch": "2026 年第三季度信息化项目评审（合成）",
        "clients": "广东省财政厅及地市财政 · 南方电网 · 广东烟草",
        "date": "2026-10-19",
        "version": "v1.0",
        "note": "本批项目、单位、金额、功能点和专家意见均为合成示例，仅用于演示，不对应真实项目。",
    },
    "stages": STAGES,
    "stats": {
        "projects": len(projects),
        "submitted": submitted,
        "approved": approved,
        "reduction": reduction,
        "rate": rate,
        "highRisk": high_risk,
        "kbHit": 82,
        "evidence": 96,
    },
    "projects": projects,
    "categoryTotals": cat_totals,
    "clientTotals": client_totals,
    "topReductions": [{"id": p["id"], "name": p["name"], "reduction": p["reduction"], "rate": p["rate"]} for p in top_reductions],
    "commonIssues": common_issues,
    "actions": actions,
    "knowledge": knowledge,
}

OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", OUT, len(OUT.read_text(encoding="utf-8")), "chars")
print("stats", data["stats"])
for p in projects:
    print(p["id"], p["category"], p["method"], p["submitted"], p["firstApproved"], p["approved"], p["rate"], p["riskKey"], len(p["functions"]), len(p["costItems"]), len(p["techIssues"]), len(p["versions"]))
print("categoryTotals", data["categoryTotals"])
print("clientTotals", data["clientTotals"])
