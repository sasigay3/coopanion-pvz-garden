import type { PvzSnapshot } from './protocol.ts';
import { progressFilteredSeedChoices } from './unlocks.ts';
import { mechanicsForCard } from './card-mechanics.ts';
import type { PvzBoardState, PvzCard } from './protocol.ts';

/** A pad can be added only on a visible empty water square, with both cards usable and funded. */
export function waterPadNeeded(board: PvzBoardState, row: number, column: number, goal: PvzCard, pad: PvzCard | null): boolean {
  const cell=board.cells.find(c=>c.row===row&&c.column===column);
  const needsBase=new Set([0,1,2,3,5,6,7,10,13,17,18,23,28,29,30,32,34,39]);
  if(board.paused||!board.disclosure.entitiesVisible||board.fog.active||board.cursor.kind!=='normal'
    ||board.special||board.tutorial||!needsBase.has(goal.type)||goal.imitates!==null
    ||!cell||cell.terrain!=='water'||cell.playable!==true||cell.base!=='none'
    ||cell.blocker!=='requires_lily_pad'||!pad||pad.type!==16||pad.imitates!==null
    ||!pad.ready||!goal.ready||pad.cost===null||goal.cost===null)return false;
  return board.sun>=pad.cost+goal.cost;
}

/** Cherry bomb coverage stays on the same row and at most one column from the intended target. */
export function nearbyCherryWaterCell(board: PvzBoardState,row: number,column: number): number | null {
  if(!board.disclosure.entitiesVisible||board.fog.active)return null;
  const target=board.cells.find(c=>c.row===row&&c.column===column);
  if(!target||target.terrain!=='water'||target.blocker!=='occupied')return null;
  const intended=board.zombies.filter(z=>!z.hypnotized&&Math.abs(z.row-row)<=1&&Math.abs(z.columnPosition-column)<=1);
  if(!intended.length)return null;
  return [column-1,column+1].find(col=>board.cells.some(c=>c.row===row&&c.column===col
    &&c.terrain==='water'&&c.playable===true&&c.base==='lily_pad'&&c.blocker===null)
    &&intended.every(z=>Math.abs(z.columnPosition-col)<=1))??null;
}

/** The back two water columns are economy candidates, not targets to clear or overwrite. */
export function emptyPoolEconomyCells(snapshot: PvzSnapshot): Array<{row:number;column:number}> {
  const b=snapshot.board;
  if(snapshot.screen!=='board'||!b||b.background!==2||b.paused||b.special||b.tutorial
    ||!b.disclosure.entitiesVisible||b.fog.active||snapshot.lastRun?.runId===b.runId
    ||!['adventure','survival'].includes(snapshot.modeKind)||b.sun<150
    ||b.zombies.some(z=>!z.hypnotized&&z.speed!=='retreating'&&z.columnPosition<=5))return [];
  if(!b.cards.some(c=>c.type===1)||!b.cards.some(c=>c.type===16))return [];
  return b.cells.filter(c=>[3,4].includes(c.row)&&[1,2].includes(c.column)
    &&c.terrain==='water'&&c.playable===true&&(c.blocker===null||c.blocker==='requires_lily_pad')
    &&!b.plants.some(p=>p.row===c.row&&p.column===c.column&&p.type!==16))
    .map(c=>({row:c.row,column:c.column}));
}

/** Only suggest a ready cherry and a visible open water-pad cell that covers a near-home threat. */
export function poolEmergencyHint(snapshot: PvzSnapshot): {row:number;column:number;threatRow:number} | null {
  const b=snapshot.board;
  if(snapshot.screen!=='board'||!b||![2,3].includes(b.background)||b.paused||b.fog.active
    ||!b.disclosure.entitiesVisible||b.special||b.tutorial||snapshot.lastRun?.runId===b.runId
    ||!b.cards.some(c=>c.type===2&&c.ready&&c.affordable))return null;
  const threats=b.zombies.filter(z=>!z.hypnotized&&z.speed!=='retreating'&&[3,4].includes(z.row)&&z.columnPosition<=3.5)
    .sort((a,b)=>a.columnPosition-b.columnPosition);
  for(const z of threats){const cell=b.cells.find(c=>c.row===z.row&&c.terrain==='water'&&c.playable===true
    &&c.base==='lily_pad'&&c.blocker===null&&Math.abs(c.column-z.columnPosition)<=1);
    if(cell)return {row:cell.row,column:cell.column,threatRow:z.row};}
  return null;
}

/** Enforce only when the destination and both unlocked cards are known, and fixed cards leave room. */
export function missingNightCards(snapshot: PvzSnapshot): string[] {
  const picker = snapshot.seedPicker;
  if (snapshot.screen !== 'seed_picker' || !picker) return [];
  const level = snapshot.profile?.adventureLevel;
  const nightAdventure = snapshot.modeKind === 'adventure' && level !== undefined
    && ((level >= 11 && level <= 19) || (level >= 31 && level <= 39));
  // Survival preserves the existing board across stages: forcing early-game
  // mushrooms on every repick blocks stage-specific choices.
  if (!nightAdventure) return [];
  const choices = progressFilteredSeedChoices(snapshot.profile, picker.choices);
  const required = [{ id: 8, name: '小喷菇' }, { id: 9, name: '阳光菇' }];
  if (required.some(({id}) => !choices.some(c => c.id === id && c.state !== 'hidden'))) return [];
  const fixedOthers = picker.selected.filter(id => id !== 8 && id !== 9
    && picker.choices.some(c => c.id === id && c.fixed)).length;
  if (picker.capacity - fixedOthers < required.length) return [];
  return required.filter(({id}) => !picker.selected.includes(id)).map(({name}) => name);
}

/** The chooser does not expose background; use only known adventure/survival pool modes. */
export function missingPoolCard(snapshot: PvzSnapshot): string[] {
  const picker=snapshot.seedPicker;
  if(snapshot.screen!=='seed_picker'||!picker)return [];
  const level=snapshot.profile?.adventureLevel;
  const poolAdventure=snapshot.modeKind==='adventure'&&level!==undefined&&((level>=21&&level<=29)||(level>=31&&level<=39));
  const poolSurvival=snapshot.modeKind==='survival'&&/survival_(?:hard_|endless_)?(?:pool|fog)$/.test(snapshot.modeName);
  if(!poolAdventure&&!poolSurvival)return [];
  const choices=progressFilteredSeedChoices(snapshot.profile,picker.choices);
  if(!choices.some(c=>c.id===16&&c.state!=='hidden')||picker.selected.includes(16))return [];
  const fixed=picker.selected.filter(id=>picker.choices.some(c=>c.id===id&&c.fixed)).length;
  return fixed<picker.capacity?['荷叶']:[];
}

/** Only describe visible facts; fog or a special mode cannot be inferred away. */
export function poolLanesMissingDamage(snapshot: PvzSnapshot): number[] {
  const board=snapshot.board;
  if(snapshot.screen!=='board'||!board||![2,3].includes(board.background)||board.paused
    ||!board.disclosure.entitiesVisible||board.fog.active||board.special||board.tutorial
    ||!['adventure','survival'].includes(snapshot.modeKind)
    ||snapshot.lastRun?.runId===board.runId)return [];
  return [3,4].filter(row=>board.cells.some(cell=>cell.row===row&&cell.terrain==='water')
    &&!board.plants.some(plant=>plant.row===row&&!plant.sleeping&&!plant.squished
      &&mechanicsForCard({type:plant.type,imitates:null})?.roles.includes('sustained_damage')));
}

/** A win must belong to this exact board; never pick usable conveyor packets mid-game. */
export function wonAwardId(snapshot: PvzSnapshot | null): number | null {
  const board = snapshot?.board;
  if (!snapshot || snapshot.screen !== 'board' || !board || board.paused
    || !board.disclosure.entitiesVisible || !snapshot.executable.supported
    || !snapshot.presentation.managed || !snapshot.presentation.onScreen
    || snapshot.lastRun?.outcome !== 'won' || snapshot.lastRun.runId !== board.runId) return null;
  return board.collectibles.find(item => item.kind === 'seed_packet' || item.kind === 'trophy')?.id ?? null;
}
