# 动态强调效果

该功能从 0.4 起提供，0.7 新增弓形弧线样式。以下源码示例的 `node cli.cjs` 可替换为安装后的 `gsp-motion`。

支持高亮一根/多根线、绘制角弧与半透明扇形、三角形半透明填色。效果在入场时绘出或渐显，退场时渐隐，始终跟随运动中的几何对象。多个效果的时间段可以重叠，支持同帧高亮多种元素。视频只保留原图点名与线名，不出现解说或调试面板。

## 用亮色弓形弧线连接线段两端（0.7+）

在原线旁绘制一条二次贝塞尔弓形弧线，保留原线，默认白底亮红、黑底亮黄。沿原 Segment 第一个端点绘向第二个端点，退场淡出；支持多段、动态联动与显隐。

```json
[
  {"type":"line","style":"arc","objects":[7,8],"side":"auto","bend":0.16,"enter":0.8,"exit":0.5}
]
```

保存为效果数组 JSON，传 `--effects <文件>`，或放入需求 JSON 的 effects。对象编号先 inspect 确认，示例 7、8 只适用于圆图。

| 新字段 | 用途 |
|---|---|
| style | line 专用；stroke（默认）沿原线描亮，arc 用弓形弧线连接两个端点，两种可并存 |
| side | arc 专用，auto / left / right，默认 auto；采样整个运动区间后选较空旷侧，播放中保持该侧 |
| bend | arc 专用，弧中点到原线的距离 / 原线长度，0.02..0.6，默认 0.16 |

left/right 相对第一个端点走向第二个端点；例如从左向右水平线，left 是屏幕上方。弧线随线段转动，不逐帧翻面。arc 仅接受有两个有限端点的 Segment，不能引用无限直线或射线。side/bend 不适用于 stroke。其余颜色、线宽、时间设置与原 line 一致。

## 使用

```powershell
# 读取完整需求（包含 effects 数组）
node cli.cjs render --request examples/request-effects-circle.json --json

# 黑底；命令行覆盖需求文件中的底色和输出文件
node cli.cjs render --request examples/request-effects-circle.json --background black --output effects-output/circle-black.mp4 --json

# 单独的效果配置文件，其内容为 JSON 数组
node cli.cjs render examples/demo1_triangle_circumcircle.gsp --point A --from -30 --to 30 --effects examples/effects-circle.json --background white --output effects-output/circle-white.mp4 --json

# 可交互预览，同样支持暂停、任意跳帧和终点停止
node cli.cjs animate examples/demo1_triangle_circumcircle.gsp --point A --effects examples/effects-circle.json --out effects-preview
```

先用 `inspect` 查找对象编号。圆示例中的 AB 是 #7、AC 是 #8。角的 points 顺序为“射线上的点、顶点、另一射线上的点”，所以 ∠BAC 写为 `["B","A","C"]`。

## 多元素同时高亮

```json
[
  {"type":"line","objects":[7,8],"start":1,"end":7,"enter":0.6,"exit":0.4,"color":"#df3038","width":7},
  {"type":"angle","points":["B","A","C"],"start":1,"end":7,"enter":0.6,"exit":0.4,"color":"#853fd0","radius":44,"fillOpacity":0.2},
  {"type":"triangle","points":["A","B","C"],"start":1,"end":7,"enter":0.6,"exit":0.4,"color":"#168cbd","fillOpacity":0.24}
]
```

上例在同一时间高亮两根线、一个角和一个三角形。需要多个角或多个三角形时，继续添加对应 effect，每个 effect 设置自己的三个点；给它们相同的 start/end 即可一并出现。每条线也可单独添加 effect 以设置不同颜色、时间或线宽。

| 字段 | 用途 |
|---|---|
| type | line / angle / triangle |
| objects | line 专用，非空数组；可引用一个或多个直线型对象编号或唯一标签 |
| points | angle / triangle 专用，三个不同的点编号或唯一标签；角以中间点为顶点 |
| start / end | 相对整段动画开头的秒数；默认 0 / 总时长，要求 0≤start<end≤总时长 |
| enter / exit | 入场、退场秒数；默认 0.5 / 0.4（短效果自动缩短），两者之和不可超过该效果持续时间 |
| color | 可选 #RGB / #RRGGBB；不设置时按白/黑底自动选择颜色 |
| opacity | 整个效果的不透明度，0..1，默认 1 |
| width | 描线线宽，像素，1..40；线默认 6，角默认 4 |
| fillOpacity | 叠加填色不透明度，0..1；角默认 0.16，三角形默认 0.24 |
| radius | angle 专用，角弧半径，像素，4..240，默认 42；会随相邻边长度自动缩小以避免越界 |

入场描线沿原对象的端点顺序进行；无限直线与射线在固定画面范围内绘制。角默认绘制两个方向间的小角（≤180°），不输出角度数值。三角形填色渐显，不影响原有边线与点。

时间进度是确定函数，暂停、倒序跳帧或直接导出某一帧都得到相同效果。start 时入场进度为 0，end 时效果已移除；enter 或 exit 设为 0 表示即时出现或消失。退化或无定义的目标在相应帧不绘制效果，不保留上一帧的形状。

## 本次 demo

仅使用用户要求的圆图：0–3 秒同时描绘 AB/AC，2.4–5.4 秒强调 ∠BAC，4.8–8 秒渐显三角形 ABC 的填色。交叠时间段可同时看到线与角、角与三角形。

`effects-output/circle-white.mp4`、`circle-black.mp4`：8 秒，1280×720，30 fps，240 帧，无音频。`effects-contact-sheet.png` 是实际视频抽帧，依次展示线、角、白底三角形和黑底三角形。

0.4 功能开发时的验证：26 项自动测试通过；离线 HTML 检查通过，任意跳帧结果与 CLI 一致、播放到终点停止；两份视频经 FFprobe 核验规格。该记录是历史验证；0.6 安装轮次按用户要求未再生成测试视频。
