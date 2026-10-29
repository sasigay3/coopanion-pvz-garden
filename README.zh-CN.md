# Coopanion PvZ Garden

[English](README.md) · [上游原项目](https://github.com/Phantivia/cortico-world-pvz)

这是一个实验性的 Windows Coopanion/Cortico 游戏扩展，让 AI 桌宠观察游戏状态并自主尝试玩 **植物大战僵尸年度版**。项目基于 `cortico-world-pvz` 修改，是独立的第三方项目，并非 Coopanion 官方扩展。它只负责游戏，不包含直播弹幕采集或点歌。

> **实验性项目**：目前只验证了下面列出的游戏文件指纹。名称相似的年度版、高清版、汉化版或魔改版不一定兼容。项目不包含游戏及游戏素材；使用前请备份游戏存档。

## 支持的游戏版本

本机实测的游戏为 Windows x86 程序，版本信息显示 **1.2.0.1073**，持有者的安装包标为中文高清年度版。是否兼容以实际文件大小及 SHA-256 为准：

| 文件 | 大小（字节） | SHA-256 |
| --- | ---: | --- |
| `PlantsVsZombies.exe` | 3,703,808 | `05a3f55a3889b1820bca844b26bb6bea1a058522ba842711e1c7d2000efad8d0` |
| `main.pak` | 60,371,863 | `71b0cd561252d1bcbcbe1b7b2e157791b5843fb8cd94ca42945048c269c3bf17` |

扩展会检查这两个文件，版本号相同不代表指纹相同。可在 PowerShell 使用 `Get-FileHash -Algorithm SHA256 -LiteralPath '游戏目录\PlantsVsZombies.exe'`，并对 `main.pak` 运行相同命令。游戏需自行准备，不要关闭指纹校验去强行运行其他版本。

## 功能

- 将棋盘、卡片、僵尸、菜单和任务队列提供给模型，让桌宠尝试选卡、种植、铲除植物、操作菜单和推进关卡。
- 自动收取阳光；普通冒险及生存棋盘会尝试分批收取金币和钻石；确认胜利后尝试领取通关奖励。
- 提供冒险夜晚选卡、泳池承载物、商店升级植物及生存阶段选卡等辅助策略。模型仍可能误判或失败，不保证通关。
- 提供自愿开启的阳光保底、卡片快速冷却、手动加 200 阳光及每次确认自动收取阳光后的额外奖励。这些功能会写入游戏进程内存，默认关闭，只在通过检查的棋盘状态下生效；阶段切换时为了避免加到错误棋盘，奖励可能被跳过。

本机体验过部分冒险、夜晚、泳池和生存关卡；屋顶、僵王、特殊玩法及所有阶段切换尚未全面验证，不能保证本游戏全部玩法或其他版本都能运行。

## 环境要求

- Windows 10/11 64 位，以及上面指纹对应的 32 位游戏和资源文件，游戏需自行准备。
- 支持 World API 6 的 Coopanion/Cortico；本机使用 Coopanion 0.2.13，其他版本尚未逐一验证。
- Visual Studio Build Tools、x86 C++ 工具链及 Windows SDK，用于在本机编译原生组件。
- 从源码构建需要 Node.js 22 以上及 pnpm；使用可选辅助开关需要 `PATH` 中有 Python 3。
- Coopanion 已配置可用模型；实际玩法效果和模型费用取决于所用模型。

## 从源码安装

本项目目前没有发布 npm 包。先克隆或下载仓库，在项目目录构建界面：

```powershell
corepack pnpm install
corepack pnpm run build
```

打开 Coopanion 的**高级模式 → 扩展**，通过本地路径方式安装此项目目录；然后重启 Coopanion，在 **World 总览**启用扩展，进入配置选择自己的 `PlantsVsZombies.exe`，再从游戏面板启动。不同 Coopanion 版本的本地安装入口可能不同，可参考[上游安装说明](https://github.com/Phantivia/cortico-world-pvz#relationship-with-cortico)。如果使用本地链接安装，需要保留项目目录。

## 实现原理

1. 扩展先核验游戏文件，在本机用 MSVC 编译 32 位注入器和原生 DLL。
2. 扩展启动并管理游戏，把 DLL 注入经过验证的游戏进程，通过 Windows 命名管道通信；进程身份和所有权校验用于限制操作对象。
3. 原生桥读取受支持的游戏内部状态，整理成棋盘、植物、卡片、僵尸和菜单等结构化快照，通过游戏内部输入执行任务，并结合回执与后续状态核对结果。
4. Coopanion 将状态、事件和工具提供给模型，由模型做选择；扩展的任务队列及光标约束负责协调操作和后台拾取。
5. 可选辅助由单独的 Python 进程在明确开启后检查并修改特定内存字段，保留程序指纹和棋盘状态校验；它改变游戏难度，基本游戏控制不依赖这些辅助。

本项目使用内存读取和 DLL 注入，不使用屏幕 OCR。游戏内部结构不是稳定公开接口，游戏或运行环境变化可能导致不兼容。

## 开发与测试

```powershell
corepack pnpm install
corepack pnpm run build
corepack pnpm test
node --test scripts/test-auto-pickups.mjs scripts/test-sun-bonus.mjs
python scripts/test-assist-probe.py
corepack pnpm exec tsx scripts/test-live-guards.mjs
```

现有测试只覆盖部分保护和拾取逻辑，不能代替所有玩法的实机测试。**从上游继承的完整 Vitest 测试在本分支尚未全部通过**：一次排除原生测试的运行中有 735 项通过、23 项失败，涉及自动捡金币与状态输出等变化，失败原因仍需逐项排查，不能视为功能正确的证明。`UPSTREAM_README.md` 和 `src/native/ADAPTING.md` 保留上游实现资料，其中若提及其他版本指纹，应以上表和 `src/fingerprint.ts` 为准。

## 作者与许可证

本项目基于 [Phantivia/cortico-world-pvz](https://github.com/Phantivia/cortico-world-pvz)，上游版权 © 2026 Phantivia，采用 MIT 许可证；原版权和许可证声明保留在 [LICENSE](LICENSE)。仓库所有者及项目方向：[sasigay3](https://github.com/sasigay3)；适配、实现和文档由 **OpenAI Codex** 协作完成。其他声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
