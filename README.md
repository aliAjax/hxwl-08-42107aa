# hxwl-08 葡萄酒盲品训练

产区、品种与感官特征的盲品复习系统

## 技术栈

React + Vite + TypeScript + CSS

## 本地运行

```bash
npm install
npm run dev
```

开发端口：5108

## 质量门禁

本地一键跑完整套检查：

```bash
npm run quality
```

包含以下三项，任何一项失败都会中止：

| 命令 | 说明 |
|------|------|
| `npm run typecheck` | TypeScript 类型检查（`tsc --noEmit`） |
| `npm test` | 单元测试（Vitest） |
| `npm run build` | 生产构建 |

## 浏览器冒烟测试

验证生产构建后页面能正常加载渲染：

```bash
npm run build
npx playwright install chromium
npm run smoke
```

冒烟测试检查项：
- 首页能正常加载，标题正确
- IndexedDB 初始化不阻塞页面
- 记录列表区域正常渲染
- 盲品测验入口正常渲染

## CI

已配置 GitHub Actions，在 push 和 PR 时自动运行质量门禁 + 冒烟测试。配置文件位于 `.github/workflows/quality-gate.yml`。

## 初始功能

- 领域指标看板
- 角色和分类筛选
- 专业字段录入区
- 示例记录列表
- 可继续扩展IndexedDB、权限、后端API和复杂图表
