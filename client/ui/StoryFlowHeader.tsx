// English interface: labels, accessibility text, and workflow messages use English.
// Own the placement and labels of story-level navigation across creation, editing and settings.
// Callers supply existing actions and locks; this header never starts production on its own.
import StoryFlowAction from './StoryFlowAction';
import './story-flow-header.css';

type FlowAction={label?:string;onClick:()=>void;disabled?:boolean;title?:string};
export type StoryFlowNavigation={source?:FlowAction;reselect?:FlowAction;reselecting?:boolean};
export default function StoryFlowHeader({title="Production workflow",status,source,reselect,reselecting=false}:StoryFlowNavigation&{title?:string;status?:string}){
 return <div className="yu-flow-header"><h3 className="yu-flow-title">{title}{status&&<span className="yu-flow-status"> · {status}</span>}</h3>{(source||reselect)&&<nav aria-label="Production workflow navigation">
  {source&&<StoryFlowAction type="button" onClick={source.onClick} disabled={source.disabled} title={source.title}>Source</StoryFlowAction>}
  {reselect&&<StoryFlowAction type="button" onClick={reselect.onClick} disabled={reselect.disabled||reselecting} title={reselect.title}>{reselecting?"Opening…":reselect.label||"Choose another story"}</StoryFlowAction>}
 </nav>}</div>;
}
