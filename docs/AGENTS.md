# Docs 目录指南

## 目录结构

```
docs/
├── AGENTS.md          # 本文档 - 目录指南
├── product/           # 产品功能文档 - 面向需求理解
│   ├── AGENTS.md
│   ├── 01-overview.md
│   └── ...
└── engineering/       # 技术实现文档 - 面向开发维护
    ├── AGENTS.md
    ├── 01-design-system.md
    └── ...
```

## 文档规范

- 所有文档遵循 Zettelkasten 原子化原则
- 每个文件包含 YAML front matter（description, type）
- 使用 `[[文件名]]` 链接同目录文档
- 技术图使用 Mermaid 语法

## 文件命名

`<序号>-<英文短横命名>.md`

## 注意事项

- product/ 文档写给产品经理和需求方，聚焦功能描述和用户价值
- engineering/ 文档写给开发者，聚焦技术实现和架构决策
- 保持文档原子化，避免跨域混杂
