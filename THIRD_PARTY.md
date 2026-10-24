# 第三方运行库

本仓库自行编写的 CLI、渲染器、启动器、脚本与文档按 MIT 发布；几何核心来自同一项目已有的 GSP 查看器实现。项目不包含几何画板软件本体或其安装文件。第三方组件保留各自的许可证，不因本项目 MIT 而改变。

Windows 完整包独立启动 Node 与 FFmpeg，sharp 作为 Node 模块加载。准确版本与 npm 包许可证记录在包内 manifest.json；npm 包目录保留各自 LICENSE / NOTICE。包内 licenses 保存 Node 许可证、FFmpeg 完整版本说明、构建参数和 GPL 文本。

| 组件 | 许可证 / 源码与构建入口 |
|---|---|
| Node.js | MIT 及所包含组件许可证，https://github.com/nodejs/node；发行归档与源码：https://nodejs.org/download/release/ |
| sharp | Apache-2.0，https://github.com/lovell/sharp；固定版本见 package-lock.json |
| libvips 与 sharp 原生运行库 | LGPL-2.1-or-later 等；源码 https://github.com/libvips/libvips，预编译构建 https://github.com/lovell/sharp-libvips；具体依赖见原生 npm 包内 libvips-versions / THIRD-PARTY-NOTICES |
| FFmpeg | 当前完整包构建为 GPL-3.0-or-later（含 libx264）；https://ffmpeg.org/legal.html，源码 https://github.com/FFmpeg/FFmpeg |

0.7.1 完整包使用 Node v24.12.0、sharp 0.35.5；FFmpeg 版本标识 `N-118517-g2066c5526d-20250221`，原始二进制未修改，使用独立进程调用。对应 FFmpeg 源码：https://github.com/FFmpeg/FFmpeg/tree/2066c5526d ，同一 Release 附有 `ffmpeg-source-2066c5526d.tar.gz`。Windows 构建脚本与第三方依赖配方入口：https://github.com/BtbN/FFmpeg-Builds 。构建参数完整保存在 `licenses/FFMPEG-BUILD-CONFIG.txt`，不将本项目源代码误作 FFmpeg 的对应源码。

重新分发完整包时应保留这些许可证、通知和源码入口；构建者替换 FFmpeg / Node / sharp 时，应同步更新记录及所需源码材料。仅从本仓库源码安装时，使用者自行提供本地 FFmpeg；构建脚本会将其实际版本和配置写入 manifest / licenses。
