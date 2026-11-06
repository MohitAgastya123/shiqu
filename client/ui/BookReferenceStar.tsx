// English interface: labels, accessibility text, and workflow messages use English.
// Keep the page reference distinct from whole-story favorites, with explicit saved/loading state.
import {Star} from 'lucide-react';
export default function BookReferenceStar({selected,disabled,busy,onClick}:{selected:boolean;disabled:boolean;busy:boolean;onClick:()=>void}){
 const label=selected?"Remove book reference image":"Use as this book's reference image (one per book)";
 return <button type="button" className={'yu-glass yu-reference-star'+(selected?' is-selected':'')} aria-label={label} title={busy?"Saving reference image…":label} aria-pressed={selected} aria-busy={busy} disabled={disabled||busy} onClick={onClick}><Star size={20} fill={selected?'currentColor':'none'}/></button>;
}
