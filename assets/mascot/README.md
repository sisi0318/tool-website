# 小栈 · 工具站主页角色

先使用内置 ImageGen 生成角色参考图，再以该图进行矢量描摹，清理透明边缘并简化曲线。SVG 保留原图的短发、叶片发夹、招手姿势、代码终端、工装和三枚工具图标。

- `reference.png`：生成的原始参考图，保留透明通道。
- `prompt.txt`：完整生成提示词，使用内置工具模式。
- `reference-v2.png`、`prompt-v2.txt`：使用内置 ImageGen 重绘的第二版参考图及提示词，采用薄荷银发、光标发夹和递出数据方块的日系立绘设计。
- `vector-settings.json`：矢量化参数。
- `trace.cjs`：可复现的本地转换脚本。
- `../../public/mascot.svg`：主页使用的纯路径 SVG，不包含嵌入位图、外部资源或脚本。

描摹使用 [VTracer](https://github.com/visioncortex/vtracer)，只需在重新制作素材时安装；网站运行不依赖它。工具安装在被 Git 忽略的缓存目录，避免改动应用依赖：

```powershell
npm install --prefix node_modules/.cache/mascot-vector --ignore-scripts --no-audit --no-fund '@visioncortex/vtracer@1.0.0-alpha.4'
node assets/mascot/trace.cjs
```

转换时先过滤半透明边缘和小于 100 像素的独立透明度岛，保留角色内部色彩细节；然后用 128 色、贝塞尔曲线和 1 像素简化误差输出 SVG。图形外留 48 像素边距，避免发梢和鞋底贴边。
