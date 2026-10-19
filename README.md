# 中通服项目评审工作台 · 财政评审(演示版)

面向财政评审业务的交互式演示工作台:以「证据链 + 审核台 + 交付物」为主线,演示一批信息化项目从接件、形式审查、审核、内部复核、专家意见到定稿归档的完整评审流程,以及 AI 预审初稿与人机分工边界。

> **在线演示**:https://kenyanghui.github.io/zts-workbench/
>
> 本仓库所有项目、单位、金额、比例均为**合成演示数据**,不含任何真实客户信息。

## 在线演示 / 本地使用

- 在线:直接打开上方链接(纯静态单文件,无需安装任何依赖)。
- 本地:下载 `index.html` 双击即可离线打开。

## 功能一览

- 批次总览:项目、功能点、问题、轮次的总体盘面
- 项目卷宗:单个项目的送审材料、功能点清单、审核记录
- 问题与调整:每笔调整的依据条款、可追溯证据
- 流程与人机分工:AI 出初稿、人做裁定
- 多轮留痕:初稿 → 专家意见 → 修改稿 → 定稿

## 目录结构

```
├── index.html          # 独立演示页(单文件,GitHub Pages 入口)
├── source/             # 工作台源码(shell/app/data/样式 + 构建脚本)
│   ├── build.py        # 组装单文件 HTML:python3 build.py
│   └── build_data.py   # 生成合成演示数据 data.json
├── dsh-plugin/         # DeepSeek Harness(DSH)客户端插件版
│   ├── cordis.patch.yml
│   └── package.json    # dsh.client 声明(侧栏入口 + 主面板)
└── docs/               # 客户版操作手册、5 分钟演示脚本
```

## 构建

```bash
cd source
python3 build.py        # 产出单文件 HTML(默认写到上级演示目录)
python3 build_data.py   # 重新生成合成数据 data.json(可选)
```

## 作为 DSH 插件安装(可选)

工作台也可以作为 DeepSeek Harness Desktop 的侧栏面板运行:

```bash
cp -R dsh-plugin /path/to/anywhere/zts-plugin
dsh plugin --profile desktop add "file:/path/to/anywhere/zts-plugin"
```

重启 DSH Desktop 后,左侧栏出现「项目评审工作台」入口。

## 数据与合规

- 演示数据全部由 `source/build_data.py` 程序化生成,业务规则条款为示例文本;
- 不包含任何真实客户、真实项目、真实金额;
- 用于客户演示时,建议配合 `docs/06-演示脚本-5分钟.md` 的逐分钟话术使用。
