# 隐藏与显示（0.5 源码版）

通过显式对象列表控制任意已支持的解析几何对象，包括点、线段、直线、射线、圆、三点弧和派生对象。每次操作指定完整的 hide/show 目标列表；不会自动推断或删除依赖对象。

操作是指定时刻的即时切换，状态保持到该对象下一个事件；整段结束后保持最后状态，不恢复原图可见性。未指定 at 时从 0 秒生效。隐藏不是画背景色遮盖，也不是只关闭高亮，而是不输出该对象的绘图元素。

## 本次静态显隐演示

保持 GSP 原始几何位置：0 秒隐藏 AB/AC，2 秒显示 AB，4 秒显示 AC，6 秒同时隐藏 AB/AC，8 秒停止并保留两边隐藏的状态。B、C、A、圆和 BC 始终保留。

```powershell
node cli.cjs render --request examples/request-visibility-circle.json --json
node cli.cjs render --request examples/request-visibility-circle.json --background black --output visibility-output/circle-black.mp4 --json
```

生成 `visibility-output/circle-white.mp4` 和 `circle-black.mp4`，均为 8 秒、1280×720、30 fps、240 帧，无音频。没有解说字符，保留原图点标签。

完整需求示例：

```json
{
  "input":"./demo1_triangle_circumcircle.gsp",
  "output":"../visibility-output/circle-white.mp4",
  "mode":"static",
  "duration":8,
  "background":"white",
  "visibility":[
    {"at":0,"hide":[7,8]},
    {"at":2,"show":[7]},
    {"at":4,"show":[8]},
    {"at":6,"hide":[7,8]}
  ]
}
```

`mode: static` 不需要驱动点，保持原始几何，不填写 point/from/to/turns/direction。默认 `mode: motion` 仍可在点运动期间使用同一 visibility 接口。JSON 路径相对于需求文件目录。

## 显式列表规则

```json
[
  {"hide":[7,8]},
  {"at":2,"show":[7,8]},
  {"at":4,"hide":["A",3]},
  {"at":6,"show":["A",3]}
]
```

以上展示多线一并控制，以及点 A 和圆 #3 的一并控制。标签必须唯一；无标签或重名时使用 inspect 得到的编号。此例中的编号仅适用于当前圆样例。

- hide/show 数组支持一个或多个对象，空事件、未知编号和拼错字段会报错。
- at 在 0 到总时长之间，可精确设置为结束时刻；没有对应事件的对象沿用 GSP 原本的显隐状态。
- 后续时刻覆盖该对象先前的状态。相同时刻同时指定隐藏和显示时，隐藏优先，与配置条目顺序无关。
- 显式 show 可覆盖 GSP 的原有隐藏标记，但不能使无定义或不支持的几何变为有效。
- 隐藏线同时隐藏它的高亮描线。隐藏点同时隐藏其点标记及标签。其他依赖对象、角标、填色仍独立控制，几何计算不受影响。
- 三角形染色和角标是效果层，不是 GSP 对象编号；需要关闭它们时设置对应 effects 的 end，不把虚构编号填进 hide 列表。
- 视频按帧取样。事件在首个逻辑时间不早于 at 的导出帧生效；极短窗口可能没有视频帧命中，HTML 可精确跳转到该时刻查看。

单独配置文件的内容是上述数组：

```powershell
node cli.cjs animate examples/demo1_triangle_circumcircle.gsp --mode static --visibility examples/visibility-circle.json --out visibility-preview
node cli.cjs render examples/demo1_triangle_circumcircle.gsp --mode static --visibility examples/visibility-circle.json --output visibility-output/custom.mp4 --json
```

整段隐藏写为 `[{"hide":[7,8]}]`；显示原本隐藏的对象写为 `[{"show":[7,8]}]`。不使用 opacity=0 伪装隐藏，不修改 GSP 文件本身。

## 验证与版本

35 项自动测试通过，包含静态位置、整段隐藏、分时显示、终态保持、隐藏高亮描线、显示原本隐藏的点/线/圆、短时窗口的镜头范围和错误输入。浏览器取样的几何和 SVG 与 CLI 一致，播放到终点停止。两份视频规格经 FFprobe 核验；`visibility-contact-sheet.png` 为实际视频的 1/3/5/7 秒抽帧。

该功能从 0.5 起提供，现已包含在 0.6 完整安装版中。上述源码命令的 `node cli.cjs` 可替换为安装后的 `gsp-motion`。验证结果是 0.5 开发轮次的记录；0.6 安装轮次按用户要求未再生成测试文档或视频。
