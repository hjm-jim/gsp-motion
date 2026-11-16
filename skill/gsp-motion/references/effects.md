# 动态强调（0.4+）

意图边界先读 [意图到操作](intent.md)。高亮不改变显隐：只画当时可见目标的额外强调层，不自动 show 或隐藏其他图形。高亮结束后基础对象继续保持原有可见性。显示隐藏目标要用独立 visibility 事件；初始画面用 at:0。

## 点与圆高亮（0.9+）

```json
[
  {"type":"point","objects":["A","B"],"start":1,"end":5,"width":6},
  {"type":"circle","objects":[3],"start":1,"end":5,"width":8}
]
```

point.objects 接受一个或多个已解析点的编号/唯一原始标签，添加渐显加粗外圈；circle.objects 只接受 Circle 圆，沿圆周描绘加粗圈线。都跟随几何、支持 color/opacity/start/end/enter/exit/width；width 默认 6px，范围 1..40。保持基础样式和依赖，标签避让包含高亮外圈；隐藏对象时对应高亮同步消失。点高亮不是驱动点参数 point，圆高亮不是 triangle 填色。单独高亮无需运动，使用 mode:static。

对象在效果开始前已隐藏时，不会因为高亮而显示。再次 show 只在效果原时间窗内继续，不重置入场。end 时效果移除，基础对象的显隐不变；需要初帧有高亮时 enter:0。角标和三角形填色仍为独立标记，隐藏某个构造点不等于关闭这些标记。

需求 JSON 支持 `effects` 数组；CLI 可通过 `--effects effects.json` 读取单独的效果数组。多个条目使用相同或重叠起止时间即可一并高亮。每个条目独立配置颜色与动画时长；不要把多个效果强制串行。

```json
[
  {"type":"line","objects":[7,8],"start":1,"end":7,"enter":0.6,"exit":0.4,"width":7},
  {"type":"angle","points":["B","A","C"],"start":1,"end":7,"radius":42,"fillOpacity":0.2},
  {"type":"triangle","points":["A","B","C"],"start":1,"end":7,"fillOpacity":0.24}
]
```

先 inspect 确定真实对象编号。line.objects 是一个或多个已有直线型对象；angle.points 的中间点是顶点，绘制较小角；triangle.points 是三个点。多个角或三角形用多个条目表示。以上 7、8 仅为当前圆示例，不能套用到其他文件。

所有条目共有 start/end（秒）、enter/exit（进出时长，默认 .5/.4，短段自动缩短）、opacity（默认 1）、可选 color（#RGB 或 #RRGGBB）。时间必须在整段动画内，enter+exit 不可大于持续时间。start/end 默认 0/总时长。line.width 默认 6px；angle.width 默认 4px，radius 默认 42px，fillOpacity 默认 .16；triangle.fillOpacity 默认 .24。不指定 color 时自动匹配白/黑底。

动画分别是线描绘、角弧线绘出伴随半透明扇形、三角形填色渐显，退场渐隐。所有高亮跟随几何逐帧重算，不影响原构造。退化目标该帧跳过，不用旧位置补齐。end 时效果消失，不能把 end 解释为继续常驻。纯净视频不新增角度数值、说明或标题。

## 亮色弓形连接线（0.7+）

用户要“弧线连接线段起止点”时使用下面的 line 样式，两个端点来自原 Segment 的定义顺序。不要用 angle 类型代替。

```json
{"type":"line","style":"arc","objects":[7,8],"side":"auto","bend":0.16,"start":1,"end":7,"enter":0.8,"exit":0.5,"width":6}
```

- `style`：`stroke`（默认，沿原线描亮）或 `arc`（弓形弧线连接两端，保留原线）。两种样式可并存，objects 可列多条线段。
- `arc` 只接受有两个端点的 `Segment`；无限直线/射线没有两个有限端点，不能用于此样式。
- `side`：`auto`（默认，采样全区间选择较空旷一侧并保持）、`left` 或 `right`。方向相对于原线段第一个端点走向第二个端点；例如从左向右的水平线，left 弯向屏幕上方。线段转动时跟随相同侧，不逐帧翻面。
- `bend`：弧中点到原线的距离 / 线段长度，0.02..0.6，默认 0.16；无单位，随线段缩放。实现为二次贝塞尔弧。
- 颜色、线宽、时间沿用 line；默认白底亮红、黑底亮黄。enter 时沿弧从第一个端点绘至第二个端点，exit 淡出。目标被隐藏时弧线同步隐藏；无效/重合端点帧不画旧弧线。
- `side` / `bend` 仅用于 `style:"arc"`。省略 style 继续使用旧描线效果；不要把弧线参数发给旧于 0.7 的 CLI。

若用户只要求点运动，不自动添加效果。用户指定多个元素一并高亮时，把它们安排在同一时间窗；颜色、时间和对象未给出且影响表达时再澄清。
