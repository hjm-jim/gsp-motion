# 调用协议

`gsp-motion.exe render <input.gsp|input.json> --point A --from -30 --to 30 --background white --labels true --duration 8 --fps 30 --width 1280 --height 720 --output <clip.mp4> --json`

或 `gsp-motion.exe render --request <request.json> --json`。必须有输入和 MP4 输出路径。字段如下：

| JSON 字段 / CLI 参数 | 约束 |
|---|---|
| input / 位置参数 | GSP 或查看器解析 JSON 路径 |
| infoMd / --info-md | 自动图形信息 MD 的可选路径，默认输入文件旁的同主文件名 .info.md；无需单独生成命令 |
| output / --output | MP4 路径；成功后覆盖同名文件 |
| point / --point | 唯一原图标签或对象编号，默认 A |
| from、to | 相对原始位置，圆为度、直线为距离；必须不同且为有限数 |
| background | white（默认）或 black |
| labels | 布尔值；CLI 为 true/false，默认 true，保留原有点名和线名，不自动命名 |
| labelSize / --label-size | 0.7+，字号像素，有限数 12..96，默认 32；自动避让线条、点、强调弧线与其他名称 |
| duration、fps | (0,3600] 秒；整数 1..120，默认 8 和 30 |
| width、height | 320..7680 的偶数，默认 1280 和 720 |
| direction | 仅圆允许 cw（默认）/ccw，规定正角方向 |
| report | 可选诊断 JSON 路径；不进入视频 |
| effects | 0.4+ 的效果数组，见 [强调效果](effects.md)；CLI 使用 --effects 指向数组文件 |
| visibility | 0.5+ 的显式 hide/show 事件数组，见 [隐藏与显示](visibility.md)；CLI 使用 --visibility 指向数组文件 |
| mode | motion（默认）或 static；static 保持原图位置，不允许 point/from/to/turns/direction |
| fixed、concyclic、perpendicular | 可选逗号分隔编号或标签，仅影响数值诊断，不增加画面文字 |
| turns | 兼容旧整周参数，仅圆允许，与 from/to 互斥；通常不用 |

需求 JSON 只允许表中字段，拼错字段明确报错。相对 input/output/report/infoMd 路径相对于需求 JSON 文件目录；直接 CLI 路径相对于调用者当前目录。CLI 的 `--ffmpeg`、`--sharp-module` 是高级运行库覆盖选项，不接受到需求 JSON 中。inspect/render/animate 解析输入时自动写入 info.md，返回绝对路径字段 infoMd 和输入字节指纹 sourceSha256。

输出 JSON 成功示例：`{"ok":true,"output":"C:\\output\\clip.mp4","background":"white","labels":true,"motionKind":"line","from":-50,"to":50,"loop":false,"duration":8,"fps":30,"frames":240,"invalidSamples":0,...}`。失败为 `{"ok":false,"error":{"message":"..."}}`，退出码 1。stderr 是进度或底层诊断，不能仅因 stderr 非空判断失败。

首尾取样均包含区间端点。帧数 N=max(2,ceil(duration×fps))，逻辑取样时间为 duration×i/(N−1)，编码时长为 N/fps。默认准确为 8 秒、240 帧，无音频轨道。

0.7+ 返回 `labelSize` 和 `labelCollisionSamples`。后者统计仍存在标签碰撞的实际渲染帧数（无标签模式为 0），不会把诊断放进画面。

Python 调用（Windows，无需 shell）：

```python
import json, os, subprocess
exe = os.path.expanduser(r"~\.local\bin\gsp-motion.exe")
run = subprocess.run([exe, "render", "--request", r"C:\data\request.json", "--json"],
                     capture_output=True, text=True, encoding="utf-8")
result = json.loads(run.stdout)
if run.returncode != 0 or not result.get("ok"):
    raise RuntimeError(result.get("error", run.stderr))
print(result["output"])
```

Node.js 调用：

```javascript
const { spawn } = require('node:child_process');
const path = require('node:path');
const exe = path.join(require('node:os').homedir(), '.local', 'bin', 'gsp-motion.exe');
const p = spawn(exe, ['render', '--request', 'C:\\data\\request.json', '--json'], { windowsHide:true });
let stdout=''; p.stdout.on('data', b=>stdout+=b);
p.stderr.on('data', b=>process.stderr.write(b));
p.on('error', console.error);
p.on('close', code=>{const result=JSON.parse(stdout); if(code!==0||!result.ok) throw Error(JSON.stringify(result)); console.log(result.output);});
```
