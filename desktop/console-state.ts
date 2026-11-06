// Console state and read-only provider summaries do not query the library; unknown state blocks local writes.
import {effectiveImageProvider,isApiProvider} from '../lib/system-settings.ts';
import type {SystemSettings} from '../lib/system-settings.ts';
import type {ProviderSettingsView} from '../lib/provider-settings';
export type ServiceState='loading'|'unavailable'|'stopped'|'running'|'starting'|'upgrading'|'failed'|'preview';
export type Status={running:boolean;state?:ServiceState;url?:string;phoneUrls:string[];publicUrl?:string;internetError?:string;error?:string;backup?:string;provider?:ProviderSettingsView['runtime'];restartRequired?:boolean;generating?:boolean;settingsError?:string};
export const stateLabels:Record<ServiceState,string>={loading:"Loading",unavailable:"Status unknown",stopped:"Stopped",running:"Running",starting:"Starting",upgrading:"Upgrading library",failed:"Startup failed",preview:"Browser preview"};
export function savedProvider(settings:SystemSettings,keys?:{gemini:boolean;openai:boolean}):ProviderSettingsView['runtime']{
 const provider=settings.provider,image=effectiveImageProvider(settings);
 return {provider,configured:settings.providerConfigured&&(!isApiProvider(provider)||!!keys?.[provider])&&(!isApiProvider(image)||!!keys?.[image]),models:{text:provider==='readonly'?'':provider==='codex'?settings.codexModel||"Codex default model":provider==='openai'?settings.openaiTextModel:settings.textModel,image:!image?'':image==='codex'?"Codex image generation":image==='openai'?settings.openaiImageModel:settings.imageModel},...(image&&image!==provider?{imageProvider:image}:{})};
}
