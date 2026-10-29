# Coopanion PvZ Garden

[中文版](README.zh-CN.md) · [Upstream project](https://github.com/Phantivia/cortico-world-pvz)

An experimental Windows-only Coopanion/Cortico World that lets an AI companion observe and autonomously play a verified build of **Plants vs. Zombies GOTY**. This is an independent derivative of `cortico-world-pvz`, not an official Coopanion extension. It does not provide livestream, chat collection, or music features.

> **Experimental:** the exact executable and asset fingerprints below are required. Similar-looking GOTY or HD releases, mods, and different localizations are not necessarily compatible. This project does not include the game or any game assets. Back up your game saves before use.

## Supported game build

Tested locally against a Windows x86 game executable whose version resource reports **1.2.0.1073**. The game was distributed to its owner as a Chinese HD/GOTY build; the label alone does not identify the binary. The extension checks both exact sizes and SHA-256 hashes:

| File | Size (bytes) | SHA-256 |
| --- | ---: | --- |
| `PlantsVsZombies.exe` | 3,703,808 | `05a3f55a3889b1820bca844b26bb6bea1a058522ba842711e1c7d2000efad8d0` |
| `main.pak` | 60,371,863 | `71b0cd561252d1bcbcbe1b7b2e157791b5843fb8cd94ca42945048c269c3bf17` |

`main.pak` must be in the game installation as expected by the extension. Hashes can be checked in PowerShell with `Get-FileHash -Algorithm SHA256 -LiteralPath 'path\to\PlantsVsZombies.exe'` and the same command for `main.pak`. A matching version string is not enough; mismatches are rejected.

## What it does

- Exposes game state, available cards, zombies, menus and a task queue to the model; the model can select seeds, plant, shovel and navigate supported screens.
- Automatically collects sun and, on ordinary Adventure and Survival boards, attempts to collect coins and diamonds in separate batches. It attempts to pick up verified level rewards.
- Provides guardrails for night Adventure seed choices, pool tiles, upgrade plants and stage-aware Survival choices. These are aids, not guarantees of victory or complete mode coverage.
- Offers opt-in sun floor, faster card cooldown, one-click +200 sun, and an optional +200 per verified automatic sun pickup. These modify game process memory, are off by default, and only apply to guarded game states. The optional bonus may be skipped during a transition rather than applied to the wrong board.
- Keeps normal game control independent of any livestream or chat service.

Adventure, night, pool and some Survival play have been exercised locally. Roof, boss encounters, other challenges and all stage transitions have **not** been comprehensively validated in this fork. AI decisions and actions can fail; observe play and keep backups.

## Requirements

- Windows 10/11 x64 with the exact **32-bit** game build and assets above, supplied by the user.
- Coopanion/Cortico compatible with World API 6. This project is tested with the user's local Coopanion 0.2.13; other versions are not yet verified.
- Visual Studio Build Tools with the x86 C++ toolchain and Windows SDK. The native bridge is compiled locally on first use.
- Node.js 22 or newer and pnpm for building from source. Python 3 on `PATH` is required for the optional assist controls.
- A configured model provider in Coopanion; gameplay quality and cost depend on the selected model.

## Install from source

This repository is not published to npm yet. Clone or download it and build the WebUI in the project folder:

```powershell
corepack pnpm install
corepack pnpm run build
```

In Coopanion, switch to **Advanced mode → Extensions** and install the local project directory using the local path option. Restart the Coopanion process, enable the World in **World Overview**, open its configuration, select your own `PlantsVsZombies.exe`, and start the game through its game panel. If your Coopanion build has a different local-install flow, see the upstream [installation guide](https://github.com/Phantivia/cortico-world-pvz#relationship-with-cortico). Keep the repository directory available when using a linked local installation.

The extension checks the hashes and native signatures before enabling game actions. Do not remove those checks to force an unverified executable to run.

## How it works

1. The host verifies game files and compiles an x86 injector and native DLL from the included source with the user's local MSVC toolchain.
2. The extension launches and manages the game, injects the DLL into the verified process, and communicates with it through a named pipe. Ownership and process checks limit actions to the managed instance.
3. The native bridge reads supported game state and translates it into structured snapshots: board cells, plants, cards, zombies, menu state and progress. It issues game-internal input; queued actions use receipts and follow-up state to check outcomes.
4. Coopanion exposes the snapshots, tools and game events to its model. A model chooses actions; execution checks legality and shared cursor ownership. Background pickup is scheduled alongside game actions.
5. Optional assist controls use a separate guarded Python process to inspect and, when explicitly enabled, write specific game memory fields. Exact executable verification and board/scene checks remain in place; these controls can change game balance and are not needed for basic play.

The project uses game memory and DLL injection rather than screen OCR. Neither an injected process nor the game's internal structures are a stable public API; changes to the game or host can break compatibility.

## Development and testing

```powershell
corepack pnpm install
corepack pnpm run build
corepack pnpm test
node --test scripts/test-auto-pickups.mjs scripts/test-sun-bonus.mjs
python scripts/test-assist-probe.py
corepack pnpm exec tsx scripts/test-live-guards.mjs
```

The targeted tests cover parts of the safety guards and pickup logic, not every game mode. **The inherited full Vitest suite is not yet passing in this fork**: a non-native run produced 23 failures and 735 passes, including tests affected by automatic coin pickup and changed rendering. These failures still require investigation; they are not proof that the corresponding behavior is correct. Run real-game tests with a backup save before claiming compatibility. See `UPSTREAM_README.md` and `src/native/ADAPTING.md` for historical upstream design details; where those documents describe a different game fingerprint, the table above and `src/fingerprint.ts` are authoritative.

## Credits and license

This project derives from [Phantivia/cortico-world-pvz](https://github.com/Phantivia/cortico-world-pvz), copyright © 2026 Phantivia, under the MIT License. The original copyright and license notice is preserved in [LICENSE](LICENSE). Repository owner and project direction: [sasigay3](https://github.com/sasigay3); adaptation, implementation and documentation developed collaboratively with **OpenAI Codex**. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

