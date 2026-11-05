// Development uses the desktop/CLI provider defaults without passing saved credentials to Vite.
// Library/port selection stays with the launcher; shell overrides never mutate saved settings.
import {desktopLibraryPaths} from './library-directory.ts';
import {SystemSettingsStore} from './system-settings.ts';
import {effectiveProviderVariables} from './cli-setup.ts';
import {startServer} from './start.ts';

const locations=desktopLibraryPaths(),store=new SystemSettingsStore(locations.settings,locations.library);
let variables:Record<string,string|undefined>;
try{variables=effectiveProviderVariables(store,process.env);}finally{store.close();}
await startServer({root:process.cwd(),variables});
