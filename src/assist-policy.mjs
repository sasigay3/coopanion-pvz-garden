/** Pure guard for a future opt-in assist backend. Does not access or write process memory. */
export function planAssist(snapshot,{enabled=false,sunFloor=1000,fastCooldown=true}={}){
  if(!enabled||snapshot?.screen!=='board'||!snapshot.board||snapshot.board.paused||snapshot.lastRun?.runId===snapshot.board.runId)return {sun:null,cards:[],reason:'inactive'};
  const b=snapshot.board;
  if(!['adventure','survival'].includes(snapshot.modeKind)||b.special||b.tutorial||b.conveyor)return {sun:null,cards:[],reason:'unsupported'};
  if(!Number.isSafeInteger(b.sun)||b.sun<0||!Number.isInteger(sunFloor)||sunFloor<0||sunFloor>9990)return {sun:null,cards:[],reason:'invalid'};
  const cards=fastCooldown?(b.cards||[]).filter(c=>Number.isInteger(c.slot)&&c.slot>=0&&c.slot<10&&c.active===true&&c.refreshing===true).map(c=>c.slot):[];
  return {sun:b.sun<sunFloor?sunFloor:null,cards,reason:'ok'};
}
