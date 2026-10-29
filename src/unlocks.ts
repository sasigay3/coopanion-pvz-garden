import type { PvzProfileProgress, PvzSeedChoice } from './protocol.ts';

export function adventureSeedCount(level: number): number {
  if (level < 1) return 0;
  const area = Math.floor((level - 1) / 10) + 1;
  const stage = ((level - 1) % 10) + 1;
  let count = (area - 1) * 8 + stage;
  if (stage >= 10) count -= 2;
  else if (stage >= 5) count -= 1;
  return Math.max(0, Math.min(count, 40));
}

export function seedAllowedByPublicProgress(
  profile: PvzProfileProgress | null,
  seed: number,
): boolean {
  if (!profile) return true;
  if (seed < 0 || seed >= 49) return true;
  // 商店升级卡和模仿者由原生选卡状态和购买记录判定；冒险基础卡解锁数最多 40，不能套用。
  // 调用者仍须检查该卡在原生 choices 中存在且不是 hidden，原生执行时也再次校验购买状态。
  if (seed >= 40) return true;
  if (profile.adventureCompletions > 0 || profile.adventureLevel > 50) return true;
  return seed < adventureSeedCount(profile.adventureLevel);
}

export function progressFilteredSeedChoices(
  profile: PvzProfileProgress | null,
  choices: readonly PvzSeedChoice[],
): readonly PvzSeedChoice[] {
  return choices.filter((choice) => seedAllowedByPublicProgress(profile, choice.id));
}
