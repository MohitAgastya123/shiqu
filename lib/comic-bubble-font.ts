// Explicitly load the bundled OFL comic face before browser SVG or canvas rendering.
// Native exporters register this same unmodified file under the same local family name.
export const comicBubbleFontSha256='3e7e5fccfd7e0788f317b43312151c1bd5cf058c9697a8d83eac3939050bd61e';
const loading=new WeakMap<FontFaceSet,Promise<void>>();
export async function ensureComicBubbleFont():Promise<void>{
 if(typeof document==='undefined'||!document.fonts)return;
 const fonts=document.fonts;
 let pending=loading.get(fonts);
 if(!pending){
  pending=(async()=>{
   const source=new URL('../data/export-fonts/ComicNeue-Bold.ttf',import.meta.url);
   const face=new FontFace('Shiqu Comic',`url("${source.href}")`,{weight:'700',style:'normal',display:'block'});
   await face.load();fonts.add(face);
   const faces=await fonts.load('700 24px "Shiqu Comic"');await fonts.ready;
   if(face.status!=='loaded'||!faces.some(f=>f===face))throw Error('The bundled comic font could not be loaded.');
  })();
  loading.set(fonts,pending);
 }
 try{await pending;}catch(error){loading.delete(fonts);throw error;}
}
