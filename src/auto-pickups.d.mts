import type { PvzBoardState } from './protocol.ts';
export function pickAutoTargets(board: PvzBoardState, now: number, lastCoinAt: number, allowCoins?: boolean): { kind: 'sun' | 'coins'; ids: number[] };
