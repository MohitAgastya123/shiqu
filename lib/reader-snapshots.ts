// Keep previous poll snapshots when the server returns identical data, so React state setters bail out.
// Rows compare by serialized value; a false mismatch only costs a render, never stale data.
export function sameSnapshot(a:unknown,b:unknown){return a===b||JSON.stringify(a)===JSON.stringify(b);}

export function keepSnapshot<T>(previous:T,next:T):T{return sameSnapshot(previous,next)?previous:next;}

// Reuse unchanged rows by key; return the previous array itself when nothing changed, including order.
export function shareRows<T>(previous:readonly T[],next:readonly T[],key:(row:T)=>string):T[]{
 const old=new Map(previous.map(row=>[key(row),row]));
 let changed=previous.length!==next.length;
 const rows=next.map((row,index)=>{
  const prior=old.get(key(row)),kept=prior!==undefined&&sameSnapshot(prior,row)?prior:row;
  if(kept!==previous[index])changed=true;
  return kept;
 });
 return changed?rows:previous as T[];
}
