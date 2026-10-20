const DATA = __DATA__;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => Number(v).toLocaleString("zh-CN", { maximumFractionDigits: 1 });
const money = (v) => `${num(v)} 万`;
const pct = (v) => `${Number(v).toFixed(1)}%`;
const cutText = (v) => Number(v) > 0 ? `-${money(v)}` : "0 万";
const stageLine = (p) => p.statusLabel.indexOf(p.stage) === 0 ? p.statusLabel : `${p.stage} · ${p.statusLabel}`;
const projectById = (id) => DATA.projects.find((p) => p.id === id);
const latestVersion = (p) => p.versions[p.versions.length - 1];
const signedNum = (d) => (d <= 0 ? num(d) : `+${num(d)}`);
const stageState = (p, i) => i < p.stageIndex ? "done" : i === p.stageIndex ? "current" : "todo";
const TYPE_TONE = { ILF: "violet", EIF: "blue", EI: "green", EO: "amber", EQ: "slate" };
const KPI_GRID_COMPACT = `style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-top:0;"`;

const state = {
  decisions: {},
  techStatus: {},
  filters: { fpAdj: "all", fpType: "all", techProject: "all", techSeverity: "all" },
  drawer: null,
  drawerTrigger: null,
  tour: { active: false, step: 0 },
  kbQ: 0,
  version: {},
  lastRoute: "",
  intake: [],
  intakeProject: "",
};

function amountCell(label, value, style = "", strongClass = "") {
  return `<div class="drawer-amount"><span>${esc(label)}</span><strong${style ? ` style="${style}"` : ""}${strongClass ? ` class="${strongClass}"` : ""}>${value}</strong></div>`;
}
function badge(label, tone) { return `<span class="badge tone-${esc(tone || "slate")}">${esc(label)}</span>`; }
function riskBadge(p) { return badge(`风险 ${p.risk}`, p.riskKey === "high" ? "red" : p.riskKey === "mid" ? "amber" : "green"); }
function statusBadge(p) { return badge(p.statusLabel, p.statusTone || "blue"); }
function typeBadge(t) {
  if (!t || t === "—") return `<span class="badge tone-slate">—</span>`;
  if (String(t).indexOf("不计") === 0) return `<span class="badge tone-red">${esc(t)}</span>`;
  return `<span class="badge tone-${TYPE_TONE[t] || "slate"}">${esc(t)}</span>`;
}
function severityBadge(s) { return badge(s, s === "高" ? "red" : s === "中" ? "amber" : "slate"); }
function techStatusBadge(t) { const st = effectiveTechStatus(t); return badge(st, st === "已闭环" ? "green" : "amber"); }
function decisionBadge(d) {
  const tone = d === "已采纳" ? "green" : d === "已驳回" ? "red" : "amber";
  return `<span class="badge decision-${tone === "green" ? "ok" : tone === "amber" ? "wait" : "no"}">${esc(d || "待确认")}</span>`;
}
function effectiveDecision(p, f) { return state.decisions[`${p.id}:${f.id}`] || f.decision; }
function effectiveTechStatus(t) { return state.techStatus[t.id] || t.status; }
function demoChanged() { return Object.keys(state.decisions).length > 0 || Object.keys(state.techStatus).length > 0; }

function railHtml(p) {
  return `<div class="rail" aria-label="评审进度">${DATA.stages.map((s, i) => {
    const st = stageState(p, i);
    return `<div class="rail-step ${st}"><span class="rail-dot"></span><span class="rail-label" title="${esc(s)}">${esc(s)}</span></div>`;
  }).join("")}</div>`;
}
function stageTimeline(p) {
  return `<div class="stage-timeline">${DATA.stages.map((s, i) => {
    const st = stageState(p, i);
    const color = st === "done" ? "var(--green)" : st === "current" ? "var(--blue)" : "var(--muted-2)";
    return `<div class="stage-card" style="border-top-color:${color}">
      <div class="stage-no">0${i + 1}</div>
      <div class="stage-name">${esc(s)}</div>
      <div class="stage-date">${st === "done" ? "已完成" : st === "current" ? "当前阶段" : "待开始"}</div>
      <div class="stage-status" style="color:${color}">${p.stage === s ? esc(p.statusLabel) : ""}</div>
    </div>`;
  }).join("")}</div>`;
}
function pageHead(title, sub, actions) {
  return `<div class="page-head"><div><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p></div><div class="page-actions">${actions || ""}</div></div>`;
}
function sectionHead(title, hint, extra) {
  return `<div class="section-head"><div><h2>${esc(title)}</h2>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</div>${extra || ""}</div>`;
}
function kpi(label, value, small, tone, go) {
  return `<div class="kpi ${tone ? "tone-" + tone : ""}" ${go ? `data-go="${go}" role="button" tabindex="0"` : ""}>
    <span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(small)}</small>
  </div>`;
}
function barRow(label, approved, submitted) {
  const ratio = submitted ? Math.max(2, approved / submitted * 100) : 0;
  return `<div class="bar-row"><div class="bar-label">${esc(label)}</div><div class="bar-track"><div class="bar-fill" style="width:${ratio}%"></div></div><div class="bar-text">${num(approved)} / ${num(submitted)} 万</div></div>`;
}

function projectCard(p) {
  const accent = p.riskKey === "high" ? "accent-high" : p.riskKey === "mid" ? "accent-mid" : "";
  return `<article class="project-card ${accent}" data-go="project/${p.id}/overview" tabindex="0" role="button" aria-label="打开项目 ${esc(p.name)}">
    <div class="card-top"><div><span class="project-code">${esc(p.client)} · ${esc(p.category)}</span><h3>${esc(p.name)}</h3><p class="applicant">${esc(p.owner)}</p><div class="method-line">${esc(p.method)}</div></div>${statusBadge(p)}</div>
    <div class="card-meta">
      <div><span>送审</span><strong>${money(p.submitted)}</strong></div>
      <div><span>审定</span><strong>${money(p.approved)}</strong></div>
      <div><span>审减</span><strong class="reduction">${money(p.reduction)}</strong></div>
      <div><span>审减率</span><strong class="rate-value">${pct(p.rate)}</strong></div>
    </div>
    ${railHtml(p)}
    <div class="card-foot"><span>${esc(p.next)}</span><span>打开卷宗 ›</span></div>
  </article>`;
}

/* ------------------------------------------------------------------ overview */
function overviewBanner(s) {
  return `<div class="info-banner"><b>本批结论：</b>6 个项目，送审 ${money(s.submitted)}，审定 ${money(s.approved)}，审减 <b>${money(s.reduction)}（${pct(s.rate)}）</b>。A 项目功能点审核 558 → 269 → 193 万，是本次演示主线；F 项目展示南网五点法。</div>`;
}
function overviewKpiGrid(s) {
  return `<div class="kpi-grid" id="kpiGrid">
      ${kpi("本批项目", s.projects, "财政 / 南网 / 烟草", "", "projects")}
      ${kpi("送审金额", `${num(s.submitted)} 万`, "6 个项目合计", "", "projects")}
      ${kpi("审定金额", `${num(s.approved)} 万`, `审减 ${num(s.reduction)} 万`, "green", "audit/A")}
      ${kpi("审减率", pct(s.rate), "按送审额计算", "amber", "audit/A")}
      ${kpi("高风险项目", s.highRisk, "A 功能点 / D 运营", "warn", "tech")}
      ${kpi("知识库命中", `${s.kbHit}%`, "依据覆盖率 96%", "green", "kb")}
    </div>`;
}
function overviewTopPanels(top) {
  const soft = DATA.categoryTotals.find((c) => c.name === "软件开发") || { submitted: 0, approved: 0 };
  return `<div class="grid-3">
      <section class="panel">
        <div class="panel-head"><h2>类别分布</h2><span class="hint">审定 / 送审</span></div>
        ${DATA.categoryTotals.map((c) => barRow(c.name, c.approved, c.submitted)).join("")}
        <p class="mini-chart-note">软件类送审 ${num(soft.submitted)} 万、审定 ${num(soft.approved)} 万，是本批审减的主要来源。</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>业主分布</h2><span class="hint">财政 / 南网 / 烟草</span></div>
        ${DATA.clientTotals.map((c) => barRow(`${c.name}（${c.projects}）`, c.approved, c.submitted)).join("")}
        <p class="mini-chart-note">财政体系 4 个项目；南网、烟草各 1 个，用于展示五点法和第三方服务口径。</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>审减 TOP 5</h2><span class="hint">按审减金额</span></div>
        <div class="priority">${top.map((p) => `<div class="priority-row" role="button" tabindex="0" data-go="project/${p.id}/overview"><div class="priority-main"><div class="priority-title">项目 ${p.id} · ${esc(p.name)}</div><div class="priority-sub">审减 ${money(p.reduction)} · ${pct(p.rate)}</div></div><span class="priority-date">${money(p.reduction)}</span></div>`).join("")}</div>
      </section>
    </div>`;
}
function overviewIssuePanels(high, pending) {
  return `<div class="grid-2">
      <section class="panel">
        <div class="panel-head"><h2>共性问题</h2><span class="hint">本批 ${DATA.commonIssues.length} 条</span></div>
        <div class="common-list">${DATA.commonIssues.map((c, i) => `<div class="common-item"><span class="common-no">${i + 1}</span><div><strong>${esc(c.title)}</strong><p>${esc(c.text)}</p></div></div>`).join("")}</div>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>高风险与待复核</h2><span class="hint">按风险 / 阶段</span></div>
        <div class="priority">${[...high, ...pending.filter((p) => !high.includes(p))].slice(0, 6).map((p) => `<div class="priority-row" role="button" tabindex="0" data-go="project/${p.id}/overview"><div class="priority-main"><div class="priority-title">项目 ${p.id} · ${esc(p.name)}</div><div class="priority-sub">${esc(p.category)} · ${esc(p.statusLabel)} · ${riskBadge(p)}</div></div><span class="priority-date">${pct(p.rate)}</span></div>`).join("")}</div>
        <p class="mini-chart-note">高风险：A 功能点过度拆分、D 运营人头与绩效；待复核：B/C 内部复核、F 专家会。</p>
      </section>
    </div>`;
}
function overviewActionsPanel(actions) {
  return `<section class="panel">
      <div class="panel-head"><h2>最近动作</h2><span class="hint">按时间倒序</span></div>
      <div class="table-wrap"><table><thead><tr><th>时间</th><th>项目</th><th>环节</th><th>动作</th><th>执行角色</th><th>结果</th></tr></thead><tbody>
        ${actions.map((a) => `<tr><td class="cell-nowrap">${esc(a.time)}</td><td class="cell-project">${esc(a.project)}</td><td class="cell-nowrap">${esc(a.stage)}</td><td>${esc(a.action)}</td><td>${esc(a.actor)}</td><td>${esc(a.result)}</td></tr>`).join("")}
      </tbody></table></div>
    </section>`;
}
function overviewMethodPanel() {
  return `<section class="panel">
      <div class="panel-head"><h2>审核方法</h2><span class="hint">四条线，四种口径</span></div>
      <div class="method-strip">
        <span class="method-chip"><b>财政两点法</b> ILF 35 / EIF 15 → 人月</span>
        <span class="method-chip"><b>南网五点法</b> ILF/EIF/EI/EO/EQ → ×1.39 → 2600 元/人天</span>
        <span class="method-chip"><b>采购价 + 合同</b> 基础设施 / 租用软件</span>
        <span class="method-chip"><b>运维比例</b> 保修期内 8% / 外 6.5%</span>
        <span class="method-chip"><b>运营人天</b> 人头 + 工作量 + 专家判断</span>
      </div>
      <p class="mini-chart-note">知识库：标准规范 12 份、历史案例 86 个、会议纪要 24 份、价格库 1,240 条；AI 建议必须带引用，人确认后才进入审定表。</p>
    </section>`;
}
function renderOverview() {
  const s = DATA.stats;
  const high = DATA.projects.filter((p) => p.riskKey === "high");
  const pending = DATA.projects.filter((p) => p.stageIndex < 5);
  const top = DATA.topReductions.slice(0, 5);
  const actions = DATA.actions.slice(0, 6);
  return `${pageHead("财政评审批次总览", `${DATA.meta.batch} · 数据截至 ${DATA.meta.date}`, `
      <button class="btn btn-primary" data-action="start-tour">▶ 开始 5 分钟导览</button>
      <button class="btn btn-ghost" data-go="audit/A">查看审定表</button>`)}
    ${overviewBanner(s)}
    ${overviewKpiGrid(s)}
    ${sectionHead("项目卷宗", "6 个项目 · 点击打开卷宗")}
    <div class="project-grid">${DATA.projects.map(projectCard).join("")}</div>
    ${overviewTopPanels(top)}
    ${overviewIssuePanels(high, pending)}
    ${overviewActionsPanel(actions)}
    ${overviewMethodPanel()}`;
}

/* ------------------------------------------------------------------ projects */
function renderProjects() {
  return `${pageHead("项目卷宗", `${DATA.stats.projects} 个项目，送审 ${num(DATA.stats.submitted)} 万，审定 ${num(DATA.stats.approved)} 万；点击卡片打开卷宗。`, `<button class="btn btn-ghost" data-action="start-tour">▶ 演示导览</button>`)}
    <div class="project-grid">${DATA.projects.map(projectCard).join("")}</div>
    <section class="panel">
      <div class="panel-head"><h2>项目对比</h2><span class="hint">按审减金额排序</span></div>
      <div class="table-wrap"><table><thead><tr><th>项目</th><th>业主</th><th>类别</th><th>方法</th><th>送审</th><th>审定</th><th>审减</th><th>风险</th><th>阶段</th></tr></thead><tbody>
        ${DATA.projects.slice().sort((a, b) => b.reduction - a.reduction).map((p) => `<tr class="row-open" tabindex="0" data-go="project/${p.id}/overview"><td class="cell-project">${p.id} · ${esc(p.name)}</td><td>${esc(p.client)}</td><td>${esc(p.category)}</td><td>${esc(p.method)}</td><td class="num">${money(p.submitted)}</td><td class="num">${money(p.approved)}</td><td class="num reduction">${money(p.reduction)} / ${pct(p.rate)}</td><td>${riskBadge(p)}</td><td class="cell-nowrap">${statusBadge(p)}</td></tr>`).join("")}
      </tbody></table></div>
    </section>`;
}

/* ------------------------------------------------------------------ project */
function projectTabs(p) {
  return [
    ["overview", "概览"],
    ["materials", "材料"],
    ["detail", p.functions.length ? "功能点" : "费用明细"],
    ["tech", "技术评审"],
    ["versions", "版本"],
    ["audit", "审定表"],
  ];
}
function renderProject(id, tab) {
  const p = projectById(id);
  if (!p) return `<div class="empty">未找到该项目。</div>`;
  const tabs = projectTabs(p);
  const currentTab = tabs.some(([k]) => k === tab) ? tab : "overview";
  let body = "";
  if (currentTab === "materials") body = renderMaterials(p);
  else if (currentTab === "detail") body = p.functions.length ? fpPanel(p) : costPanel(p);
  else if (currentTab === "tech") body = techPanel(p);
  else if (currentTab === "versions") body = versionsPanel(p);
  else if (currentTab === "audit") body = `<div class="section-head" style="margin-top:0"><h2>审定表</h2><span class="hint">定稿版 · 只出表，不提整改建议</span></div>${auditTable(p)}`;
  else body = projectOverview(p);
  return `
  <div class="detail-top">
    <button class="back-link" data-go="projects">← 返回项目卷宗</button>
    <div class="project-switch">${DATA.projects.map((x) => `<button class="filter-chip ${x.id === p.id ? "active" : ""}" data-go="project/${x.id}/${currentTab}">项目 ${x.id}</button>`).join("")}</div>
  </div>
  <div id="projectHeader">
    <div class="detail-head">
      <div><span class="project-code">${esc(p.client)} · ${esc(p.category)} · ${esc(p.method)}</span><h1>${esc(p.name)}</h1><p class="detail-sub">${esc(p.owner)} · 评审组：${esc(p.reviewer)} · 专家：${esc(p.expert)}</p></div>
      <div class="detail-badges">${statusBadge(p)} ${riskBadge(p)}</div>
    </div>
    <div class="detail-meta">
      <div><span>送审</span><strong>${money(p.submitted)}</strong></div>
      <div><span>初稿 / 定稿</span><strong>${money(p.firstApproved)} / ${money(p.approved)}</strong></div>
      <div><span>审减</span><strong class="reduction">${money(p.reduction)}（${pct(p.rate)}）</strong></div>
      <div><span>当前阶段</span><strong>${esc(stageLine(p))}</strong></div>
      <div><span>业主</span><strong>${esc(p.client)}</strong></div>
      <div><span>项目单位</span><strong>${esc(p.owner)}</strong></div>
      <div><span>版本</span><strong>${p.versions.length} 版 · 当前 ${latestVersion(p).id}</strong></div>
      <div><span>更新日期</span><strong>${esc(p.updated)}</strong></div>
    </div>
    ${stageTimeline(p)}
  </div>
  <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${currentTab === k ? "active" : ""}" data-go="project/${p.id}/${k}">${l}</button>`).join("")}</div>
  ${body}`;
}

function projectJudgmentPanel(p) {
  return `<section class="panel">
      <div class="panel-head"><h2>项目判断</h2><span class="hint">${esc(p.id)} · ${esc(p.category)}</span></div>
      <p style="color:var(--ink-2);font-size:11.8px;line-height:1.7;">${esc(p.summary)}</p>
      <div style="border-left:2px solid var(--blue);padding-left:10px;margin-top:12px;"><span class="small muted">审定结论</span><p style="font-size:11.6px;line-height:1.65;margin:2px 0 0;">${esc(p.conclusion)}</p></div>
      <div style="border-left:2px solid var(--amber);padding-left:10px;margin-top:10px;"><span class="small muted">下一步</span><p style="font-size:11.6px;line-height:1.65;margin:2px 0 0;">${esc(p.next)}</p></div>
    </section>`;
}
function projectKeyAdjustPanel(p, keyRows) {
  return `<section class="panel">
      <div class="panel-head"><h2>关键调整</h2><span class="hint">点击看依据</span></div>
      <div class="issue-list">${keyRows.map((r) => {
        const isFp = !!r.proposedType;
        const cut = isFp ? (r.submittedAmount - r.approvedAmount) : (r.submitted - r.approvedAmount);
        return `<div class="issue-card" ${isFp ? `data-open-fp="${p.id}|${r.id}"` : `data-open-cost="${p.id}|${r.id}"`} role="button" tabindex="0">
          <div class="issue-card-top"><div><h4>${esc(r.name)}</h4><div class="issue-meta">${isFp ? typeBadge(r.proposedType) + typeBadge(r.approvedType) : riskBadge(p)}<span class="mini-pill">${esc(r.adjustment)}</span></div></div><span class="small reduction">${cutText(cut)}</span></div>
          <div class="issue-text">${esc(r.reason)}</div>
        </div>`;
      }).join("")}</div>
    </section>`;
}
function projectAiPanel(p, accepted, waiting, rejected) {
  return `<section class="panel">
      <div class="panel-head"><h2>AI 建议 / 人工确认</h2><span class="hint">${p.functions.length ? "功能点审核" : "费用审核"}</span></div>
      ${p.functions.length ? `<div class="grid-2" style="gap:8px;">
        ${amountCell("已采纳", accepted, "color:var(--green)")}
        ${amountCell("待确认", waiting, "color:var(--amber)")}
        ${amountCell("已驳回", rejected, "color:var(--red)")}
        ${amountCell("功能项", `${p.functions.length} / ${p.fpSummary.items}`)}
      </div><p class="mini-chart-note">泛泛地问大模型，5 个答案可能有 3 个说“不是”；建议必须带标准条款 + 历史案例。采纳/驳回由评审人操作，驳回后转人工复核，不自动改金额。</p>` : `<p class="mini-chart-note">费用审核以采购价、合同、历史价为依据；AI 只做价格比对和条款抽取，不替评审人下结论。</p>`}
    </section>`;
}
function projectTechPanel(p, highTech) {
  return `<section class="panel">
      <div class="panel-head"><h2>技术评审</h2><span class="hint">高风险 ${highTech.length} 项</span></div>
      <div class="issue-list">${p.techIssues.slice(0, 3).map((t) => `<div class="issue-card" data-open-tech="${p.id}|${t.id}" role="button" tabindex="0"><div class="issue-card-top"><div><h4>${esc(t.finding)}</h4><div class="issue-meta">${severityBadge(t.severity)}<span class="mini-pill">${esc(t.category)}</span>${techStatusBadge(t)}</div></div><span class="small muted">›</span></div></div>`).join("")}</div>
    </section>`;
}
function projectMaterialsPanel(p) {
  return `<section class="panel" style="margin-top:12px;">
    <div class="panel-head"><h2>材料与依据</h2><span class="hint">${p.materials.length} 份</span></div>
    <div class="source-links">${p.materials.map((m) => `<span class="source-link">${esc(m.name)} · ${m.pages}${m.type === "Excel" ? " 项" : " 页"} · ${esc(m.ocr)}</span>`).join("")}</div>
  </section>`;
}
function projectOverview(p) {
  const fns = p.functions.slice().sort((a, b) => (b.submittedAmount - b.approvedAmount) - (a.submittedAmount - a.approvedAmount)).slice(0, 4);
  const items = p.costItems.slice().sort((a, b) => (b.submitted - b.approvedAmount) - (a.submitted - a.approvedAmount)).slice(0, 4);
  const keyRows = p.functions.length ? fns : items;
  const highTech = p.techIssues.filter((t) => t.severity === "高");
  const decisions = p.functions.map((f) => effectiveDecision(p, f));
  const accepted = decisions.filter((d) => d === "已采纳").length;
  const waiting = decisions.filter((d) => d === "待确认").length;
  const rejected = decisions.filter((d) => d === "已驳回").length;
  return `<div class="grid-2">
    ${projectJudgmentPanel(p)}
    ${projectKeyAdjustPanel(p, keyRows)}
  </div>
  <div class="grid-2" style="margin-top:12px;">
    ${projectAiPanel(p, accepted, waiting, rejected)}
    ${projectTechPanel(p, highTech)}
  </div>
  ${projectMaterialsPanel(p)}`;
}

function renderMaterials(p) {
  return `<section class="panel">
    <div class="panel-head"><h2>材料清单</h2><span class="hint">${p.materials.length} 份 · 已解析 / OCR / 转写</span></div>
    <div class="table-wrap"><table><thead><tr><th>序号</th><th>材料</th><th>类型</th><th>页数 / 项数</th><th>解析状态</th><th>说明</th></tr></thead><tbody>
      ${p.materials.map((m, i) => `<tr><td class="cell-nowrap">${i + 1}</td><td><strong>${esc(m.name)}</strong></td><td class="cell-nowrap">${esc(m.type)}</td><td class="cell-nowrap">${m.pages}</td><td class="cell-nowrap">${badge(m.ocr, "green")}</td><td>${esc(m.note)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="table-note">材料解析是知识库的入口：Excel 抽功能点/费用项，PDF 走 OCR，会议录音走转写。</p>
  </section>`;
}

/* ------------------------------------------------------------------ function points */
function twoPointRows(p, includeOther = true) {
  const rows = p.functions.slice();
  if (includeOther) {
    const sum = (key) => rows.reduce((n, r) => n + (r[key] || 0), 0);
    rows.push({
      id: `${p.id}-OTHER`, name: `其他 ${p.fpSummary.items - p.functions.length} 项（合并后）`,
      proposedType: "—", approvedType: "—", rawFP: p.fpSummary.submittedFP - sum("rawFP"),
      firstFP: p.fpSummary.firstFP - sum("firstFP"), approvedFP: p.fpSummary.approvedFP - sum("approvedFP"),
      submittedAmount: p.submitted - sum("submittedAmount"), firstAmount: p.firstApproved - sum("firstAmount"),
      approvedAmount: p.approved - sum("approvedAmount"), adjustment: "汇总项",
      reason: "其余功能项合并/删除后的汇总，明细见项目卷宗。",
      basis: { source: "汇总", clause: "—", excerpt: "—" }, caseRef: "—",
      aiSuggestion: "—", confidence: null, decision: "—",
    });
  }
  return rows;
}
function fpFilteredRows(p) {
  let rows = p.functions.slice();
  if (p.methodKey === "two") rows = rows.concat(twoPointRows(p).filter((r) => r.id.endsWith("-OTHER")));
  if (state.filters.fpAdj !== "all") rows = rows.filter((r) => r.adjustment === state.filters.fpAdj);
  if (state.filters.fpType !== "all") rows = rows.filter((r) => r.proposedType === state.filters.fpType || r.approvedType === state.filters.fpType);
  return rows;
}
function fpSummaryCards(p) {
  return `<div class="kpi-grid" ${KPI_GRID_COMPACT}>
    ${kpi("送审", money(p.submitted), `${p.fpSummary.submittedFP} FP`, "", "")}
    ${kpi("定稿", money(p.approved), `${p.fpSummary.approvedFP} FP`, "green", "")}
    ${kpi("审减", money(p.reduction), pct(p.rate), "warn", "")}
    ${kpi("功能项", `${p.fpSummary.items} → ${p.fpSummary.approvedItems}`, `过度拆分 ${p.fpSummary.overSplit} · 改判 ${p.fpSummary.reclass}`, "amber", "")}
  </div>`;
}
function fpPanel(p) {
  const isFive = p.methodKey === "five";
  const adjOptions = ["all", ...Array.from(new Set(p.functions.map((f) => f.adjustment)))];
  const types = isFive ? ["ILF", "EIF", "EI", "EO", "EQ"] : ["ILF", "EIF"];
  if (!adjOptions.includes(state.filters.fpAdj)) state.filters.fpAdj = "all";
  if (!["all", ...types].includes(state.filters.fpType)) state.filters.fpType = "all";
  const rows = p.functions.length ? fpFilteredRows(p) : [];
  const sums = rows.reduce((acc, r) => {
    acc.raw += r.rawFP || 0; acc.first += r.firstFP || 0; acc.approved += r.approvedFP || 0;
    acc.submitted += r.submittedAmount || 0; acc.firstAmt += r.firstAmount || 0; acc.approvedAmt += r.approvedAmount || 0;
    return acc;
  }, { raw: 0, first: 0, approved: 0, submitted: 0, firstAmt: 0, approvedAmt: 0 });
  return `<div id="fpSummary">${fpSummaryCards(p)}</div>
    <section class="panel">
      <div class="panel-head"><h2>${isFive ? "南网五点法" : "财政两点法"} · 功能点审核</h2><span class="hint">${esc(p.fpSummary.unit)}</span></div>
      <div class="filters">
        <select class="select" data-select="fpAdj" aria-label="调整类型"><option value="all">全部调整类型</option>${adjOptions.filter((a) => a !== "all").map((a) => `<option value="${esc(a)}" ${state.filters.fpAdj === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>
        <button class="filter-chip ${state.filters.fpType === "all" ? "active" : ""}" data-filter="fpType" data-value="all">全部类型</button>
        ${types.map((t) => `<button class="filter-chip ${state.filters.fpType === t ? "active" : ""}" data-filter="fpType" data-value="${t}">${t}</button>`).join("")}
        <span class="small muted" style="margin-left:4px;">${rows.length} 行</span>
      </div>
      ${isFive ? fivePointTable(p, rows, sums) : twoPointTable(p, rows, sums)}
      <p class="table-note">${isFive ? "五点法：功能点 × 权重 → 调整 FP（×1.39）→ 人天 → 2600 元/人天；参数为演示值，可按客户规则配置。" : "两点法：只计 ILF / EIF（可研权重 ILF 35 / EIF 15）；报表、统计、适配等事务功能不计。关键词判类不可靠，要回标准定义 + 历史案例。金额 = 功能点 × 综合单价（演示值）。"}</p>
    </section>`;
}
function fpEmptyRow(cols) {
  return `<tr><td colspan="${cols}" class="empty">当前筛选没有匹配的功能点；可放宽「调整类型」或类型筛选后重试。</td></tr>`;
}
function twoPointTable(p, rows, sums) {
  return `<div class="table-wrap"><table class="table-compact" id="fpTable"><thead><tr><th>编号</th><th>功能项</th><th>送审类型</th><th>审定类型</th><th class="num">送审 FP</th><th class="num">审定 FP</th><th class="num">送审</th><th class="num">初稿</th><th class="num">定稿</th><th class="num">审减</th><th>调整原因</th><th>AI 建议 / 决策</th></tr></thead><tbody>
    ${rows.length === 0 ? fpEmptyRow(12) : rows.map((r) => { const other = r.id.endsWith("-OTHER"); return `<tr class="${other ? "" : "row-open"}" ${other ? "" : `tabindex="0" data-open-fp="${p.id}|${r.id}"`}>
      <td class="cell-nowrap">${esc(r.id)}</td><td><strong>${esc(r.name)}</strong><div class="small muted">${esc(r.desc || "")}</div></td>
      <td class="cell-nowrap">${typeBadge(r.proposedType)}</td><td class="cell-nowrap">${typeBadge(r.approvedType)}</td>
      <td class="num">${num(r.rawFP)}</td><td class="num">${num(r.approvedFP)}</td>
      <td class="num">${money(r.submittedAmount)}</td><td class="num">${money(r.firstAmount)}</td><td class="num amount-strong">${money(r.approvedAmount)}</td>
      <td class="num reduction">${cutText((r.submittedAmount || 0) - (r.approvedAmount || 0))}</td>
      <td>${esc(r.adjustment)}</td>
      <td class="cell-nowrap">${r.aiSuggestion && r.aiSuggestion !== "—" ? `<span class="badge ai-badge">AI · ${esc(r.aiSuggestion)}</span>` : "—"} ${r.decision !== "—" ? decisionBadge(effectiveDecision(p, r)) : ""}</td>
    </tr>`; }).join("")}
    <tr class="table-total"><td colspan="4">筛选合计</td><td class="num">${num(sums.raw)}</td><td class="num">${num(sums.approved)}</td><td class="num">${money(sums.submitted)}</td><td class="num">${money(sums.firstAmt)}</td><td class="num">${money(sums.approvedAmt)}</td><td class="num reduction">${cutText(sums.submitted - sums.approvedAmt)}</td><td colspan="2">${state.filters.fpAdj === "all" && state.filters.fpType === "all" ? "与项目合计一致" : "当前筛选结果"}</td></tr>
  </tbody></table></div>`;
}
function fivePointTable(p, rows, sums) {
  return `<div class="table-wrap"><table class="table-compact" id="fpTable"><thead><tr><th>类型</th><th>送审数量</th><th>审定数量</th><th>权重</th><th class="num">送审 FP</th><th class="num">审定 FP</th><th class="num">送审</th><th class="num">初稿</th><th class="num">定稿</th><th>调整</th></tr></thead><tbody>
    ${rows.length === 0 ? fpEmptyRow(10) : rows.map((r) => `<tr class="row-open" tabindex="0" data-open-fp="${p.id}|${r.id}">
      <td><strong>${esc(r.proposedType)}</strong><div class="small muted">${esc(r.name)}</div></td>
      <td class="num">${r.quantity}</td><td class="num">${r.approvedQty}</td><td class="num">${r.weight}</td>
      <td class="num">${num(r.rawFP)}</td><td class="num">${num(r.approvedFP)}</td>
      <td class="num">${money(r.submittedAmount)}</td><td class="num">${money(r.firstAmount)}</td><td class="num amount-strong">${money(r.approvedAmount)}</td>
      <td>${esc(r.adjustment)}</td>
    </tr>`).join("")}
    <tr class="table-total"><td colspan="4">合计</td><td class="num">${num(sums.raw)}</td><td class="num">${num(sums.approved)}</td><td class="num">${money(sums.submitted)}</td><td class="num">${money(sums.firstAmt)}</td><td class="num">${money(sums.approvedAmt)}</td><td>—</td></tr>
  </tbody></table></div>
  <div class="calc-row" style="margin-top:10px;">
    <div class="calc-step"><span>审定功能点</span><strong>${p.fpSummary.approvedFP} FP</strong><em>五点法合计</em></div>
    <div class="calc-step"><span>调整系数</span><strong>× ${p.fpSummary.coefficient}</strong><em>需求不确定系数</em></div>
    <div class="calc-step"><span>调整后 FP</span><strong>${num(p.fpSummary.adjustedFP)}</strong><em>FP × 1.39</em></div>
    <div class="calc-step"><span>通用性系数</span><strong>× 1.0</strong><em>通用 / 定制（演示）</em></div>
    <div class="calc-step"><span>人天单价</span><strong>${num(p.fpSummary.unitPrice)} 元</strong><em>元/人天</em></div>
    <div class="calc-step"><span>折算投资</span><strong>${money(Math.round(p.fpSummary.personDays * p.fpSummary.unitPrice / 10000 * 10) / 10)}</strong><em>人天 × 单价</em></div>
  </div>`;
}

/* ------------------------------------------------------------------ cost */
function costMetric(p) {
  const map = {
    B: ["采购价证据", "4 项", "合同缺页 1 项"],
    C: ["运维基数", "1,500 万", "比例 8% → 6.5%"],
    D: ["人员配置", "12 → 9 人", "人天单价 2,600 元"],
    E: ["合同 / 市场价", "3 + 3 项", "培训 80 → 60 人"],
  };
  return map[p.id] || ["审核口径", "—", "—"];
}
function costPanel(p) {
  const m = costMetric(p);
  return `<div class="kpi-grid" ${KPI_GRID_COMPACT}>
    ${kpi("送审", money(p.submitted), `${p.costItems.length} 项`, "", "")}
    ${kpi("定稿", money(p.approved), pct(p.rate), "green", "")}
    ${kpi("审减", money(p.reduction), "按依据审减", "warn", "")}
    ${kpi(m[0], m[1], m[2], "amber", "")}
  </div>
  <section class="panel">
    <div class="panel-head"><h2>费用审核</h2><span class="hint">${esc(p.method)}</span></div>
    <div class="table-wrap"><table class="table-compact" id="costTable"><thead><tr><th>编号</th><th>费用项</th><th>规格 / 数量</th><th class="num">送审</th><th class="num">初稿</th><th class="num">定稿</th><th class="num">审减</th><th>价格来源</th><th>调整原因</th></tr></thead><tbody>
      ${p.costItems.map((c) => `<tr class="row-open" tabindex="0" data-open-cost="${p.id}|${c.id}"><td class="cell-nowrap">${esc(c.id)}</td><td><strong>${esc(c.name)}</strong><div class="small muted">${esc(c.spec)} · ${c.qty}${esc(c.unit)}</div></td><td>${esc(c.spec)}<div class="small muted">${c.qty} ${esc(c.unit)} × ${num(c.unitPrice)} 万</div></td><td class="num">${money(c.submitted)}</td><td class="num">${money(c.firstAmount)}</td><td class="num amount-strong">${money(c.approvedAmount)}</td><td class="num reduction">${cutText(c.submitted - c.approvedAmount)}</td><td>${esc(c.priceSource)}</td><td>${esc(c.adjustment)}<div class="small muted">${esc(c.reason)}</div></td></tr>`).join("")}
      <tr class="table-total"><td colspan="3">合计</td><td class="num">${money(p.submitted)}</td><td class="num">${money(p.firstApproved)}</td><td class="num">${money(p.approved)}</td><td class="num reduction">${cutText(p.reduction)}</td><td colspan="2">${pct(p.rate)}</td></tr>
    </tbody></table></div>
    <p class="table-note">${esc(p.conclusion)}</p>
  </section>`;
}

/* ------------------------------------------------------------------ tech */
function allTechIssues() {
  return DATA.projects.flatMap((p) => p.techIssues.map((t) => Object.assign({}, t, { projectId: p.id, projectName: p.name })));
}
function techPanel(p) {
  const issues = p.techIssues;
  return techTable(issues, p.id);
}
function techTable(issues, projectId) {
  const high = issues.filter((t) => t.severity === "高").length;
  const open = issues.filter((t) => effectiveTechStatus(t) !== "已闭环").length;
  return `<div class="kpi-grid" ${KPI_GRID_COMPACT}>
    ${kpi("技术问题", issues.length, "形式 / 架构 / 一致性 / 绩效", "", "")}
    ${kpi("高风险", high, "优先处理", "warn", "")}
    ${kpi("待修改 / 待补正", open, "未闭环", "amber", "")}
    ${kpi("已闭环", issues.length - open, "已复核", "green", "")}
  </div>
  <section class="panel">
    <div class="panel-head"><h2>技术评审问题</h2><span class="hint">点击查看证据和状态</span></div>
    <div class="table-wrap"><table class="table-compact" id="techTable"><thead><tr><th>编号</th><th>项目</th><th>类别</th><th>严重度</th><th>问题</th><th>证据</th><th>状态</th></tr></thead><tbody>
      ${issues.length === 0 ? `<tr><td colspan="7" class="empty">没有符合当前筛选条件的技术评审问题；可放宽项目或严重度筛选。</td></tr>` : issues.map((t) => `<tr class="row-open" tabindex="0" data-open-tech="${projectId || t.projectId}|${t.id}"><td class="cell-nowrap">${esc(t.id)}</td><td class="cell-project">${esc(projectId || t.projectId)}</td><td class="cell-nowrap">${esc(t.category)}</td><td>${severityBadge(t.severity)}</td><td>${esc(t.finding)}</td><td class="small muted">${esc(t.evidence)}</td><td>${techStatusBadge(t)}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="table-note">技术评审看形式与实质：立项函/公章/材料/模板，现状-问题-需求-预算自洽，六类架构，绩效指标是否合常识。</p>
  </section>`;
}
function renderTech() {
  const all = allTechIssues();
  let issues = all;
  if (state.filters.techProject !== "all") issues = issues.filter((t) => t.projectId === state.filters.techProject);
  if (state.filters.techSeverity !== "all") issues = issues.filter((t) => t.severity === state.filters.techSeverity);
  return `${pageHead("技术评审", `${all.length} 项问题，覆盖材料、架构、一致性、绩效、价格、合同；按项目和严重度筛选。`, `<button class="btn btn-ghost" data-action="start-tour">▶ 演示导览</button>`)}
    <div class="filters">
      <button class="filter-chip ${state.filters.techProject === "all" ? "active" : ""}" data-filter="techProject" data-value="all">全部项目</button>
      ${DATA.projects.map((p) => `<button class="filter-chip ${state.filters.techProject === p.id ? "active" : ""}" data-filter="techProject" data-value="${p.id}">项目 ${p.id}</button>`).join("")}
      <span style="width:6px;"></span>
      ${["all", "高", "中", "低"].map((s) => `<button class="filter-chip ${state.filters.techSeverity === s ? "active" : ""}" data-filter="techSeverity" data-value="${s}">${s === "all" ? "全部严重度" : s + "风险"}</button>`).join("")}
    </div>
    ${techTable(issues, null)}`;
}

/* ------------------------------------------------------------------ versions */
function versionsPanel(p) {
  const selected = state.version[p.id] || latestVersion(p).id;
  const v = p.versions.find((x) => x.id === selected) || latestVersion(p);
  return `<section class="panel" id="versionTimeline">
    <div class="panel-head"><h2>多轮版本</h2><span class="hint">初稿 → 专家意见 → 修改稿 → 定稿</span></div>
    <div class="version-track">${p.versions.map((x, i) => {
      const prev = p.versions[i - 1];
      const diff = prev ? x.total - prev.total : 0;
      return `<div class="version-card ${x.id === selected ? "active" : ""}" role="button" tabindex="0" data-version="${esc(x.id)}" data-project="${p.id}">
        <div class="v-id">${esc(x.id)} · ${esc(x.date)}</div><div class="v-label">${esc(x.label)}</div>
        <div class="version-total">${num(x.total)} 万</div>
        <div class="version-diff">${prev ? `较上一版 ${signedNum(diff)} 万` : "首次形成"}</div>
      </div>`;
    }).join("")}</div>
    <div class="grid-2" style="margin-top:12px;">
      <div>
        <div class="panel-head"><h2>${esc(v.id)} · ${esc(v.label)}</h2><span class="hint">${esc(v.date)}</span></div>
        <p class="small" style="font-size:11.2px;line-height:1.65;color:var(--ink-2);">${esc(v.note)}</p>
        ${v.comments && v.comments.length ? `<ul class="comment-list">${v.comments.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : `<p class="mini-chart-note">本版无新增专家意见。</p>`}
      </div>
      <div>
        <div class="panel-head"><h2>版本差异</h2><span class="hint">定稿前的变化</span></div>
        <div class="table-wrap"><table class="table-compact"><thead><tr><th>版本</th><th>日期</th><th class="num">总额</th><th class="num">变化</th><th>说明</th></tr></thead><tbody>
          ${p.versions.map((x, i) => { const prev = p.versions[i - 1]; return `<tr><td class="cell-nowrap">${esc(x.id)}</td><td class="cell-nowrap">${esc(x.date)}</td><td class="num">${money(x.total)}</td><td class="num ${prev && x.total < prev.total ? "reduction" : ""}">${prev ? signedNum(x.total - prev.total) : "—"}</td><td>${esc(x.label)}</td></tr>`; }).join("")}
        </tbody></table></div>
        <p class="mini-chart-note">首稿工作量最大；一般修正两版，第二稿基于首稿修正、很少推翻。十条意见只响应一两条要打回，打回稿只看修改部分；大项目来回十次八次。</p>
      </div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ audit table */
function auditRows(p) {
  if (p.functions.length) return p.methodKey === "two" ? twoPointRows(p) : p.functions.slice();
  return p.costItems.map((c) => ({
    id: c.id, name: c.name, spec: c.spec, qty: c.qty, unit: c.unit,
    submittedAmount: c.submitted, firstAmount: c.firstAmount, approvedAmount: c.approvedAmount,
    adjustment: c.adjustment, basis: c.basis,
  }));
}
function auditTable(p) {
  const rows = auditRows(p);
  const isFp = p.functions.length > 0;
  const total = rows.reduce((a, r) => ({ s: a.s + (r.submittedAmount || 0), f: a.f + (r.firstAmount || 0), d: a.d + (r.approvedAmount || 0) }), { s: 0, f: 0, d: 0 });
  return `<section class="panel">
    <div class="panel-head"><h2>${isFp ? "功能点审定表" : "费用审定表"}</h2><span class="hint">${esc(p.id)} · ${esc(p.name)} · 定稿 ${latestVersion(p).id}</span></div>
    <div class="table-wrap"><table class="table-compact" id="auditTable"><thead><tr><th>序号</th><th>${isFp ? "功能项" : "费用项"}</th><th class="num">送审</th><th class="num">初稿</th><th class="num">定稿</th><th class="num">审减</th><th class="num">审减率</th><th>依据</th></tr></thead><tbody>
      ${rows.map((r, i) => { const other = r.id.endsWith("-OTHER"); return `<tr class="${other ? "" : "row-open"}" ${other ? "" : `tabindex="0" ${isFp ? `data-open-fp="${p.id}|${r.id}"` : `data-open-cost="${p.id}|${r.id}"`}`}><td class="cell-nowrap">${i + 1}</td><td><strong>${esc(r.name)}</strong>${r.spec ? `<div class="small muted">${esc(r.spec)}</div>` : ""}</td><td class="num">${money(r.submittedAmount)}</td><td class="num">${money(r.firstAmount)}</td><td class="num amount-strong">${money(r.approvedAmount)}</td><td class="num reduction">${cutText((r.submittedAmount || 0) - (r.approvedAmount || 0))}</td><td class="num">${r.submittedAmount ? pct((r.submittedAmount - r.approvedAmount) / r.submittedAmount * 100) : "—"}</td><td class="small">${esc((r.basis && (r.basis.clause || r.basis.source)) || r.adjustment || "—")}</td></tr>`; }).join("")}
      <tr class="table-total"><td colspan="2">合计</td><td class="num">${money(total.s)}</td><td class="num">${money(total.f)}</td><td class="num">${money(total.d)}</td><td class="num reduction">${cutText(total.s - total.d)}</td><td class="num">${total.s ? pct((total.s - total.d) / total.s * 100) : "—"}</td><td>—</td></tr>
    </tbody></table></div>
    <p class="table-note">审定表只给结论和金额，不提整改建议；甲方按审定价招标。交付：结果件为审定报告（Word + Excel），过程件为初稿表与评审意见；财政评审另需内部流转报告（文字）。金额为合成示例。</p>
  </section>`;
}
function renderAudit(projectId) {
  const p = projectById(projectId) || DATA.projects[0];
  return `${pageHead("审定表", "按项目出 Excel 审定表：送审 / 初稿 / 定稿 / 审减 / 依据；可打印。", `<button class="btn btn-ghost" data-action="print">打印当前审定表</button>`)}
    <div class="filters">${DATA.projects.map((x) => `<button class="filter-chip ${x.id === p.id ? "active" : ""}" data-go="audit/${x.id}">项目 ${x.id}</button>`).join("")}</div>
    <div class="info-banner"><b>${esc(p.name)}</b> · 送审 ${money(p.submitted)} → 定稿 ${money(p.approved)}，审减 <b>${money(p.reduction)}（${pct(p.rate)}）</b>。当前版本 ${latestVersion(p).id}。</div>
    ${auditTable(p)}`;
}

/* ------------------------------------------------------------------ knowledge base */
function renderKB() {
  const kb = DATA.knowledge;
  const q = kb.qa[state.kbQ] || kb.qa[0];
  return `${pageHead("知识库", "标准规范 / 历史案例 / 会议纪要 / 价格库 / 合同库 / 业主模板；每条回答必须带引用。", `<button class="btn btn-ghost" data-action="start-tour">▶ 演示导览</button>`)}
    <div class="source-grid">${kb.sources.map((s) => `<div class="source-card" style="cursor:default;"><div class="source-head"><div><div class="source-name">${esc(s.name)}</div><div class="source-count">${num(s.count)}</div></div>${badge(s.updated, "slate")}</div><div class="source-desc">${esc(s.desc)}</div><div class="source-meta">最近更新 ${esc(s.updated)}</div></div>`).join("")}</div>
    <div class="grid-2" style="margin-top:12px;">
      <section class="panel" id="kbQA">
        <div class="panel-head"><h2>问答：这条结论凭什么？</h2><span class="hint">点击问题看引用</span></div>
        <div>${kb.qa.map((item, i) => `<div class="qa-item ${i === state.kbQ ? "active" : ""}" data-qa="${i}" role="button" tabindex="0"><div class="qa-q">Q：${esc(item.q)}</div>${i === state.kbQ ? `<div class="qa-a">${esc(item.a)}</div><div class="cite-wrap">${item.citations.map((c) => `<span class="cite">${esc(c)}</span>`).join("")}</div>` : ""}</div>`).join("")}</div>
        <p class="table-note">评审是证明题：多数据源证明合理或不合理。标准文件先解决 80–90%，再用历史案例和会议录音补暗知识；审核要点只用最新版。回答必须带引用。</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>知识库怎么工作</h2><span class="hint">本地部署 · 数据不出域</span></div>
        <div class="calc-row">
          <div class="calc-step"><span>1. 入库</span><strong>标准 / 案例 / 纪要</strong><em>Excel/PDF/OCR/ASR</em></div>
          <div class="calc-step"><span>2. 检索</span><strong>关键词 + 向量</strong><em>项目相似度</em></div>
          <div class="calc-step"><span>3. 建议</span><strong>分类 / 依据</strong><em>必须带引用</em></div>
          <div class="calc-step"><span>4. 确认</span><strong>人采纳 / 驳回</strong><em>反馈写回案例库</em></div>
        </div>
        <p class="mini-chart-note">部署：内网 / VPN / 自建 GPU 或可信云；开源模型本地化；前台 Web 工作台内部登录；不依赖公开 IMA 或外部 API。</p>
        <div class="method-strip" style="margin-top:8px;"><span class="method-chip"><b>标准文件</b> 先解决 80–90%</span><span class="method-chip"><b>历史案例</b> 补经验</span><span class="method-chip"><b>会议纪要</b> 补暗知识</span></div>
      </section>
    </div>
    <section class="panel">
      <div class="panel-head"><h2>最近入库</h2><span class="hint">${kb.entries.length} 条示例</span></div>
      <div class="table-wrap"><table><thead><tr><th>编号</th><th>类型</th><th>标题</th><th>来源</th><th>日期</th><th>标签</th></tr></thead><tbody>
        ${kb.entries.map((e) => `<tr class="row-open" tabindex="0" data-open-kb="${e.id}"><td class="cell-nowrap">${esc(e.id)}</td><td class="cell-nowrap">${badge(e.type, e.type === "标准" ? "violet" : e.type === "案例" ? "blue" : e.type === "纪要" ? "amber" : "slate")}</td><td>${esc(e.title)}</td><td>${esc(e.source)}</td><td class="cell-nowrap">${esc(e.date)}</td><td>${e.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</td></tr>`).join("")}
      </tbody></table></div>
    </section>`;
}

/* ------------------------------------------------------------------ architecture */
function archChainBanner() {
  const chain = ["接件", "形式审查", "功能点 / 费用审核", "内部复核", "专家意见", "定稿", "导出审定表"];
  return `<div class="banner"><div class="kicker" style="margin-bottom:7px;">主链路</div><div class="chain">${chain.map((n, i) => `<span class="chain-node">${esc(n)}</span>${i < chain.length - 1 ? `<span class="chain-arrow">→</span>` : ""}`).join("")}</div></div>`;
}
function archLayersPanel() {
  const layers = [
    { label: "交互层", color: "var(--blue)", chips: ["批次总览", "项目卷宗", "功能点审核", "费用审核", "技术评审", "知识库", "审定表"] },
    { label: "服务层", color: "var(--amber)", chips: ["功能点计算", "价格比对", "依据检索", "报告生成", "版本 diff", "权限 / 留痕"] },
    { label: "领域层", color: "var(--green)", chips: ["项目", "功能点", "费用项", "调整明细", "依据", "版本", "审定表"] },
    { label: "数据层", color: "var(--muted-2)", chips: ["报价书", "预算书", "合同", "采购价", "标准规范", "历史案例", "会议纪要"] },
  ];
  return `<div class="layer-stack" id="archLayers">
      ${layers.map((l, i) => `<div class="layer"><div class="layer-label" style="color:${l.color}">${esc(l.label)}</div><div class="layer-chips">${l.chips.map((c) => `<span class="layer-chip">${esc(c)}</span>`).join("")}</div></div>${i < layers.length - 1 ? `<div class="connector">↓</div>` : ""}`).join("")}
    </div>`;
}
function archAiPanels() {
  return `<div class="grid-2" style="margin-top:12px;">
      <section class="panel">
        <div class="panel-head"><h2>AI + 知识库流程</h2><span class="hint">建议 → 引用 → 人确认 → 反馈</span></div>
        <div class="calc-row">
          <div class="calc-step"><span>解析</span><strong>Excel / Word / PDF</strong><em>OCR / ASR</em></div>
          <div class="calc-step"><span>检索</span><strong>关键词 + 向量</strong><em>标准 / 案例 / 纪要</em></div>
          <div class="calc-step"><span>建议</span><strong>分类 / 合并 / 依据</strong><em>带引用</em></div>
          <div class="calc-step"><span>确认</span><strong>人采纳 / 驳回</strong><em>写回案例库</em></div>
        </div>
        <p class="mini-chart-note">模型：本地开源 LLM + embedding + rerank；内网/VPN；GPU 或可信云；RBAC + 审计日志；不调用外部 API。</p>
      </section>
      <section class="panel">
        <div class="panel-head"><h2>人机边界</h2><span class="hint">AI 做初稿，人做结论</span></div>
        <div class="grid-2" style="gap:8px;">
          <div class="issue-card" style="cursor:default;border-left:2px solid var(--blue);"><h4 style="color:var(--blue);">AI 可做</h4><ul style="margin:6px 0 0;padding-left:16px;color:var(--ink-2);font-size:10.8px;line-height:1.65;"><li>功能点分类、过度拆分候选</li><li>依据匹配、价格比对</li><li>报告/审定表初稿</li><li>版本差异、材料抽取</li></ul></div>
          <div class="issue-card" style="cursor:default;border-left:2px solid var(--amber);"><h4 style="color:var(--amber);">必须由人</h4><ul style="margin:6px 0 0;padding-left:16px;color:var(--ink-2);font-size:10.8px;line-height:1.65;"><li>原件/合同核验</li><li>分类与口径裁定</li><li>专家意见、结论确认</li><li>签字盖章、归档担责</li></ul></div>
        </div>
        <p class="table-note">一句话：AI 做“可辩护的初稿”，人做“可担责的结论”。</p>
      </section>
    </div>`;
}
function archModelPanel() {
  const model = [
    ["项目", "名称 / 业主 / 类别 / 送审 / 审定 / 方法 / 阶段", "项目卡 + 报价书"],
    ["功能点", "描述 / 送审类型 / 审定类型 / FP / 金额 / 调整原因", "功能清单 + 规则"],
    ["费用项", "类别 / 规格 / 数量 / 单价 / 送审 / 审定 / 价格来源", "报价书 + 采购价/合同"],
    ["调整明细", "对象 / 原值 / 新值 / 差额 / 原因 / 依据 / 责任人", "AI 建议 + 人确认"],
    ["依据", "来源 / 条款 / 原文 / 项目 / 专家 / 时间 / 置信度", "知识库"],
    ["版本", "V1/V2/V3 / 差异 / 专家意见 / 定稿标记", "多轮评审"],
    ["审定表", "行 / 合计 / 签章 / 导出时间", "Excel / 报告"],
  ];
  return `<section class="panel">
      <div class="panel-head"><h2>数据模型</h2><span class="hint">实体、字段、来源</span></div>
      <div class="table-wrap"><table><thead><tr><th>实体</th><th>关键字段</th><th>当前来源</th></tr></thead><tbody>
        ${model.map((m) => `<tr><td class="cell-project">${esc(m[0])}</td><td>${esc(m[1])}</td><td class="muted">${esc(m[2])}</td></tr>`).join("")}
      </tbody></table></div>
    </section>`;
}
function archFooterPanels() {
  return `<div class="grid-2">
      <section class="panel"><div class="panel-head"><h2>部署与安全</h2><span class="hint">政府项目</span></div><ul style="margin:0;padding-left:16px;color:var(--ink-2);font-size:11px;line-height:1.75;"><li>内网 / VPN / 自建 GPU 或可信云</li><li>开源模型本地化，数据不出域</li><li>前台 Web 工作台内部登录</li><li>RBAC、操作日志、版本留痕</li></ul></section>
      <section class="panel"><div class="panel-head"><h2>下一步</h2><span class="hint">从演示到试点</span></div><ul style="margin:0;padding-left:16px;color:var(--ink-2);font-size:11px;line-height:1.75;"><li>P1 合成数据演示（当前）</li><li>P2 接 1–2 个真实模板，导入历史审定表</li><li>P3 接规则引擎、OCR、价格库、问题工单</li><li>指标：分类准确率、依据命中率、复核退回率</li></ul></section>
    </div>`;
}
function renderArch() {
  return `${pageHead("工作台架构", "一条证据链：知识库 → 审核台 → 审定表；本地部署，数据不出域。", `<button class="btn btn-ghost" data-action="start-tour">▶ 演示导览</button>`)}
    ${archChainBanner()}
    ${archLayersPanel()}
    ${archAiPanels()}
    ${archModelPanel()}
    ${archFooterPanels()}`;
}

/* ------------------------------------------------------------------ tour page */
/* 导览叙述数字派生化（P-07 残留面）：口径与 KPI/审定表一致，数据更新不再失真。
   F 折算投资与 fivePointTable 同式（personDays × unitPrice，0.1 万舍入） */
const tourF = projectById("F") || {};
const tourFp = tourF.fpSummary || {};
const tourFInvest = tourFp.personDays != null ? money(Math.round(tourFp.personDays * tourFp.unitPrice / 10000 * 10) / 10) : "—";
const TOUR = [
  { route: "overview", target: "#kpiGrid", title: "先看本批规模", text: `${DATA.stats.projects} 个项目、送审 ${num(DATA.stats.submitted)} 万、审定 ${num(DATA.stats.approved)} 万、审减 ${num(DATA.stats.reduction)} 万（${pct(DATA.stats.rate)}）。先给结论，再进入功能点。` },
  { route: "project/A/overview", target: "#projectHeader", title: "项目 A：558 → 269 → 193", text: "送审 558 万，初稿 269 万，专家意见后定稿 193 万。项目卷宗把送审、初稿、定稿、审减放在同一屏。" },
  { route: "fp/A", target: "#fpTable", title: "功能点怎么重认定", text: "12 项典型调整：过度拆分合并、EIF/ILF 误判、报表/大屏不计、历史迁移一次性不计。点每行看依据。" },
  { route: "project/A/versions", target: "#versionTimeline", title: "多轮版本", text: "V1 269 → V2 214 → V3 193；专家意见和每版差异都留痕，定稿锁定。" },
  { route: "project/F/detail", target: "#fpSummary", title: "南网五点法", text: `ILF/EIF/EI/EO/EQ，${tourFp.approvedFP} FP ×${tourFp.coefficient}=${num(tourFp.adjustedFP)} 调整 FP，按 ${num(tourFp.unitPrice)} 元/人天折算 ${tourFInvest}。` },
  { route: "kb", target: "#kbQA", title: "知识库：依据从哪来", text: "标准、案例、会议纪要、价格库、合同库；每条回答带引用，没有引用就不出结论。" },
  { route: "audit/A", target: "#auditTable", title: "最后交什么", text: "Excel 审定表：送审/初稿/定稿/审减/依据；只出表，不提整改建议，甲方按审定价招标。" },
];
function renderTourPage() {
  return `${pageHead("演示导览", "7 步带客户走完：批次规模 → 项目 A → 功能点 → 版本 → 五点法 → 知识库 → 审定表。", `<button class="btn btn-primary" data-action="start-tour">▶ 开始导览</button>`)}
    <section class="panel"><div class="panel-head"><h2>5 分钟导览路线</h2><span class="hint">可随时退出 · 支持 ← → 键</span></div>
      <div class="issue-list">${TOUR.map((s, i) => `<div class="issue-card" style="cursor:default;"><div class="issue-card-top"><div><h4>${i + 1}. ${esc(s.title)}</h4><div class="issue-text">${esc(s.text)}</div></div><span class="badge tone-blue">${i + 1} / ${TOUR.length}</span></div></div>`).join("")}</div>
      <p class="table-note">建议：先给结论，再打开项目 A 的功能点；客户追问依据时停在知识库；最后用审定表收尾。</p>
    </section>`;
}

/* ------------------------------------------------------------------ drawer */
function openDrawer(kind, id) {
  state.drawerTrigger = document.activeElement || null;
  state.drawer = { kind, id };
  renderDrawer();
  $("#drawerBackdrop").hidden = false;
  $("#drawer").hidden = false;
  $("#drawer").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => { const b = $("#drawerClose"); if (b) b.focus(); }, 20);
}
function closeDrawer() {
  state.drawer = null;
  $("#drawerBackdrop").hidden = true;
  $("#drawer").hidden = true;
  $("#drawer").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  const trigger = state.drawerTrigger;
  state.drawerTrigger = null;
  // 焦点归还触发元素；触发元素已被路由重渲染移出 DOM 时跳过，避免聚焦失效节点
  if (trigger && trigger.focus && (!document.contains || document.contains(trigger))) trigger.focus();
}
/* 焦点陷阱（P-14）：aria-modal=true 的对话框内 Tab 循环，不穿到背景 */
function drawerFocusables() {
  return $$('#drawer button, #drawer [href], #drawer input, #drawer select, #drawer textarea, #drawer [tabindex="0"]').filter((el) => !el.disabled);
}
function trapDrawerTab(e) {
  const items = drawerFocusables();
  if (!items.length) { e.preventDefault(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  const drawer = $("#drawer");
  const active = document.activeElement;
  const inside = !!(active && drawer.contains && drawer.contains(active));
  if (e.shiftKey && (active === first || !inside)) { e.preventDefault(); last.focus(); return; }
  if (!e.shiftKey && (active === last || !inside)) { e.preventDefault(); first.focus(); }
}
function drawerSection(title, inner, extra = "") {
  return `<div class="drawer-section"><h3>${esc(title)}</h3><div style="font-size:11.4px;line-height:1.65;color:var(--ink-2);">${inner}</div>${extra}</div>`;
}
function drawerEvidence(ev) {
  if (!ev) return "";
  return drawerSection("依据", `<b>${esc(ev.source || "")}</b>${ev.clause ? ` · ${esc(ev.clause)}` : ""}${ev.excerpt ? `<div class="small" style="margin-top:3px;">${esc(ev.excerpt)}</div>` : ""}`);
}
function fpDrawerBody(p, f) {
  const decision = effectiveDecision(p, f);
  const cut = (f.submittedAmount || 0) - (f.approvedAmount || 0);
  return `<div class="drawer-badges">${typeBadge(f.proposedType)}<span class="arrow" style="color:var(--muted-2)">→</span>${typeBadge(f.approvedType)}<span class="badge tone-slate">${esc(f.adjustment)}</span>${decisionBadge(decision)}</div>
      <p class="drawer-lead">${esc(f.desc || f.reason)}</p>
      <div class="drawer-amounts">${amountCell("送审", money(f.submittedAmount))}${amountCell("初稿", money(f.firstAmount))}${amountCell("定稿", money(f.approvedAmount))}${amountCell("审减", cutText(cut), "", "reduction")}</div>
      ${drawerSection("调整原因", esc(f.reason))}
      ${drawerEvidence(f.basis)}
      <div class="drawer-section"><h3>历史案例</h3><div style="font-size:11.4px;line-height:1.65;color:var(--ink-2);">${esc(f.caseRef || "—")}</div></div>
      ${drawerSection("AI 建议", `${esc(f.aiSuggestion || "—")}${f.confidence != null ? ` · 置信度 ${Math.round(f.confidence * 100)}%` : ""}`, `<div class="small muted" style="margin-top:3px;">AI 只给建议；采纳/驳回由评审人操作，驳回后转人工复核，不自动改金额。</div>`)}
      <div class="drawer-actions">${decision !== "已采纳" ? `<button class="btn btn-primary" data-action="accept-ai" data-project="${p.id}" data-fp="${f.id}">采纳建议</button>` : ""}${decision !== "已驳回" ? `<button class="btn" data-action="reject-ai" data-project="${p.id}" data-fp="${f.id}">驳回建议</button>` : ""}<button class="btn" data-action="close-drawer">关闭</button></div>
      <p class="drawer-note">依据：标准条款 + 历史案例 + 专家意见；正式结论由评审人签字确认。</p>`;
}
function costDrawerBody(p, c) {
  return `<div class="drawer-badges">${badge(c.adjustment, "amber")}${badge(p.category, "slate")}</div>
      <p class="drawer-lead">${esc(c.spec)} · ${c.qty} ${esc(c.unit)} × ${num(c.unitPrice)} 万</p>
      <div class="drawer-amounts">${amountCell("送审", money(c.submitted))}${amountCell("初稿", money(c.firstAmount))}${amountCell("定稿", money(c.approvedAmount))}${amountCell("审减", cutText(c.submitted - c.approvedAmount), "", "reduction")}</div>
      ${drawerSection("价格来源", esc(c.priceSource))}
      ${drawerSection("调整原因", esc(c.reason))}
      ${drawerEvidence(c.basis)}
      <div class="drawer-actions"><button class="btn" data-action="close-drawer">关闭</button></div>
      <p class="drawer-note">费用审核以采购网/合同/历史价为依据；合同缺页、范围外服务先补正再审定。</p>`;
}
function techDrawerBody(p, t, st) {
  return `<div class="drawer-badges">${severityBadge(t.severity)}${techStatusBadge(t)}</div>
      <p class="drawer-lead">${esc(t.finding)}</p>
      ${drawerSection("证据位置", esc(t.evidence))}
      ${drawerSection("处理建议", t.severity === "高" ? "先补正/复核，再进入定稿；未闭环不得出审定表。" : "在定稿前完成修改或说明。")}
      <div class="drawer-actions">${st !== "已闭环" ? `<button class="btn btn-primary" data-action="close-tech" data-project="${p.id}" data-tech="${t.id}">标记已闭环（演示）</button>` : `<span class="badge tone-green">已闭环</span>`}<button class="btn" data-action="close-drawer">关闭</button></div>
      <p class="drawer-note">技术评审是内部复核，不直接进入审定表；整改建议只对内部，不对甲方输出。</p>`;
}
function kbDrawerBody(e) {
  return `<div class="drawer-badges">${badge(e.type, "violet")}${badge(e.date, "slate")}</div>
      <p class="drawer-lead">来源：${esc(e.source)}</p>
      <div class="drawer-section"><h3>标签</h3><div>${e.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div></div>
      ${drawerSection("引用方式", "回答必须带来源、条款/日期、适用项目；没有引用就不出结论。")}
      <div class="drawer-actions"><button class="btn" data-action="close-drawer">关闭</button></div>`;
}
/* 未命中实体时的显式错误态（P-18）：绝不展示上一次抽屉的残留内容 */
function drawerMissBody(id) {
  return `<div class="drawer-badges">${badge("未找到", "red")}</div>
      <p class="drawer-lead">没有找到「${esc(id)}」对应的记录，链接可能已失效或该条目已被移除。</p>
      <div class="drawer-actions"><button class="btn" data-action="close-drawer">关闭</button></div>`;
}
function renderDrawer() {
  const d = state.drawer;
  if (!d) return;
  let kicker = "详情", title = "", body = "";
  const miss = () => { kicker = "未找到"; title = d.id; body = drawerMissBody(d.id); };
  if (d.kind === "fp") {
    const [pid, fid] = d.id.split("|");
    const p = projectById(pid); const f = p && p.functions.find((x) => x.id === fid);
    if (!p || !f) miss();
    else { kicker = `功能点 · ${f.id} · 项目 ${p.id}`; title = f.name; body = fpDrawerBody(p, f); }
  } else if (d.kind === "cost") {
    const [pid, cid] = d.id.split("|");
    const p = projectById(pid); const c = p && p.costItems.find((x) => x.id === cid);
    if (!p || !c) miss();
    else { kicker = `费用项 · ${c.id} · 项目 ${p.id}`; title = c.name; body = costDrawerBody(p, c); }
  } else if (d.kind === "tech") {
    const [pid, tid] = d.id.split("|");
    const p = projectById(pid); const t = p && p.techIssues.find((x) => x.id === tid);
    if (!p || !t) miss();
    else { const st = effectiveTechStatus(t); kicker = `技术评审 · ${t.id} · 项目 ${p.id}`; title = t.category; body = techDrawerBody(p, t, st); }
  } else if (d.kind === "kb") {
    const e = DATA.knowledge.entries.find((x) => x.id === d.id);
    if (!e) miss();
    else { kicker = `知识库 · ${e.type}`; title = e.title; body = kbDrawerBody(e); }
  }
  $("#drawerKicker").textContent = kicker;
  $("#drawerTitle").textContent = title;
  $("#drawerBody").innerHTML = body;
}

/* ------------------------------------------------------------------ 送审与产出(intake & deliverables) */
const INTAKE_ACCEPT = ".doc,.docx,.xls,.xlsx,.pdf";
const INTAKE_LIBS = {
  mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js",
  xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  pdfjs: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  pdfjsWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
};
const INTAKE_GLOBAL_KEY = { mammoth: "mammoth", xlsx: "XLSX", pdfjs: "pdfjsLib" };
window.__intakeLibs = {};
function loadIntakeLib(key) {
  if (window.__INTAKE_BUNDLED && window.__INTAKE_BUNDLED[key]) return Promise.resolve(window[INTAKE_GLOBAL_KEY[key]]);
  if (window.__intakeLibs[key]) return window.__intakeLibs[key];
  window.__intakeLibs[key] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = INTAKE_LIBS[key];
    s.onload = () => resolve(window[INTAKE_GLOBAL_KEY[key]]);
    s.onerror = () => { delete window.__intakeLibs[key]; reject(new Error("解析组件加载失败(该组件需要联网加载)")); };
    document.head.appendChild(s);
  });
  return window.__intakeLibs[key];
}
async function parseIntakeFile(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "docx") {
    const mammoth = await loadIntakeLib("mammoth");
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = (r.value || "").replace(/\s+/g, " ").trim();
    return { kind: "Word 文档", summary: text.slice(0, 180) + (text.length > 180 ? "…" : ""), chars: text.length };
  }
  if (ext === "doc") return { kind: "Word 文档(旧版)", summary: "旧版 .doc 不做在线解析:已登记,由评审端转换后解析。", chars: 0 };
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await loadIntakeLib("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheets = wb.SheetNames.map((n) => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 });
      return `${n}(${rows.length} 行)`;
    });
    return { kind: "Excel 工作簿", summary: "工作表:" + sheets.join("、"), chars: 0 };
  }
  if (ext === "pdf") {
    const pdfjsLib = await loadIntakeLib("pdfjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = window.__INTAKE_PDF_WORKER_URL || INTAKE_LIBS.pdfjsWorker;
    const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = "";
    const probe = Math.min(doc.numPages, 3);
    for (let i = 1; i <= probe; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((t) => t.str).join(" ") + " ";
    }
    text = text.replace(/\s+/g, " ").trim();
    return { kind: "PDF 文档", pages: doc.numPages, summary: text.slice(0, 180) + (text.length > 180 ? "…" : ""), chars: text.length };
  }
  return { kind: "未知类型", summary: "未识别的格式,仅登记文件信息。", chars: 0 };
}
function intakeExtBadge(entry) {
  if (entry.status === "ok") return badge(entry.kind, "green");
  if (entry.status === "fallback") return badge("仅登记", "slate");
  return badge("解析中", "amber");
}
function fmtSize(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}
function renderIntake() {
  const p = projectById(state.intakeProject) || DATA.projects[0];
  const rows = state.intake.map((m, i) => `<tr>
      <td class="cell-nowrap">${i + 1}</td>
      <td><strong>${esc(m.name)}</strong></td>
      <td class="cell-nowrap">${intakeExtBadge(m)}</td>
      <td class="cell-nowrap">${fmtSize(m.size)}</td>
      <td class="cell-nowrap">${esc(m.time)}</td>
      <td>${esc(m.summary || ("解析" + (m.status === "parsing" ? "中…" : "未开始")))}${m.chars ? ` <span class="hint">(${m.chars} 字)</span>` : ""}</td>
    </tr>`).join("");
  const uploadZone = `<section class="panel">
    <div class="panel-head"><h2>送审材料上传</h2><span class="hint">支持 Word / Excel / PDF · 数据不出本浏览器</span></div>
    <div id="intakeDrop" class="upload-zone" tabindex="0" role="button" aria-label="上传待评审文件">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" width="30" height="30"><path d="M10 13V4M6.5 7.5 10 4l3.5 3.5"/><path d="M4 13v2.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V13"/></svg>
      <p><strong>拖拽文件到这里,或</strong></p>
      <button class="btn btn-primary" data-action="intake-pick">选择待评审文件</button>
      <p class="hint">支持 .docx / .doc / .xlsx / .xls / .pdf;解析在浏览器本地完成,Excel 抽功能点与费用项,PDF 走文本抽取,Word 抽正文。</p>
    </div>
    ${state.intake.length ? `<div class="table-wrap"><table><thead><tr><th>序号</th><th>文件</th><th>类型</th><th>大小</th><th>上传时间</th><th>解析结果</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="table-note">共 ${state.intake.length} 份送审材料;解析完成后进入知识库,作为功能点/费用审核的证据入口(演示环境仅存于当前会话)。</p>` : `<p class="table-note">尚未上传材料。演示提示:可以上传任意 docx/xlsx/pdf 试试解析效果。</p>`}
  </section>`;
  const opinion = opinionDocHtml(p);
  const deliver = `<section class="panel">
    <div class="panel-head"><h2>评审产出</h2>
      <span class="hint">评审意见书 · 审定表</span></div>
    <div class="filters">${DATA.projects.map((x) => `<button class="filter-chip ${x.id === p.id ? "active" : ""}" data-action="intake-project" data-project="${x.id}">项目 ${x.id}</button>`).join("")}</div>
    <div class="op-toolbar">
      <button class="btn btn-primary" data-action="export-opinion-word">导出评审意见书(.doc)</button>
      <button class="btn" data-action="export-audit-xlsx">导出审定表(.xlsx)</button>
      <button class="btn" data-action="print-opinion">打印 / 存 PDF</button>
    </div>
    <div class="doc-sheet" id="opinionSheet">${opinion}</div>
    <p class="table-note">意见书由审核记录自动生成:概述、核减明细、依据与结论;导出的 .doc 可直接在 Word/WPS 中编辑,打印可另存 PDF。审定表导出为 Excel,与「审定表」页签同源。</p>
  </section>`;
  return `${pageHead("送审与产出", "送审材料从这里进入工作台;评审完成后在这里预览并导出意见书与审定表。", `<button class="btn btn-ghost" data-action="start-tour">▶ 演示导览</button>`)}
    ${uploadZone}
    ${deliver}`;
}
function opinionDocHtml(p) {
  const adjusted = p.functions.filter((f) => effectiveDecision(p, f) !== "已驳回");
  const cuts = adjusted.filter((f) => (f.approvedAmount || 0) < (f.submittedAmount || 0));
  const basisSources = Array.from(new Set(adjusted.map((f) => f.basis && f.basis.source).filter(Boolean)));
  const now = new Date();
  const dateStr = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`;
  const cutRows = (cuts.length ? cuts : p.functions.slice(0, 5)).slice(0, 8).map((f) => `<tr>
      <td>${esc(f.name)}</td>
      <td class="num">${num(f.submittedAmount)}</td>
      <td class="num">${num(f.approvedAmount)}</td>
      <td>${esc(f.adjustment)}</td>
      <td>${esc(f.reason)}</td>
    </tr>`).join("");
  return `<div class="doc-page">
    <h1 class="doc-title">项目评审意见书</h1>
    <div class="doc-meta">编号:${esc(p.id)}-PS-2026-01 · 密级:内部 · 页数 1/${adjusted.length ? 2 : 1}</div>
    <table class="doc-info">
      <tr><th>项目名称</th><td>${esc(p.name)}</td><th>申报单位</th><td>${esc(p.unit)}</td></tr>
      <tr><th>评审方式</th><td>${esc(p.type || "财政评审")}</td><th>评审阶段</th><td>${esc(stageLine(p))}</td></tr>
      <tr><th>送审金额</th><td>${money(p.submitted)}</td><th>审定金额</th><td><b>${money(p.approved)}</b>(审减 ${money(p.reduction)},${pct(p.rate)})</td></tr>
    </table>
    <h2>一、评审概况</h2>
    <p>根据委托,评审组对「${esc(p.name)}」开展了财政评审。项目当前处于<b>${esc(stageLine(p))}</b>阶段(版本 ${esc(latestVersion(p).id)}),共审核功能点/费用项 ${p.functions.length} 条,其中核减/调整 ${cuts.length} 条,其余维持申报。</p>
    <h2>二、主要核减与调整</h2>
    <table class="doc-table">
      <thead><tr><th>功能点/费用项</th><th>送审(万)</th><th>审定(万)</th><th>调整类型</th><th>调整原因</th></tr></thead>
      <tbody>${cutRows || '<tr><td colspan="5">本批无核减调整项。</td></tr>'}</tbody>
    </table>
    <h2>三、评审依据</h2>
    <p>${basisSources.length ? "本次调整主要依据:" + basisSources.map((s) => esc(s)).join(";") + "。条款级依据见工作台各调整项的「依据」栏,均可回溯到原文。" : "本批未发生调整,按申报口径通过形式审查。"}</p>
    <h2>四、评审结论</h2>
    <p>经审核,核定该项目审定金额 <b>${money(p.approved)}</b>,较送审金额核减 <b>${money(p.reduction)}</b>(核减率 ${pct(p.rate)})。AI 预审意见仅作初稿,上述结论以评审人与专家确认为准;请申报单位按核减明细补充说明或修正申报口径。</p>
    <div class="doc-sign">
      <span>评审人:___________</span><span>复核人:___________</span><span>专家:___________</span>
    </div>
    <div class="doc-footer">中通服评审中心 · ${dateStr} · 本意见书由工作台按审核记录自动生成初稿</div>
  </div>`;
}
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function exportOpinionWord(p) {
  const inner = opinionDocHtml(p);
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>项目评审意见书</title>
    <style>body{font-family:SimSun,'Songti SC',serif;font-size:12pt;line-height:1.7;margin:2cm;} h1{font-size:18pt;text-align:center;} h2{font-size:13pt;margin:14pt 0 6pt;} table{border-collapse:collapse;width:100%;margin:8pt 0;} th,td{border:1px solid #333;padding:4pt 6pt;font-size:10.5pt;text-align:left;} .doc-meta{color:#555;font-size:10pt;text-align:center;} .doc-sign{display:flex;justify-content:space-between;margin-top:28pt;} .doc-footer{color:#777;font-size:9pt;margin-top:20pt;text-align:center;} .num{text-align:right;}</style>
    </head><body>${inner}</body></html>`;
  downloadBlob(new Blob(["\ufeff", html], { type: "application/msword" }), `评审意见书-项目${p.id}.doc`);
  toast("评审意见书已导出(.doc),可用 Word/WPS 打开编辑。");
}
async function exportAuditXlsx(p) {
  let XLSX;
  try { XLSX = await loadIntakeLib("xlsx"); } catch (e) { toast("Excel 导出组件需要联网加载,当前不可用;可先打印/存 PDF。"); return; }
  const header = [
    ["中通服项目评审工作台 · 审定表"],
    [`项目:${p.name} · ${p.unit}`],
    [`送审:${money(p.submitted)} · 定稿:${money(p.approved)} · 审减:${money(p.reduction)}(${pct(p.rate)}) · 版本:${latestVersion(p).id}`],
    [],
    ["功能点/费用项", "类型(申报)", "类型(审定)", "FP-送审", "FP-审定", "金额-送审(万)", "金额-审定(万)", "调整", "调整原因", "依据来源", "依据条款", "AI 建议", "人工决策"],
  ];
  const rows = twoPointRows(p, false).map((f) => [
    f.name, f.proposedType, f.approvedType, f.rawFP, f.approvedFP, f.submittedAmount, f.approvedAmount,
    f.adjustment, f.reason, (f.basis && f.basis.source) || "", (f.basis && f.basis.clause) || "", f.aiSuggestion || "", effectiveDecision(p, f),
  ]);
  const ws = XLSX.utils.aoa_to_sheet(header.concat(rows));
  ws["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 36 }, { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `审定表-${p.id}`);
  XLSX.writeFile(wb, `审定表-项目${p.id}.xlsx`);
  toast("审定表已导出(.xlsx),与「审定表」页签同源。");
}
function printOpinion(p) {
  let host = document.getElementById("intakePrintHost");
  if (!host) { host = document.createElement("div"); host.id = "intakePrintHost"; document.body.appendChild(host); }
  host.innerHTML = opinionDocHtml(p);
  document.body.classList.add("printing-opinion");
  const done = () => { document.body.classList.remove("printing-opinion"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  try { window.print(); } catch (e) { toast("当前环境不支持打印;请在浏览器中打开后打印。"); done(); }
}
async function handleIntakeFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  for (const file of files) {
    const entry = {
      name: file.name,
      size: file.size,
      time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      status: "parsing",
      kind: "解析中",
      summary: "",
      chars: 0,
    };
    state.intake.unshift(entry);
    render();
    try {
      const parsed = await parseIntakeFile(file);
      entry.kind = parsed.kind;
      entry.summary = parsed.summary;
      entry.chars = parsed.chars || 0;
      entry.pages = parsed.pages;
      entry.status = "ok";
    } catch (e) {
      entry.status = "fallback";
      entry.kind = "仅登记";
      entry.summary = e && e.message ? e.message : "解析失败,已登记文件信息。";
    }
    render();
  }
  toast(`已接收 ${files.length} 份送审材料。`);
}
function bindIntakeEvents() {
  document.addEventListener("dragover", (e) => {
    if (e.target.closest && e.target.closest("#intakeDrop")) { e.preventDefault(); e.target.closest("#intakeDrop").classList.add("dragover"); }
  });
  document.addEventListener("dragleave", (e) => {
    if (e.target.closest && e.target.closest("#intakeDrop")) e.target.closest("#intakeDrop").classList.remove("dragover");
  });
  document.addEventListener("drop", (e) => {
    const zone = e.target.closest && e.target.closest("#intakeDrop");
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleIntakeFiles(e.dataTransfer.files);
  });
  let picker = null;
  document.addEventListener("click", (e) => {
    if (!e.target.closest || (!e.target.closest('[data-action="intake-pick"]') && !e.target.closest("#intakeDrop"))) return;
    if (!picker) {
      picker = document.createElement("input");
      picker.type = "file";
      picker.multiple = true;
      picker.accept = INTAKE_ACCEPT;
      picker.style.display = "none";
      picker.addEventListener("change", () => { handleIntakeFiles(picker.files); picker.value = ""; });
      document.body.appendChild(picker);
    }
    picker.click();
  });
}
bindIntakeEvents();


function openDoc(p){ state.docPid = p.id; document.body.classList.add("doc-open"); $("#docKicker").textContent = `评审意见书 · 项目 ${p.id} · ${p.versions[p.versions.length - 1].id}`; $("#docPage").innerHTML = opinionDocHtml(p); $("#docOverlay").hidden = false; }
function closeDoc(){ state.docPid = null; document.body.classList.remove("doc-open"); const ov = $("#docOverlay"); if (ov) ov.hidden = true; }
/* ------------------------------------------------------------------ routes */
let lastRoute = "";
function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  if (!raw) return { name: "overview" };
  const parts = raw.split("/");
  if (parts[0] === "project" && parts[1]) return { name: "project", id: parts[1].toUpperCase(), tab: parts[2] || "overview" };
  if (["fp", "cost", "audit"].includes(parts[0])) return { name: parts[0], id: (parts[1] || (parts[0] === "fp" ? "A" : parts[0] === "cost" ? "B" : "A")).toUpperCase() };
  return { name: parts[0] || "overview" };
}
function setCrumbs(route) {
  let text = "批次总览";
  if (route.name === "projects") text = "项目卷宗";
  if (route.name === "fp") text = `功能点审核 / 项目 ${route.id}`;
  if (route.name === "cost") text = `费用审核 / 项目 ${route.id}`;
  if (route.name === "tech") text = "技术评审";
  if (route.name === "kb") text = "知识库";
  if (route.name === "audit") text = `审定表 / 项目 ${route.id}`;
  if (route.name === "intake") text = "送审与产出";
  if (route.name === "arch") text = "架构";
  if (route.name === "tour") text = "演示导览";
  if (route.name === "project") {
    const p = projectById(route.id);
    const tabs = { overview: "概览", materials: "材料", detail: p && p.functions.length ? "功能点" : "费用明细", tech: "技术评审", versions: "版本", audit: "审定表" };
    text = `项目卷宗 / <b>${esc(p ? p.name : route.id)}</b> / ${tabs[route.tab] || "概览"}`;
  }
  $("#crumbs").innerHTML = text;
}
function setActiveNav(route) {
  const active = route.name === "project" ? "projects" : route.name;
  $$(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.nav === active));
}
function render() {
  const route = parseRoute();
  const routeKey = location.hash || "#/overview";
  const changed = routeKey !== lastRoute;
  lastRoute = routeKey;
  if (changed && state.drawer) closeDrawer();
  setActiveNav(route);
  setCrumbs(route);
  let html = "";
  if (route.name === "projects") html = renderProjects();
  else if (route.name === "fp") html = fpView(route.id);
  else if (route.name === "cost") html = costView(route.id);
  else if (route.name === "tech") html = renderTech();
  else if (route.name === "kb") html = renderKB();
  else if (route.name === "audit") html = renderAudit(route.id);
  else if (route.name === "intake") html = renderIntake();
  else if (route.name === "arch") html = renderArch();
  else if (route.name === "tour") html = renderTourPage();
  else if (route.name === "project") html = renderProject(route.id, route.tab);
  else html = renderOverview();
  $("#view").innerHTML = html;
  $("#demoPill").hidden = !demoChanged();
  applyTourHighlight();
  if (changed && !state.tour.active) window.scrollTo({ top: 0, behavior: "auto" });
}

function fpView(projectId) {
  const p = projectById(projectId) || DATA.projects[0];
  const head = pageHead("功能点审核", "按国家标准/行业规则重认定 ILF/EIF（或五点法）；每条调整带依据、案例、AI 建议和人工决策。", `<button class="btn btn-ghost" data-action="start-tour">▶ 演示导览</button>`);
  const filters = `<div class="filters">${DATA.projects.filter((x) => x.functions.length).map((x) => `<button class="filter-chip ${x.id === p.id ? "active" : ""}" data-go="fp/${x.id}">项目 ${x.id}</button>`).join("")}<span class="small muted" style="margin-left:4px;">${esc(p.method)}</span></div>`;
  /* 无功能点项目直入 #/fp/<id> 时给空态引导（评审 FIX-4）：
     不再进入 fpPanel 的 fpSummary 崩溃路径（基线钉住的存量 TypeError） */
  if (!p.functions.length) {
    return `${head}
    ${filters}
    <section class="panel"><div class="empty">项目 ${esc(p.id)} 没有功能点明细（走费用审核口径）；请切换到上方有功能点的项目，或在项目卷宗中打开「费用明细」页。</div></section>`;
  }
  return `${head}
    ${filters}
    ${fpPanel(p)}`;
}
function costView(projectId) {
  const p = projectById(projectId) || DATA.projects.find((x) => x.costItems.length);
  return `${pageHead("费用审核", "基础设施/租用、运维、运营、第三方服务；每条费用有价格来源和合同/标准依据。", `<button class="btn btn-ghost" data-action="start-tour">▶ 演示导览</button>`)}
    <div class="filters">${DATA.projects.filter((x) => x.costItems.length).map((x) => `<button class="filter-chip ${x.id === p.id ? "active" : ""}" data-go="cost/${x.id}">项目 ${x.id}</button>`).join("")}<span class="small muted" style="margin-left:4px;">${esc(p.method)}</span></div>
    ${costPanel(p)}`;
}

/* ------------------------------------------------------------------ search */
/* combobox 语义（P-16）：aria-expanded 随结果面板开合；结果条数经 #searchStatus 播报 */
function setSearchExpanded(open, statusText) {
  const input = $("#globalSearch");
  if (input && input.setAttribute) input.setAttribute("aria-expanded", open ? "true" : "false");
  const status = $("#searchStatus");
  if (status) status.textContent = statusText || "";
}
function closeSearch() {
  const b = $("#searchResults");
  if (b) { b.hidden = true; b.innerHTML = ""; }
  setSearchExpanded(false);
}
function markActiveOption(el) {
  $$(".search-result").forEach((o) => o.setAttribute("aria-selected", o === el ? "true" : "false"));
}
function renderSearch(q) {
  const box = $("#searchResults");
  const query = q.trim().toLowerCase();
  if (!query) { box.hidden = true; box.innerHTML = ""; setSearchExpanded(false); return; }
  const results = [];
  DATA.projects.forEach((p) => {
    if (`${p.name} ${p.client} ${p.category} ${p.method} ${p.id}`.toLowerCase().includes(query)) results.push({ type: "项目", label: p.name, sub: `${p.id} · ${p.client} · ${p.statusLabel}`, attr: `data-go="project/${p.id}/overview"` });
    (p.functions || []).forEach((f) => { if (`${f.name} ${f.desc} ${f.id}`.toLowerCase().includes(query)) results.push({ type: "功能点", label: `${p.id} · ${f.name}`, sub: `${f.proposedType} → ${f.approvedType} · ${f.adjustment}`, attr: `data-go="fp/${p.id}"` }); });
    (p.costItems || []).forEach((c) => { if (`${c.name} ${c.spec} ${c.id}`.toLowerCase().includes(query)) results.push({ type: "费用", label: `${p.id} · ${c.name}`, sub: `${c.adjustment} · ${money(c.submitted)} → ${money(c.approvedAmount)}`, attr: `data-go="cost/${p.id}"` }); });
  });
  (DATA.knowledge.entries || []).forEach((e) => { if (`${e.title} ${e.type} ${e.tags.join(" ")}`.toLowerCase().includes(query)) results.push({ type: "知识", label: e.title, sub: `${e.type} · ${e.source}`, attr: `data-go="kb"` }); });
  (DATA.knowledge.qa || []).forEach((x) => { if (`${x.q} ${x.a}`.toLowerCase().includes(query)) results.push({ type: "问答", label: x.q, sub: "知识库问答", attr: `data-go="kb"` }); });
  if (!results.length) { box.innerHTML = `<div class="search-empty" role="none">没有找到匹配内容。</div>`; box.hidden = false; setSearchExpanded(true, "没有找到匹配内容"); return; }
  box.innerHTML = results.slice(0, 12).map((r) => `<button class="search-result" role="option" aria-selected="false" ${r.attr}><span class="badge tone-slate" style="margin-right:4px;">${r.type}</span>${esc(r.label)}<small>${esc(r.sub)}</small></button>`).join("");
  box.hidden = false;
  setSearchExpanded(true, `${results.length} 条结果`);
}

/* ------------------------------------------------------------------ toast / actions */
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { el.hidden = true; }, 2600); }
function goTo(path) { closeSearch(); if (state.drawer) closeDrawer(); const h = "#/" + path; if (location.hash === h) render(); else location.hash = h; }
function handleAction(action, el) {
  if (action === "start-tour") return startTour();
  if (action === "next-tour") return nextTour();
  if (action === "prev-tour") return prevTour();
  if (action === "exit-tour") return exitTour(false);
  if (action === "close-drawer") return closeDrawer();
  if (action === "print") { try { window.print(); } catch (e) { toast("当前预览环境不支持打印；请在浏览器中打开后打印。"); } return; }
  if (action === "preview-doc") { const pp = projectById(el.dataset.project); if (pp) openDoc(pp); return; }
  if (action === "close-doc") return closeDoc();
  if (action === "print-doc") { try { window.print(); } catch (e) { toast("当前环境限制打印；请在浏览器中打开。"); } return; }
  if (action === "reset-demo") return resetDemo();
  if (action === "intake-project") { state.intakeProject = el.dataset.project; render(); return; }
  if (action === "export-opinion-word") return exportOpinionWord(projectById(el.dataset.project || state.intakeProject) || DATA.projects[0]);
  if (action === "export-opinion-word-doc") return exportOpinionWord(projectById(state.docPid) || DATA.projects[0]);
  if (action === "export-audit-xlsx") return exportAuditXlsx(projectById(el.dataset.project || state.intakeProject) || DATA.projects[0]);
  if (action === "print-opinion") return printOpinion(projectById(state.intakeProject) || DATA.projects[0]);
  if (action === "accept-ai" || action === "reject-ai") {
    const key = `${el.dataset.project}:${el.dataset.fp}`;
    state.decisions[key] = action === "accept-ai" ? "已采纳" : "已驳回";
    closeDrawer(); render(); toast(action === "accept-ai" ? "已采纳 AI 建议（演示）。" : "已驳回，转人工复核（演示）。"); return;
  }
  if (action === "close-tech") {
    state.techStatus[el.dataset.tech] = "已闭环";
    closeDrawer(); render(); toast("技术问题已标记闭环（演示）。"); return;
  }
}
function resetDemo() {
  state.decisions = {}; state.techStatus = {};
  state.filters = { fpAdj: "all", fpType: "all", techProject: "all", techSeverity: "all" };
  state.tour.active = false; $("#tourCard").hidden = true; state.kbQ = 0; state.version = {};
  closeDrawer(); closeSearch(); goTo("overview"); toast("已恢复初始演示状态。");
}

/* ------------------------------------------------------------------ tour */
function startTour() { closeDrawer(); state.tour.active = true; state.tour.step = 0; goTourStep(); }
function goTourStep() {
  const step = TOUR[state.tour.step];
  if (!step) return exitTour(false);
  goTo(step.route);
  setTimeout(() => {
    const el = document.querySelector(step.target);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    updateTourCard(); applyTourHighlight();
  }, 160);
}
function updateTourCard() {
  const step = TOUR[state.tour.step];
  if (!step) return;
  $("#tourCard").hidden = false;
  $("#tourStepLabel").textContent = `${state.tour.step + 1} / ${TOUR.length}`;
  $("#tourProgress").style.width = `${(state.tour.step + 1) / TOUR.length * 100}%`;
  $("#tourTitle").textContent = step.title;
  $("#tourText").textContent = step.text;
  $("#tourNext").textContent = state.tour.step === TOUR.length - 1 ? "完成" : "下一步";
  $("#tourPrev").disabled = state.tour.step === 0;
}
function nextTour() { if (!state.tour.active) return; if (state.tour.step >= TOUR.length - 1) return exitTour(true); state.tour.step += 1; goTourStep(); }
function prevTour() { if (!state.tour.active || state.tour.step === 0) return; state.tour.step -= 1; goTourStep(); }
function exitTour(done) {
  state.tour.active = false; $("#tourCard").hidden = true;
  $$(".tour-target").forEach((el) => el.classList.remove("tour-target"));
  if (done) toast("导览完成。可点击任意项目继续查看。");
}
function applyTourHighlight() {
  $$(".tour-target").forEach((el) => el.classList.remove("tour-target"));
  if (!state.tour.active) return;
  const step = TOUR[state.tour.step];
  const el = step ? document.querySelector(step.target) : null;
  if (el) el.classList.add("tour-target");
}

/* ------------------------------------------------------------------ nav counts */
/* 导航计数派生化（P-01）：shell 静态值仅作禁脚本首帧回退，启动后一律以数据为准；
   fp 口径与导航默认目标一致（fp/A 的功能项数），tech 为全部项目技术问题合计 */
function applyNavCounts() {
  const fpA = projectById("A");
  const counts = {
    overview: DATA.stats.projects,
    projects: DATA.projects.length,
    fp: fpA && fpA.fpSummary ? fpA.fpSummary.items : 0,
    cost: DATA.projects.reduce((n, p) => n + (p.costItems || []).length, 0),
    tech: DATA.projects.reduce((n, p) => n + (p.techIssues || []).length, 0),
    kb: (DATA.knowledge.entries || []).length,
    audit: DATA.projects.length,
  };
  $$(".nav-item").forEach((el) => {
    const slot = el.querySelector(".nav-count");
    const v = counts[el.dataset.nav];
    if (slot && v != null) slot.textContent = v;
  });
}

/* ------------------------------------------------------------------ events */
document.addEventListener("click", (e) => {
  const actionEl = e.target.closest("[data-action]");
  if (actionEl) { e.preventDefault(); handleAction(actionEl.dataset.action, actionEl); return; }
  const go = e.target.closest("[data-go]");
  if (go) { e.preventDefault(); closeSearch(); goTo(go.dataset.go); return; }
  const fp = e.target.closest("[data-open-fp]");
  if (fp) { e.preventDefault(); openDrawer("fp", fp.dataset.openFp); return; }
  const cost = e.target.closest("[data-open-cost]");
  if (cost) { e.preventDefault(); openDrawer("cost", cost.dataset.openCost); return; }
  const tech = e.target.closest("[data-open-tech]");
  if (tech) { e.preventDefault(); openDrawer("tech", tech.dataset.openTech); return; }
  const kb = e.target.closest("[data-open-kb]");
  if (kb) { e.preventDefault(); openDrawer("kb", kb.dataset.openKb); return; }
  const qa = e.target.closest("[data-qa]");
  if (qa) { e.preventDefault(); state.kbQ = Number(qa.dataset.qa); render(); return; }
  const ver = e.target.closest("[data-version]");
  if (ver) { e.preventDefault(); state.version[ver.dataset.project] = ver.dataset.version; render(); return; }
  const filter = e.target.closest("[data-filter]");
  if (filter) { e.preventDefault(); closeSearch(); state.filters[filter.dataset.filter] = filter.dataset.value; render(); return; }
  if (!e.target.closest(".search")) closeSearch();
});
document.addEventListener("change", (e) => {
  const sel = e.target.closest("[data-select]");
  if (!sel) return;
  if (sel.dataset.select === "fpAdj") state.filters.fpAdj = sel.value;
  render();
});
document.addEventListener("keydown", (e) => {
  const t = e.target;
  // 可点行（<tr tabindex=0>）不设 role=button，保留 AT 的表格行语义；
  // Enter/Space 激活由本代理统一处理（卡片类 div 仍是 role="button"）。
  if ((e.key === "Enter" || e.key === " ") && t && t.matches && t.matches('[role="button"][data-go], [role="button"][data-open-fp], [role="button"][data-open-cost], [role="button"][data-open-tech], [role="button"][data-open-kb], [role="button"][data-qa], [role="button"][data-version], tr[data-go], tr[data-open-fp], tr[data-open-cost], tr[data-open-tech], tr[data-open-kb]')) {
    e.preventDefault(); t.click(); return;
  }
  if (e.key === "Tab" && state.drawer) { trapDrawerTab(e); return; }
  if (e.key === "Escape") { if (state.docPid) closeDoc(); else if (state.drawer) closeDrawer(); else closeSearch(); if (state.tour.active) exitTour(false); return; }
  if (state.tour.active && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { e.preventDefault(); if (e.key === "ArrowRight") nextTour(); else prevTour(); return; }
  // 搜索结果方向键导航（P-16）：输入框 ↓ 进入首条 / 末条 ↑ 返回输入框；aria-selected 随焦点标记
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && t && (t.id === "globalSearch" || (t.closest && t.closest(".search-results")))) {
    const box = $("#searchResults");
    if (!box || box.hidden) return;
    const opts = $$(".search-result", box);
    if (!opts.length) return;
    e.preventDefault();
    const idx = opts.indexOf(document.activeElement);
    if (e.key === "ArrowUp" && idx <= 0) { markActiveOption(null); $("#globalSearch").focus(); return; }
    const next = idx === -1 ? (e.key === "ArrowDown" ? 0 : opts.length - 1) : e.key === "ArrowDown" ? Math.min(idx + 1, opts.length - 1) : idx - 1;
    markActiveOption(opts[next]);
    opts[next].focus();
    return;
  }
  if (e.key === "/" && document.activeElement && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { e.preventDefault(); $("#globalSearch").focus(); }
});
$("#docOverlay").addEventListener("click", (e) => { if (e.target.id === "docOverlay") closeDoc(); });
$("#drawerClose").addEventListener("click", closeDrawer);
$("#drawerBackdrop").addEventListener("click", closeDrawer);
$("#globalSearch").addEventListener("input", (e) => renderSearch(e.target.value));
$("#globalSearch").addEventListener("focus", (e) => { if (e.target.value) renderSearch(e.target.value); });
window.addEventListener("hashchange", () => { render(); });
applyNavCounts();
render();
