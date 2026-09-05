# 小栈 · 工具站主页角色

先使用内置 ImageGen 生成角色参考图，再以该图进行矢量描摹，清理背景并简化曲线。当前主页使用第三版：薄荷白短发、金色光标发夹、青白色夹克，托着笔记本并指向代码窗口。

第三版轻度参考用户来稿的薄荷青配色、深蓝线稿和平涂质感，独立设计角色发型、服装、动作与构图。用户来稿仅用于生成时的风格参考，未作为站点素材保存或分发。

- `reference.png`、`prompt.txt`：第一版角色参考图及生成提示词。
- `reference-v2.png`、`prompt-v2.txt`：使用内置 ImageGen 重绘的第二版参考图及提示词，采用薄荷银发、光标发夹和递出数据方块的日系立绘设计。
- `reference-v3.png`、`prompt-v3.txt`：当前 SVG 使用的第三版生成图和完整提示词，使用内置 ImageGen 并将用户来稿标记为仅供画风参考。
- `vector-settings.json`：矢量化参数。
- `trace.cjs`：可复现的本地转换脚本。
- `../../public/mascot.svg`：主页使用的纯路径 SVG，不包含嵌入位图、外部资源或脚本。

主页图片 URL 使用 `?v=3` 区分本次角色版本，避免浏览器的图片缓存继续展示上一版。后续替换角色时同步更新这个版本值。

描摹使用 [VTracer](https://github.com/visioncortex/vtracer)，只需在重新制作素材时安装；网站运行不依赖它。工具安装在被 Git 忽略的缓存目录，避免改动应用依赖：

```powershell
npm install --prefix node_modules/.cache/mascot-vector --ignore-scripts --no-audit --no-fund '@visioncortex/vtracer@1.0.0-alpha.4'
node assets/mascot/trace.cjs
```

第三版生成图含有绘制出来的棋盘格。转换时先剔除与图像边界相连的浅中性色背景，闭合深色轮廓内的头发、外套和代码窗口仍保持不透明；再过滤半透明边缘和小于 100 像素的独立透明度岛。使用最多 192 色、贝塞尔曲线和 0.7 像素简化误差，保留眼睛高光和细线；图形外留 48 像素边距。
