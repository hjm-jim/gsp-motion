# 安装 CLI 与 skill

仓库：https://github.com/hjm-jim/gsp-motion

当前提供 **Windows x64** 的完整安装和源码构建。推荐普通用户使用 Release 包；macOS、Linux 和 Windows ARM64 暂无打包安装支持。

## 从 GitHub 安装（推荐）

需要 Git 和 Windows PowerShell 5.1+ / PowerShell 7。运行：

```powershell
git clone https://github.com/hjm-jim/gsp-motion.git
cd gsp-motion
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

脚本从本仓库最新正式 Release 下载完整 ZIP 和 SHA256SUMS，校验后再安装 CLI 和 skill。包内包含 Node.js、sharp、FFmpeg；不需要预装这些运行库、npm、Python 或管理员权限。下载需要网络。

固定版本可加 `-Version v0.7.1`。如果 GitHub API 限流，固定版本可跳过 latest API 查询。

没有 Git：在 [Releases](https://github.com/hjm-jim/gsp-motion/releases/latest) 下载 `gsp-motion-<版本>-win-x64.zip` 和 SHA256SUMS，运行 `Get-FileHash <ZIP路径> -Algorithm SHA256` 比对，解压后运行包内的 `install.ps1`：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

仓库根的 install.ps1 负责下载；ZIP 内的 install.ps1 负责从本地包安装。ZIP 解压后也可直接运行 gsp-motion.exe，不安装 CLI；要让 AI 发现 skill，则应运行安装脚本。

## 安装位置与检查

| 内容 | 默认位置 |
|---|---|
| CLI 入口 | `%USERPROFILE%\.local\bin\gsp-motion.exe` |
| 程序和内置运行库 | `%LOCALAPPDATA%\Programs\GspMotion` |
| AI skill | `$CODEX_HOME\skills\gsp-motion`；未设置 CODEX_HOME 时为 `%USERPROFILE%\.codex\skills\gsp-motion` |

安装会把 CLI 入口目录加入当前用户 PATH。旧终端应重新打开；固定绝对路径可立即使用。

```powershell
& "$env:USERPROFILE\.local\bin\gsp-motion.exe" --version
& "$env:USERPROFILE\.local\bin\gsp-motion.exe" doctor --json
```

版本应为 0.7.1 或更高，doctor 应返回 `ok:true`。CLI 可由任何程序通过进程参数数组调用；不依赖 Codex 才能运行。AI 客户端需要支持相应 skill 目录；安装 skill 后新开会话以刷新发现。

所有安装器支持 `-AppRoot`、`-BinRoot`、`-SkillRoot` 指定目录，以及 `-NoPath` 不修改用户 PATH。例如用于独立验证：

```powershell
.\install.ps1 -Version v0.7.1 -AppRoot C:\tools\gsp\app -BinRoot C:\tools\gsp\bin -SkillRoot C:\tools\gsp\skill -NoPath
```

安装会更新目标目录中的同名程序与 skill 文件。更新时重新运行同一安装命令即可；不要在程序安装目录里保存自己的 GSP 或视频。下载失败或校验不符时不会调用本地安装器。

## 从源码安装

需要 Node.js **20.9+（含 npm）**、提供 libx264 编码器的 Windows x64 FFmpeg，以及 Windows 自带 .NET Framework C# 编译器。FFmpeg 可从 [官方下载入口](https://ffmpeg.org/download.html#build-windows)选择 Windows 构建，解压并加入 PATH；使用共享构建时保留所有相邻 DLL。

```powershell
git clone https://github.com/hjm-jim/gsp-motion.git
cd gsp-motion
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-source.ps1 -FfmpegPath C:\ffmpeg\bin\ffmpeg.exe
```

脚本通过 npm ci 安装锁定的 sharp，使用本机 Node 与 FFmpeg 构建完整包，再安装 CLI 和 skill。省略 FfmpegPath 时在 PATH 查找 FFmpeg；AppRoot / BinRoot / SkillRoot / NoPath 也适用。

只运行源码而不安装：

```powershell
npm ci
node cli.cjs --help
node cli.cjs doctor --ffmpeg C:\ffmpeg\bin\ffmpeg.exe --json
npm test
```

构建与归档供发布：

```powershell
$env:FFMPEG_PATH='C:\ffmpeg\bin\ffmpeg.exe'
node scripts/build-package.cjs
.\scripts\archive-release.ps1
```

将 dist 中的 ZIP 和 SHA256SUMS 附加到与 package.json 版本一致的 `v<版本>` GitHub Release。二进制运行库不放入 Git 历史。第三方许可证与源码入口见 [THIRD_PARTY.md](THIRD_PARTY.md)，重新分发新运行库时应更新对应记录。

## 常见问题

- PowerShell 执行策略阻止：使用上面的 `powershell -NoProfile -ExecutionPolicy Bypass -File ...`，不必永久修改机器策略。
- 找不到命令：新开终端，或直接调用 `%USERPROFILE%\.local\bin\gsp-motion.exe`。
- 安装 skill 后 AI 找不到：核对 CODEX_HOME 和目标客户端的 skill 发现目录，新建会话；CLI 可独立调用。
- doctor 失败：完整 ZIP 应整体解压，保留 runtime、node_modules、tool 等子目录；不能只复制 exe。
- Windows 报下载文件来源提示：核对仓库、Release 版本和 SHA256，再按本机策略处理；本项目未提供代码签名。
- 源码模式找不到 sharp：在仓库根运行 npm ci；不需要任何开发者的本机缓存路径。
