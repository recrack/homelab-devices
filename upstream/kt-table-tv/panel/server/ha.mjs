import { open, mkdir, chmod, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { writePrivateJson } from './legacy-auth.mjs';

export class HomeAssistant {
  constructor({url, dataDir, clientId, fetchImpl=fetch, WebSocketImpl=WebSocket}) {
    this.url = url.replace(/\/$/, ''); this.dataDir = dataDir; this.clientId = clientId; this.fetch = fetchImpl;
    this.tokens = null; this.refreshing = null; this.WebSocketImpl = WebSocketImpl;
  }
  get connected() { return !!this.tokens?.refresh_token; }
  async init() {
    await mkdir(this.dataDir, {recursive:true,mode:0o700});
    const directory=await lstat(this.dataDir);
    if(!directory.isDirectory()||directory.isSymbolicLink()||directory.uid!==process.getuid())throw new Error('인증정보 저장 폴더를 확인해 주세요.');
    await chmod(this.dataDir,0o700);
    let handle;
    try {
      handle=await open(join(this.dataDir,'auth.json'),constants.O_RDONLY|constants.O_NOFOLLOW);
      const info=await handle.stat();
      if(!info.isFile()||info.uid!==process.getuid()||info.nlink!==1||info.size>65536)throw new Error('인증정보 파일을 확인해 주세요.');
      await handle.chmod(0o600);
      const saved = JSON.parse(await handle.readFile({encoding:'utf8'}));
      if (saved.url === this.url && saved.clientId === this.clientId) this.tokens = saved.tokens;
    } catch(e) { if(e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e; }
    finally {await handle?.close();}
  }
  async save() {
    const path = join(this.dataDir,'auth.json');
    await writePrivateJson(path,{url:this.url,clientId:this.clientId,tokens:this.tokens});
  }
  async exchange(code, verifier) {
    const r = await this.fetch(`${this.url}/auth/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
      body:new URLSearchParams({grant_type:'authorization_code',code,client_id:this.clientId,code_verifier:verifier})});
    if(!r.ok) throw new Error('Home Assistant 로그인을 완료하지 못했습니다. 다시 연결해 주세요.');
    const result = await r.json();
    if(!result.refresh_token || !result.access_token) throw new Error('인증 응답에 필요한 정보가 없습니다.');
    this.tokens = {...result,expires_at:Date.now()+result.expires_in*1000}; await this.save();
  }
  async token() {
    if(!this.connected) throw new Error('Home Assistant 연결이 필요합니다.');
    if(this.tokens.access_token && this.tokens.expires_at > Date.now()+60000) return this.tokens.access_token;
    if(!this.refreshing) this.refreshing = (async()=>{
      const r = await this.fetch(`${this.url}/auth/token`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
        body:new URLSearchParams({grant_type:'refresh_token',refresh_token:this.tokens.refresh_token,client_id:this.clientId})});
      if(!r.ok) { if([400,401,403].includes(r.status)) {this.tokens=null;await this.save();} throw new Error('인증을 갱신하지 못했습니다. 다시 연결해 주세요.'); }
      const result = await r.json(); this.tokens={...this.tokens,...result,expires_at:Date.now()+result.expires_in*1000}; await this.save(); return this.tokens.access_token;
    })().finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }
  async request(path, options={}) {
    const token = await this.token();
    const r = await this.fetch(`${this.url}${path}`,{...options,redirect:'error',signal:options.signal||AbortSignal.timeout(12000),
      headers:{...options.headers,Authorization:`Bearer ${token}`}});
    if(r.status === 401) {this.tokens.expires_at=0;throw new Error('인증이 만료되었습니다. 잠시 후 다시 시도해 주세요.');}
    if(!r.ok) throw new Error(`Home Assistant 요청 실패 (${r.status}).`);
    return r;
  }
  async json(path,options) { return (await this.request(path,options)).json(); }
  async reachable() {
    try {const r=await this.fetch(`${this.url}/`,{signal:AbortSignal.timeout(4000),redirect:'error'});return r.ok;}catch{return false;}
  }
  async websocket(types, retry=true) {
    const token=await this.token();
    const url=new URL('/api/websocket',this.url);url.protocol=url.protocol==='https:'?'wss:':'ws:';
    return new Promise((resolve,reject)=>{
      const ws=new this.WebSocketImpl(url), results={}, pending=new Map(); let done=false;
      const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);ws.close();error?reject(error):resolve(results);};
      const timer=setTimeout(()=>finish(new Error('기기 목록 조회 시간이 초과되었습니다.')),12000);
      ws.addEventListener('error',()=>finish(new Error('Home Assistant 연결에 실패했습니다.')));
      ws.addEventListener('close',()=>{if(!done)finish(new Error('Home Assistant 연결이 종료되었습니다.'));});
      ws.addEventListener('message',event=>{
        let message;try{message=JSON.parse(event.data);}catch{finish(new Error('잘못된 서버 응답입니다.'));return;}
        if(message.type==='auth_required') ws.send(JSON.stringify({type:'auth',access_token:token}));
        else if(message.type==='auth_invalid') {const error=new Error('인증을 다시 확인해 주세요.');error.code='AUTH_EXPIRED';finish(error);}
        else if(message.type==='auth_ok') types.forEach((command,i)=>{const payload=typeof command==='string'?{type:command}:command;pending.set(i+1,payload.type);ws.send(JSON.stringify({...payload,id:i+1}));});
        else if(message.type==='result' && pending.has(message.id)) {
          const type=pending.get(message.id); pending.delete(message.id);
          if(message.success)results[type]=message.result;
          else if(type==='get_states') {finish(new Error('상태 조회 권한을 확인해 주세요.'));return;}
          if(!pending.size)finish();
        }
      });
    }).catch(async(error)=>{
      if(error.code==='AUTH_EXPIRED'&&this.tokens){
        this.tokens.expires_at=0;
        if(retry)return this.websocket(types,false);
        this.tokens=null;await this.save();
      }
      throw error;
    });
  }
}
