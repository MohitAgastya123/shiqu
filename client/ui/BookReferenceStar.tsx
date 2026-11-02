// Keep the page reference distinct from whole-story favorites, with explicit saved/loading state.
import {Star} from 'lucide-react';
export default function BookReferenceStar({selected,disabled,busy,onClick}:{selected:boolean;disabled:boolean;busy:boolean;onClick:()=>void}){
 const label=selected?'取消本书参考图':'设为本书参考图（每本书仅一幅）';
 return <button type="button" className={'yu-glass yu-reference-star'+(selected?' is-selected':'')} aria-label={label} title={busy?'正在保存参考图…':label} aria-pressed={selected} aria-busy={busy} disabled={disabled||busy} onClick={onClick}><Star size={20} fill={selected?'currentColor':'none'}/></button>;
}
