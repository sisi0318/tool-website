# 小栈 · 工具站主页角色

先使用内置 ImageGen 生成角色参考图，再以该图进行矢量描摹，清理背景并简化曲线。当前主页使用第四版：白色蓬松短发、芯片发夹和薄荷青连帽外套，抱着终端平板并举起触控笔。

第四版进一步参考用户来稿的手绘深蓝线条、眼睛的深浅分色与竖向细线、薄荷青硬边色块及少量排线，减少柔和渐变。角色发型、服装、动作与构图独立设计。用户来稿仅用于生成时的风格参考，未作为站点素材保存或分发。

- `reference.png`、`prompt.txt`：第一版角色参考图及生成提示词。
- `reference-v2.png`、`prompt-v2.txt`：使用内置 ImageGen 重绘的第二版参考图及提示词，采用薄荷银发、光标发夹和递出数据方块的日系立绘设计。
- `reference-v3.png`、`prompt-v3.txt`：第三版笔记本角色及提示词。
- `reference-v4.png`、`prompt-v4.txt`：当前 SVG 使用的第四版生成图及完整提示词，使用内置 ImageGen 并将用户来稿标记为仅供画风参考。
- `vector-settings.json`：矢量化参数。
- `trace.cjs`：可复现的本地转换脚本。
- `../../public/mascot.svg`：主页使用的纯路径 SVG，不包含嵌入位图、外部资源或脚本。

主页图片 URL 使用 `?v=4` 区分本次角色版本，避免浏览器的图片缓存继续展示上一版。后续替换角色时同步更新这个版本值。

描摹使用 [VTracer](https://github.com/visioncortex/vtracer)，只需在重新制作素材时安装；网站运行不依赖它。工具安装在被 Git 忽略的缓存目录，避免改动应用依赖：

```powershell
npm install --prefix node_modules/.cache/mascot-vector --ignore-scripts --no-audit --no-fund '@visioncortex/vtracer@1.0.0-alpha.4'
node assets/mascot/trace.cjs
```

第四版生成图使用白底。去背景时先在独立的分割遮罩中闭合手绘断线，再执行边界填充并收回遮罩扩张；原图线条和颜色不作加粗或重绘。较大的断线修复仅用于右下袖口，并保留举笔手臂与头发间的留白。这样可去除背景，同时保留白发、肤色和衣服的浅色填充。

随后过滤半透明边缘和小于 100 像素的独立透明度岛，使用最多 192 色、贝塞尔曲线和 0.7 像素简化误差，保留眼睛高光和细线；图形外留 48 像素边距。SVG 经透明背景、白发、手部与留白采样及深浅色预览检查。
