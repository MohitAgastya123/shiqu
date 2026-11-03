// Every story flow keeps one secondary exit; leaving does not change production control.
import StoryFlowAction from './StoryFlowAction';
import {BookOpen} from 'lucide-react';
export default function StoryBackToShelf({onBack,disabled=false,link=false}:{onBack:()=>void;disabled?:boolean;link?:boolean}){
 return <StoryFlowAction asLink={link} type="button" className="yu-generation-back" disabled={disabled} onClick={onBack}><BookOpen size={17} aria-hidden="true"/>返回书架</StoryFlowAction>;
}
