import {defineConfig} from 'vite';
export default defineConfig({server:{host:'127.0.0.1',port:5173,proxy:{'/api':'http://127.0.0.1:3186','/media':'http://127.0.0.1:3186','/source':'http://127.0.0.1:3186','/figures':'http://127.0.0.1:3186','/assets/manual':'http://127.0.0.1:3186'}}});
