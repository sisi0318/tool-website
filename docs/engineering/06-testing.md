---
description: 测试策略 - Vitest 配置、单元测试、属性测试 (fast-check)、可访问性测试
type: Permanent
---

# 测试策略

## 测试基础设施

| 工具 | 用途 |
|------|------|
| Vitest 4 | 测试运行器 |
| @testing-library/react | React 组件测试 |
| fast-check | 属性测试 (Property-based Testing) |
| @testing-library/jest-dom | DOM 断言匹配器 |

## 配置 (vitest.config.ts)

- 运行环境: `jsdom`
- 路径别名: `@/` 映射到项目根目录
- 自定义 setup 文件

## 测试分布

```mermaid
flowchart LR
    subgraph 测试总数 ~25
        TC[组件测试 14] --> M3C[M3 组件]
        TC --> ACC[可访问性测试 1]
        
        PB[属性测试 7] --> CL[颜色 Token]
        PB --> TY[字体 Token]
        PB --> SH[形状 Token]
        PB --> MO[动效 Token]
        PB --> SH2[Shape 属性]
        
        HK[Hook 测试 2] --> BP[breakpoint]
        HK --> RM[reduced-motion]
        
        PT[属性测试 1] --> HDR[Header 组件]
    end
```

### 属性测试 (Property-based Testing)

使用 `fast-check` 对设计系统 Token 进行不变量测试：

- **颜色方案**：任意种子色应生成包含 6 色调的 palette，且符合 WCAG 对比度
- **字体**：type scale 中较大字号应有更大的行高
- **形状**：shape Token 应遵循 xs < sm < md < lg < xl 排序
- **动效**：duration Token 应在预期范围内

### 组件测试

- M3 组件的渲染/交互行为
- 响应式断点逻辑
- 无障碍 (ARIA) 属性验证

## 运行

```bash
pnpm vitest          # 运行测试
pnpm vitest --watch  # 监听模式
pnpm vitest --coverage  # 覆盖率
```

## 相关文档

- [[01-design-system]]
