# 阅读网站

网站使用 Quarto 1.9.38，将仓库现有 Markdown 生成网页；正文仍在原章节目录维护。

网站相关文件集中在本目录，保留原有章节、实验和图片目录结构：

```text
website/
  README.md             网站维护说明
  scripts/
    build.py            生成页面、导航与资源映射
    check.py            检查网页链接、图片与原文一致性
    reader.js           表格滚动、原图查看等渐进增强
  styles/
    reader.css          阅读界面样式
    local-fonts.scss    禁用外部字体，沿用系统字体
  tests/                生成器与交互回归检查
  requirements.txt      构建依赖（Pillow，用于读取图片尺寸）
  package.json          交互测试依赖（不会加载到网站）
  build/                自动生成，不提交
    _quarto.yml         生成的 Quarto 配置
    manifest.json       来源与资源映射
    check-report.json   检查结果
    _site/              生成的 HTML 网站
```

构建缓存、预览网页和检查报告均留在 `build/`，不混入书稿或提交记录。网站源码将作为独立的网站变更提交，不移动现有正文，也不修改已发布的 `v1.1` 标签。

在仓库根目录运行：

```sh
python -m pip install -r website/requirements.txt
python website/scripts/build.py
quarto render website/build
python website/scripts/check.py
quarto preview website/build --no-browser
```

生成器会清空并重建 `website/build/`，请勿在其中编辑正文。

## 阅读体验与检查

桌面布局使用 Quarto 原生网格配置：侧栏 260px、正文基准宽度 780px、右侧目录 180px，窄屏由 Quarto 响应式收起侧栏。短数字、位串和表头在表格中保持完整；超宽表格在自身区域滚动，长文字仍可换行。

正文图片可以打开大图并切换原始尺寸，支持关闭按钮和 Esc 返回。已有链接的图片保留原链接；不支持对话框的浏览器仍可直接打开图片。关闭脚本时仍可阅读原始正文、图片与表格。图片保留原始文件和替代文本，预留尺寸以减少布局跳动；每页首图正常加载，其后图片延迟加载。

搜索保留正文、习题答案与实验，排除目录聚合页和整章副本；独立答案的搜索标题包含章名。实验前后页遵循实验目录的学习顺序。所有链接默认在当前页打开，需要时可通过浏览器快捷操作打开新标签。

输入完整小节号（如 `2.4.3`）时，在已有搜索结果内优先展示编号精确匹配的正文入口，避免 `12.4.3` 等子串匹配靠前；其他关键词沿用 Quarto 排序。这一小范围适配依赖 Quarto 1.9.38 的 `fuseSearch` 函数，升级 Quarto 时须复核，接口不存在时自动保留默认搜索。

运行针对性检查：

```sh
python -m unittest discover -s website/tests -p 'test_*.py'
npm ci --prefix website --ignore-scripts
npm test --prefix website
# 以下检查需要先完成 quarto render website/build
npm run test:search --prefix website
```

`jsdom` 测试验证 DOM 和事件行为，不代表浏览器布局、触摸滚动或原生对话框焦点管理已通过视觉验收。发布前仍须在桌面与手机视口检查亮暗主题、目录、搜索、长表格及图片对话框。全站渲染后再运行 `check.py` 核对链接、锚点与资源。

仓库的原始 Markdown 发布检查应在干净检出中、安装测试依赖和生成网站之前运行，避免把 `node_modules` 或 `build` 中的第三方/生成文档当作书稿检查。

书中的代码仅供显示，不会执行。首页为第一章开篇，侧栏提供前言、所有章节、独立答案、实验、附录和参考文献。章节导航保留整章阅读入口，整章页不重复进入搜索结果。

## 正式网站部署

`.github/workflows/website.yml` 是 GitHub 要求放置在固定位置的工作流入口。网站的其余文件集中在本目录。

推送到 `main` 后，工作流会校验原始文档与实验包、生成页面、运行 Quarto、检查网页链接与资源，再将 `build/_site` 发布到 GitHub Pages。流程不提交生成文件，也不修改任何 Git 标签。

仓库设置要求：

- Settings → Pages → Source 选择 GitHub Actions。
- Settings → Environments → github-pages 中，允许 `main` 分支部署；正式部署成功后可删除旧的开发分支规则。

在仓库 Actions 页面查看 `Publish website` 运行结果。网址为 `https://sunnymaria.github.io/csapp-zh-markdown/`，仓库 README 顶部提供在线阅读入口。

工作流通过 `main` 的 push 或 Actions 页的手动运行触发，仅允许 `main` 执行部署。网站改动仍可先在开发分支本地验证，再合并上线。
