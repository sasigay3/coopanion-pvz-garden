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

## Architecture and implementation

The project separates **observation and execution**, which must be deterministic, from **strategy**, which is chosen by the model. A typical decision cycle looks like this:

```text
Verified game process
   ↕ game state and internal input
Native DLL ↔ named pipe ↔ TypeScript World and task executor
                                  ↕ snapshots, events and tools
                         Coopanion + model provider
```

1. **Start and verify.** The World checks the executable and `main.pak`, builds the native bridge if needed, and starts the verified game through its injector. The native side also checks the process identity and relevant signatures before accepting input. The local profile contains build-specific addresses and layouts, which is why a different executable with the same version label is insufficient.
2. **Observe.** The injected DLL reads the game objects and sends structured snapshots over a named pipe. The World turns them into human-readable board and menu information, including cells, seed packets, sun, visible zombies, collectibles and progress. Visibility restrictions matter: the model is not promised information hidden by fog, darkness or unopened vases.
3. **Decide.** Coopanion provides the state, events, tool definitions and the game-specific instructions in [`src/ENV_PROMPT.md`](src/ENV_PROMPT.md) to the model. The model plans and requests actions. The prompt is strategy guidance, not a hard-coded solver, so different models and runs can make different choices.
4. **Execute and check.** The World validates requests, submits ordered tasks and sends native actions to the bridge. Input is directed to the game rather than moving the Windows system mouse. Receipts and later state distinguish a request being accepted from an action actually succeeding. The model can use the result to revise its next plan.

### Gameplay features

| Feature | Implementation approach | Practical limits |
| --- | --- | --- |
| Menus and seed selection | Menu and seed-picker state are exposed as semantic choices. The model requests menu actions or selects, replaces and confirms seeds; the executor checks capacity and respects fixed selections. | A displayed or requested card still has to be unlocked and available. Automatic selection can fail or require a different plan. |
| Planting and shoveling | The model chooses a plant and board position. The executor resolves the request against the current snapshot, while the native bridge checks and sends game input. Card cooldown, cost, tile and cursor state affect whether an action can succeed. | An earlier snapshot can become stale while zombies move. An accepted task is not proof of a successful placement. |
| Ordered plans and reactions | `pvz_hd_do` submits steps as a queue; steps can wait for readiness and affordability or skip when conditions are unmet. `pvz_hd_arm` registers conditions evaluated against later snapshots and queues actions when they become true. | Waiting steps can delay later actions. Triggers depend on visible state and available cards; execution can still fail. |
| Relative placement | For some actions the requested position can be resolved relative to a currently visible hostile zombie or an available flower pot at execution time. | Targets can disappear or have no legal tile; these actions may be skipped instead of guessing a position. |
| Automatic pickups and rewards | The World schedules automatic sun collection alongside game actions. Coin and diamond pickups are batched separately on eligible ordinary Adventure and Survival boards; verified level rewards are handled when detected. | Pickup is best effort, competes for game input and is not guaranteed to catch every item. Transition and reward behavior still needs more real-game coverage. |
| Optional assists | Independent controls enable a 1,000-sun floor or fast cooldown, add 200 sun once, or add a bonus after a verified automatic sun pickup. A separate Python helper checks the game identity, board, scene and relevant fields before writing process memory; bonuses are tied to the current mode and stage. | Disabled by default. Eligible Adventure and Survival combat boards only; paused, special or transitioning states can be rejected. A bonus may be skipped if the board cannot be safely confirmed. These controls are not an unlimited-compatibility cheat. |

### How the strategy is guided

Most tactical behavior is expressed as **instructions to the model** in [`src/ENV_PROMPT.md`](src/ENV_PROMPT.md), supplemented by programmatic checks in [`src/live-guards.ts`](src/live-guards.ts) and the executor. These are different kinds of safeguards: a prompt can influence a choice but cannot guarantee it, while a code check can reject or adjust particular actions.

- **Night Adventure:** before starting a normal night Adventure level, code attempts to include Puff-shroom and Sun-shroom when they are unlocked and selection rules permit it. It preserves fixed cards and reports if the required selection cannot be completed. This requirement does not apply to Survival.
- **Pool and fog:** the prompt asks the model to defend both water lanes and use Lily Pads where needed; daytime pool economy can start with Sunflowers in the first two water columns. Some pool selection and placement cases have additional checks. A Lily Pad alone is not treated as a complete defense.
- **Survival repicks:** the model is instructed to reassess each stage using visible enemy previews, existing defenses, resources and unlocked cards. It may replace economy plants in later stages when production is already sufficient, and consider anti-balloon plants when appropriate. This is guidance, not a guarantee that every wave gets a different lineup or the ideal counter.
- **Plant choice and upgrades:** after essential terrain and defense needs are met, the prompt favors usable higher-impact cards and asks the model to actually deploy them. Upgrade plants require their base plant, purchase/unlock and a legal position. Tall-nut is preferred over Wall-nut when available and appropriate; defensive placement is guided toward legal tiles farther from the house, subject to immediate threats.
- **Graves and formation:** in night or fog, the model is encouraged to consider Grave Buster and remove visible graves when safe and legal. During stable Survival play it is also encouraged to fill useful gaps, while keeping space for necessary defenses and responding to immediate danger first.
- **Special encounters:** prompts, state and actions include support for selected mechanics such as conveyor cards, Vasebreaker and the final boss. Their presence in the code does not mean every special mode or boss transition has passed end-to-end testing in this fork.

The model cannot purchase, use or infer cards that the game has not actually made available. It can also misread a situation or choose a poor strategy; keep the game observable and intervene when necessary.

### Source map

| Path | Responsibility |
| --- | --- |
| [`src/fingerprint.ts`](src/fingerprint.ts), [`src/native/profile.h`](src/native/profile.h) | Verified installation profile and build-specific native definitions. |
| [`src/native/`](src/native/) | x86 injector, in-process bridge, snapshot extraction and game input. |
| [`src/bridge.ts`](src/bridge.ts), [`src/runtime.ts`](src/runtime.ts) | Process/pipe lifecycle and runtime communication. |
| [`src/world.ts`](src/world.ts), [`src/executor.ts`](src/executor.ts), [`src/triggers.ts`](src/triggers.ts) | World integration, task execution, reactions and pickup scheduling. |
| [`src/tools.ts`](src/tools.ts), [`src/ENV_PROMPT.md`](src/ENV_PROMPT.md) | Model-facing action schemas and gameplay instructions. |
| [`src/live-guards.ts`](src/live-guards.ts), [`src/auto-pickups.mjs`](src/auto-pickups.mjs), [`src/sun-bonus.mjs`](src/sun-bonus.mjs) | Selected gameplay checks, pickup batching and verified bonus accounting. |
| [`scripts/pvz_assist_probe.py`](scripts/pvz_assist_probe.py), [`src/webui/`](src/webui/) | Guarded optional memory assists and host controls. |

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
