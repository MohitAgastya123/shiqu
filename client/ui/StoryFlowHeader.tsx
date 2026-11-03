// Own the placement and labels of story-level navigation across creation, editing and settings.
// Callers supply existing actions and locks; this header never starts production on its own.
import './story-flow-header.css';

type FlowAction={onClick:()=>void;disabled?:boolean;title?:string};
export type StoryFlowNavigation={source?:FlowAction;reselect?:FlowAction;reselecting?:boolean};
export default function StoryFlowHeader({title='制作流程',source,reselect,reselecting=false}:StoryFlowNavigation&{title?:string}){
 return <div className="yu-flow-header"><h3 className="yu-flow-title">{title}</h3>{(source||reselect)&&<nav aria-label="制作流程导航">
  {source&&<button type="button" onClick={source.onClick} disabled={source.disabled} title={source.title}>原文</button>}
  {reselect&&<button type="button" onClick={reselect.onClick} disabled={reselect.disabled||reselecting} title={reselect.title}>{reselecting?'正在创建…':'重新选择故事'}</button>}
 </nav>}</div>;
}
