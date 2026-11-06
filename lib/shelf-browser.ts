// English product text and generation contracts; canonical source evidence remains unchanged.
// Share shelf search and grouping across desktop and reader while preserving story order within groups.
export type ShelfMetadata={title:string;book:string;theme:string;artStyleLabel:string};
export const shelfGroupings=[{value:'book',label:'Group by book'},{value:'theme',label:'Group by theme'},{value:'artStyle',label:'Group by style'},{value:'status',label:'Group by status'},{value:'none',label:'No grouping'}] as const;
export type ShelfGrouping=typeof shelfGroupings[number]['value'];
export function matchesShelfSearch(item:ShelfMetadata,query:string){
 const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase();
 const haystack=normalize([item.title,item.book,item.theme,item.artStyleLabel].join(' '));
 return normalize(query).trim().split(/\s+/).every(term=>haystack.includes(term));
}
export function groupShelfByBook<T extends {book:string}>(items:T[]){
 const groups=new Map<string,T[]>();
 for(const item of items){const book=item.book||'Other sources';const group=groups.get(book);if(group)group.push(item);else groups.set(book,[item]);}
 return [...groups].map(([book,items])=>({book,items}));
}
export function groupShelfItems<T extends ShelfMetadata&{processingStatus:string}>(items:T[],grouping:Exclude<ShelfGrouping,'none'>){
 const groups=new Map<string,T[]>();
 for(const item of items){
  const label=grouping==='book'?item.book||'Other sources':grouping==='theme'?item.theme||'Theme not recorded':grouping==='artStyle'?item.artStyleLabel||'Style not recorded':item.processingStatus;
  const group=groups.get(label);if(group)group.push(item);else groups.set(label,[item]);
 }
 const result=[...groups].map(([label,items])=>({label,items}));
 if(grouping==='status'){
  const order=['Generating','Queued','Ready to discover','Choose a story','Confirm production','Choose frame count','Paused','Failed','Complete'];
  result.sort((a,b)=>order.indexOf(a.label)-order.indexOf(b.label));
 }
 return result;
}
