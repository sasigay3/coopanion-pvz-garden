const SUN=new Set(['sun','small_sun','large_sun']);
const COINS=new Set(['silver_coin','gold_coin','diamond','coin']);
/** Keep sun and money in separate batches so coin pickup cannot earn a sun bonus. */
export function pickAutoTargets(board,now,lastCoinAt,allowCoins=true){
 const items=board?.collectibles||[];
 const sun=items.filter(x=>SUN.has(x.kind)).map(x=>x.id);
 const coins=allowCoins?items.filter(x=>COINS.has(x.kind)).map(x=>x.id).slice(0,4):[];
 if(coins.length&&(!sun.length||now-lastCoinAt>=5000))return {kind:'coins',ids:coins};
 return {kind:'sun',ids:sun};
}
