# Third-party notices

This project is a derivative of Phantivia's MIT-licensed cortico-world-pvz. The original copyright and license are preserved in LICENSE. No game files or game assets are included.

## The game

PopCap's Plants vs. Zombies is the operator's own installation. `worlds.pvz-hd.executable` points at
it; the package hashes `PlantsVsZombies.exe` and `main.pak` before launch and refuses any other
build. Neither file, nor any asset extracted from them, is part of this repository or of the npm
package.

## Toolchain

The injector and implant are compiled on the operator's machine with Microsoft Visual Studio
Build Tools (x86 MSVC, Windows SDK). Nothing is downloaded by the package; the toolchain is
installed and licensed by the operator.

## Research sources

Public source used as behavioral documentation for this executable family. No code from them is
included; addresses were re-established against the supported build.

- [PvZ-A11y](https://github.com/game-a11y/PvZ-A11y), MIT
- [re-plants-vs-zombies](https://github.com/Patoke/re-plants-vs-zombies), CC0
- [Plants-vs.-Zombies-Online-Battle](https://github.com/Zhuagenborn/Plants-vs.-Zombies-Online-Battle), MIT

## This package

MIT, see `LICENSE`. The framework [Cortico](https://github.com/Pal-AI-Lab/Cortico) is MIT as well;
the two are connected through the extension contract and licensed separately.
