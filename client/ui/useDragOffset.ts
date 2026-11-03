// Hold the in-progress swipe offset outside Reader state so pointer moves re-render only the surface that moves.
// Reader keeps one store per mount; the filmstrip and closing page subscribe through useSyncExternalStore.
import {useSyncExternalStore} from 'react';

export type DragOffset={get:()=>number;set:(distance:number)=>void;subscribe:(listener:()=>void)=>()=>void};

export function createDragOffset():DragOffset{
 let distance=0;const listeners=new Set<()=>void>();
 return {
  get:()=>distance,
  set:next=>{if(next===distance)return;distance=next;listeners.forEach(listener=>listener());},
  subscribe:listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
 };
}

export function useDragOffset(drag:DragOffset){return useSyncExternalStore(drag.subscribe,drag.get,drag.get);}
