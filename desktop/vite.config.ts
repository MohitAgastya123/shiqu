// 桌面预览独立缓存与根路径别名，不提供书库查询或故事写入的替身端点。
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:path.dirname(fileURLToPath(import.meta.url)),cacheDir:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../node_modules/.vite-desktop'),plugins:[react()],resolve:{alias:{'@':path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')}},server:{host:'127.0.0.1',port:1420,strictPort:true,fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/.data/**','**/backups/**','**/*-backups/**','**/*.{sqlite,sqlite-wal,sqlite-shm,db,db-wal,db-shm}','**/media/**','**/reader-cache/**']}},clearScreen:false,build:{outDir:'dist',emptyOutDir:true}});
