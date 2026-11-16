# GSP v5 原始样式字段

以下结果来自用户制作的五份独立 GSP 样例与原程序静态代码的交叉验证，不从截图猜测颜色值。解析范围是现有解析器支持的点、线段/直线/射线、圆与三点弧。文件魔数仍为 `GSP4`，不代表文件版本为 4；全局 tag 900 的 payload 首个 uint16LE 为 5 时，使用本次确认的布局。其他版本或非法样式编码返回 `nativeStyle:null` 和 `styleWarnings`，渲染采用默认外观。

## 对象头

对象 tag 2000 的 payload 起始位置为基准；不是文件的绝对偏移。

| 偏移 | 类型 | 含义 |
|---|---|---|
| +0x0A | uint16LE | 三个样式索引的组合 |
| +0x0C | uint8 | 红色 R |
| +0x0D | uint8 | 绿色 G |
| +0x0E | uint8 | 蓝色 B |
| +0x0F | uint8 | 原程序写为 0，不作为 alpha |

`packed & 0xF` 为线宽索引，`(packed >> 4) & 0xF` 为虚实线索引，`(packed >> 8) & 0xF` 为点大小索引；最高四位保留，已确认有效值为 0。点、线、圆、弧共享同一头布局；非适用的索引仍存在于记录中，但不参与绘制。

| 索引 | 线宽（输出 px） | 点半径（输出 px） | 点背景描边宽（输出 px） |
|---|---|---|---|
| 0 | 0.5（最细） | 1.5（最小） | 0 |
| 1 | 1（细） | 2（小） | 1 |
| 2 | 3（中等） | 4（中等） | 1.25 |
| 3 | 5（最粗） | 6（最大） | 1.5 |

虚实线：0 = dotted 点线；1 = dashed 长虚线；2 = solid 实线。原程序的长虚线使用 `[6,4]` 的画笔宽度倍数；SVG 因此使用 `[6×width,4×width]`。点线采用零长笔划和圆帽，间隔 `2×width`；SVG 与 GDI+ 的端点及抗锯齿可能有像素差异，不承诺逐像素复刻。宽度、半径与描边均固定在输出像素，不随几何镜头缩放。

RGB 的文件存储也可看作 Windows COLORREF 低三字节 `R | G<<8 | B<<16`，不能当成 `0xRRGGBB` 整数直接格式化。对象颜色与全局调色板独立；本次不通过调色板猜颜色。透明度、字体、标签位置及其他对象类型的样式未包含在本次映射内。

## 样例对应

`examples/style-*.gsp` 是用户提供的验证文件。对象编号仅适用于这组样例：#1 P、#2 A、#3 B、#4 线段 BA、#5 O、#6 Q、#7 圆 OQ、#8 F、#9 G、#10 H、#11 弧 FGH。

- base：线/圆/弧 `0x0122`（中等线宽、实线），点 `0x0221`（中等点）。
- color：#4 `#ff0000`，#7 `#00ffff`，#11 `#808080`；点仍 `#ff0000`。
- dash：#4 `0x0112` 长虚线，#7 `0x0102` 点线，#11 `0x0122` 实线。
- width：#4 `0x0120` 最细，#7 `0x0121` 细，#11 `0x0123` 最粗；中等由 base 验证。
- point-size：P `0x0221`；A/B `0x0321`；O/Q `0x0121`；F/G/H `0x0021`，对应中等/最大/小/最小。

文件校验和见 [样例指纹](style-fixtures.sha256)。测试针对二进制文件读取、图像输出和运动时保留样式，不以截图的显示缩放计算线宽。

## 静态证据

分析目标为 GSP5.03 Build 1014RK 解包后的 x86 PE；SHA-256 `42ff86f7d1e6fd43bfd75327b14427d0b2d081c79dcc2aea01b1d9fbaad20957`。仓库不包含原程序或反汇编正文。

- `0x43C9B0`：组合样式解码，三索引有效上限分别 4/3/4，最高四位须为 0。REA Evidence `ev_861f7d8d6f5ec21b1677b88fb0b2be15ac626cfae2689dd5af9e9fd7ade07a9e`。
- `0x43CA50`：对象通用读写，读取 header+0x0A 样式，header+0x0C..0x0E 颜色，反向序列化写回同字段。REA Evidence `ev_4f3508321286bda399c02fe86a4764dca35821a0a81f02a17bd28fc0a4cecb64`。
- 线宽常量表 `0x645208`，每行 28 字节，首个 float 为 0.5/1/3/5；初始化后 `0x53B47B` 用线宽索引选笔。
- 点常量表 `0x645278`，每行 28 字节，前两个 float 为半径与描边；`0x53BED0` 点绘制路径使用所选大小，填对象原色并用背景色描边。
- `0x4D46C0` 画笔构造：索引 0 选择 GDI+ Dot 和 Round DashCap；索引 1 使用 `0x6A4210` 的 `[6,4]`；索引 2 保持 Solid。

GDI+ 行为参考微软原始文档：[DashStyle](https://learn.microsoft.com/en-us/windows/win32/api/gdiplusenums/ne-gdiplusenums-dashstyle)、[DashCap](https://learn.microsoft.com/en-us/windows/win32/api/gdiplusenums/ne-gdiplusenums-dashcap)、[自定义虚线长度按笔宽计算](https://learn.microsoft.com/en-us/windows/win32/gdiplus/-gdiplus-drawing-a-custom-dashed-line-use)。另用本机 System.Drawing 离屏绘制验证了圆帽点线的周期；没有操作用户的桌面应用。

## 渲染规则

白底继承 GSP 原色；黑底采用 CLI 默认配色。两者都继承线宽、虚实线和点大小。旧 JSON 缺少 `nativeStyle` 时保留默认外观；需重新解析 GSP 才能获得原样式。自动 info.md 描述原始 GSP 样式，与某一帧的高亮覆盖、显隐和渲染背景区别开。
