// English interface: labels, accessibility text, and workflow messages use English.
// A paused production keeps edits in its timeline and applies them only on explicit resume.
// Uploaded parts retain their source rather than offering classic-story reselection.
import type {ComponentProps} from 'react';
import {generationProgress} from '@/lib/generation-progress';
import {getArtStyle} from '@/lib/reader-styles';
import StoryGenerationStatus from './StoryGenerationStatus';
import {StoryRevisionActions,revisionDraftSteps} from './StoryRevisionEditor';
import type {StoryRevisionEditorState} from './useStoryRevision';

type Props=Omit<ComponentProps<typeof StoryGenerationStatus>,'timeline'|'stages'|'control'>&{editor:StoryRevisionEditorState;onReselect?:()=>void};
export default function StoryPausedEditing({editor,onReselect,...props}:Props){
 const {session,busy,controlBusy}=props;
 if(!session.generationControl||session.generationControl==='active')return null;
 const changed=!!editor.impact?.changed,locked=busy||controlBusy||editor.busy;
 const stages=changed&&editor.base?revisionDraftSteps(editor.base,editor.changes):generationProgress(session,Date.now()).steps.map(step=>step.id==='source'?{...step,detail:`Art style: ${getArtStyle(session.selection.artStyle).label}`}:step);
 const edit=(tab:Parameters<typeof editor.open>[0])=>{if(!locked)editor.open(tab);};
 return <StoryGenerationStatus {...props} controlBusy={locked} stages={stages} navigation={{...props.navigation,source:props.navigation?.source?{...props.navigation.source,disabled:props.navigation.source.disabled||locked}:undefined,reselect:onReselect?{label:"Replace story selection",onClick:onReselect,disabled:locked}:undefined,reselecting:props.navigation?.reselecting}} timeline={{
  links:{source:[{label:"Production instructions",onClick:()=>edit('requirements')},{label:"Acceptance criteria",onClick:()=>edit('acceptance')}]},
  detailActions:{source:{label:"Change art style",onClick:()=>edit('style')}},
  actions:{count:{label:"Change narrative detail",onClick:()=>edit('count')},...(session.story?{plan:{label:"Edit storyboard",onClick:()=>edit('script')}}:{})}
 }} control={changed?<StoryRevisionActions editor={{...editor,busy:locked}} resuming link/>:undefined}/>;
}
