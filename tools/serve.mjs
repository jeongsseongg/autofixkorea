import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve(process.env.PUBLIC_DIR||'dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=resolve(root,'.'+path);
    if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
    try{if((await stat(file)).isDirectory())file=resolve(file,'index.html');}
    catch{file=resolve(root,'404.html');res.statusCode=404;}
    res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    res.end(await readFile(file));
  }catch{res.writeHead(500);res.end('PREVIEW_READ_FAILED');}
}).listen(4328,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4328'));
