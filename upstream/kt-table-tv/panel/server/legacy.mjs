import http from 'node:http';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile,mkdir,chmod} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {loadLegacyAuth,loadDeviceToken,validLegacyAuth,writePrivateJson} from './legacy-auth.mjs';
import {loadLegacyNetwork} from './legacy-network.mjs';
import {projectMaintenanceSummary} from './panel-maintenance.mjs';
import {loadSetup,validateSetup} from './config.mjs';

const random=()=>randomBytes(32).toString('hex');
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
function cookie(req){return String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('genie_legacy='))?.slice(13);}
async function body(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>1024)throw new Error('size');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
function usable(d){return d?.mode==='live'&&d.connected===true&&d.serverReachable===true&&!d.error;}
function projectWeather(w){
  if(w?.available!==true)return null;
  const display=value=>typeof value==='string'?value.trim().slice(0,80):'';
  const condition=display(w.condition)||null,temperatureC=Number.isFinite(w.temperatureC)?w.temperatureC:null;
  if(!condition&&temperatureC===null)return null;
  const updatedAt=typeof w.updatedAt==='string'&&w.updatedAt.length<=40&&Number.isFinite(Date.parse(w.updatedAt))?w.updatedAt:null;
  return {available:true,name:display(w.name)||'현재 날씨',condition,temperatureC,source:display(w.source)||'Home Assistant',updatedAt};
}
function projectWasher(w){
  const display=value=>typeof value==='string'?value.trim().slice(0,80):'';
  const timestamp=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value))?value:null;
  const nonnegative=value=>Number.isFinite(value)&&value>=0?value:null;
  const available=w.available===true,notification=w.lastNotification;
  const label=display(notification?.label),at=timestamp(notification?.at);
  const notificationKey=typeof w.entityId==='string'&&w.entityId?createHash('sha256').update(w.entityId).digest('hex').slice(0,24):null;
  return {name:display(w.name)||'세탁기',room:display(w.room),state:display(w.state),available,
    notificationKey,completionAt:timestamp(w.completionAt),
    statusLabel:available?(display(w.statusLabel)||'수신 대기'):'연결 확인 필요',
    remainingEndAt:available?timestamp(w.remainingEndAt):null,totalMinutes:available?nonnegative(w.totalMinutes):null,
    remoteStart:available&&typeof w.remoteStart==='boolean'?w.remoteStart:null,
    cycleCount:available?nonnegative(w.cycleCount):null,energyMonthKwh:available?nonnegative(w.energyMonthKwh):null,
    lastNotification:label&&at?{label,at}:null,updatedAt:timestamp(w.updatedAt)};
}
const displayText=(value,limit=160)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,limit):'';
const validTime=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value))?value:null;
const featureId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value);
export function validAlertSettings(value){
  return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')==='co2CooldownMinutes,co2DurationMinutes,co2Threshold,connectionDelaySeconds,enabled'&&
    typeof value.enabled==='boolean'&&Number.isInteger(value.co2Threshold)&&value.co2Threshold>=600&&value.co2Threshold<=5000&&value.co2Threshold%100===0&&
    Number.isInteger(value.co2DurationMinutes)&&value.co2DurationMinutes>=1&&value.co2DurationMinutes<=30&&
    Number.isInteger(value.co2CooldownMinutes)&&value.co2CooldownMinutes>=15&&value.co2CooldownMinutes<=240&&
    Number.isInteger(value.connectionDelaySeconds)&&value.connectionDelaySeconds>=30&&value.connectionDelaySeconds<=300;
}
function projectHistory(series,kind){
  return (Array.isArray(series)?series:[]).filter(p=>p&&validTime(p.time)).slice(-288).map(p=>({time:p.time,value:Number.isFinite(p.value)&&p.value>=0&&(kind!=='humidity'||p.value<=100)?p.value:null}));
}
function projectForecast(forecast){
  const available=forecast?.available===true;
  return {available,source:displayText(forecast?.source,80),updatedAt:validTime(forecast?.updatedAt),items:available?(Array.isArray(forecast.items)?forecast.items:[]).filter(item=>item&&validTime(item.time)).slice(0,8).map(item=>({
    time:item.time,condition:displayText(item.condition,40)||'예보 없음',conditionCode:displayText(item.conditionCode,32),
    temperatureC:Number.isFinite(item.temperatureC)?item.temperatureC:null,
    precipitationMm:Number.isFinite(item.precipitationMm)&&item.precipitationMm>=0?item.precipitationMm:null,
    precipitationProbability:Number.isFinite(item.precipitationProbability)&&item.precipitationProbability>=0&&item.precipitationProbability<=100?item.precipitationProbability:null,
  })):[]};
}
function projectFavorites(value,ready){
  const items=(Array.isArray(value?.items)?value.items:[]).filter(item=>item&&featureId(item.id)&&item.type==='scene').slice(0,16).map(item=>({id:item.id,label:displayText(item.label,80),type:item.type,available:item.available===true&&ready}));
  const known=new Set(items.map(item=>item.id));
  return {items,selected:[...new Set((Array.isArray(value?.selected)?value.selected:[]).filter(id=>known.has(id)))].slice(0,8)};
}
export function projectWeekly(value,config){
  if(!value||value.available!==true)return null;
  const number=(v,min=-Infinity,max=Infinity)=>Number.isFinite(v)&&v>=min&&v<=max?v:null;
  const metrics=source=>Object.fromEntries(['temperature','humidity','co2'].map(kind=>{
    const metric=source?.[kind], available=metric?.available===true;
    const output={available,unit:kind==='temperature'?'°C':kind==='humidity'?'%':'ppm',
      average:available?number(metric.average):null,min:available?number(metric.min):null,max:available?number(metric.max):null,
      samples:number(metric?.samples,0,100000),coverageHours:number(metric?.coverageHours,0,168),
      coveragePercent:number(metric?.coveragePercent,0,100),availableDays:number(metric?.availableDays,0,7)};
    if(kind==='co2')Object.assign(output,{aboveThresholdHours:available?number(metric.aboveThresholdHours,0,168):null,
      aboveThresholdPercent:available?number(metric.aboveThresholdPercent,0,100):null,
      peakHours:available?(Array.isArray(metric.peakHours)?metric.peakHours:[]).filter(item=>Number.isInteger(item?.hour)&&item.hour>=0&&item.hour<24).slice(0,3).map(item=>({hour:item.hour,average:number(item.average,0),coverageHours:number(item.coverageHours,0,168)})):[]});
    return [kind,output];
  }));
  return {available:true,updatedAt:validTime(value.updatedAt),start:validTime(value.start),end:validTime(value.end),days:7,timeZone:'Asia/Seoul',co2Threshold:number(value.co2Threshold,600,5000),maxGapMinutes:60,
    rooms:(Array.isArray(value.rooms)?value.rooms:[]).filter(room=>config.rooms.some(item=>item.id===room?.id)).slice(0,2).map(room=>({id:displayText(room.id,80),name:room.name,metrics:metrics(room.metrics)}))};
}
function projectMobile(value){
  const status=['waiting-for-phone','ready','choose-phone','unavailable'].includes(value?.status)?value.status:'waiting-for-phone';
  return {available:value?.available===true,enabled:value?.enabled===true,status,lastSentAt:validTime(value?.lastSentAt),error:value?.error?displayText(value.error,180):null};
}
export function projectState(d,config){const ready=usable(d);const sceneIds=new Set(config.rooms.flatMap(room=>Object.values(room.scenes)).filter(Boolean));return {
  roomConfig:config.rooms,
  mode:ready?'live':'unavailable',connected:ready,serverReachable:d?.serverReachable===true,updatedAt:d?.updatedAt||null,
  error:ready?null:'Home Assistant 연결을 확인해 주세요.',
  weather:ready?projectWeather(d.weather):null,
  forecast:projectForecast(ready?d.forecast:null),
  weekly:ready?projectWeekly(d.weekly,config):null,
  mobileNotifications:projectMobile(d?.mobileNotifications),
  maintenance:projectMaintenanceSummary(d?.maintenance),
  notifications:(Array.isArray(d?.notifications)?d.notifications:[]).filter(n=>n&&featureId(n.id)&&['co2','connection'].includes(n.kind)).slice(0,20).map(n=>({id:n.id,kind:n.kind,title:displayText(n.title,100),message:displayText(n.message,300),since:validTime(n.since)})),
  alertSettings:validAlertSettings(d?.alertSettings)?{...d.alertSettings}:null,
  favorites:projectFavorites(d?.favorites,ready),
  washers:ready?(d.devices||[]).filter(device=>device.kind==='washer'&&device.platform==='LG ThinQ').map(projectWasher):[],
  rooms:ready?(d.rooms||[]).filter(r=>config.rooms.some(room=>room.id===r.id)).map(r=>{
    const hasCo2=typeof r.co2Entity==='string'&&r.co2Entity.startsWith('sensor.');
    return {id:r.id,name:config.rooms.find(room=>room.id===r.id).name,temperature:Number.isFinite(r.temperature)?r.temperature:null,humidity:Number.isFinite(r.humidity)?r.humidity:null,
      hasCo2,co2:hasCo2&&Number.isFinite(r.co2)&&r.co2>=0?r.co2:null,
      histories:{humidity:projectHistory(r.histories?.humidity,'humidity'),co2:hasCo2?projectHistory(r.histories?.co2,'co2'):[]}};
  }):[],
  scenes:ready?(d.scenes||[]).filter(s=>sceneIds.has(s.entityId)).map(s=>({entityId:s.entityId,name:s.name,room:s.room,available:s.available===true})):[]
};}
export function legacyAlertScript(source){
  if(typeof source!=='string'||!/^export function createWasherAlertTracker\(options\) \{/.test(source))throw new Error('Unexpected washer alert module');
  const script=source.replace(/^export /,'');
  if(/^\s*(?:import|export)\s/m.test(script))throw new Error('Unsupported washer alert module');
  return script;
}
export function legacySnapshotScript(source){
  if(typeof source!=='string'||!/^export function createPanelSnapshotCache\(options\) \{/.test(source))throw new Error('Unexpected snapshot module');
  const script=source.replace(/^export /,'');
  if(/^\s*(?:import|export)\s/m.test(script))throw new Error('Unsupported snapshot module');
  return script;
}
export function legacyPageAssets(source){
  const scripts=[];
  const html=String(source).replace(/<script>([\s\S]*?)<\/script>/g,(_,script)=>{
    scripts.push(script);
    return '<script src="/panel.js"></script>';
  });
  if(scripts.length>1)throw new Error('Unexpected legacy page scripts');
  return {html,script:scripts[0]||''};
}
export function createLegacyServer({host,port=4181,device,config,html,alertScript='',snapshotScript='',upstream=fetch,backend='http://localhost:4173',launchToken=random(),onLaunchToken=async()=>{},ttlMs=24*60*60*1000,authState,persistAuth=async()=>{},deviceToken=null}={}){
  config=validateSetup(config);
  if(host!==config.server.address||device!==config.device.address||port!==4181)throw new Error('Invalid configured device network');
  const sceneIds=new Set(config.rooms.flatMap(room=>Object.values(room.scenes)).filter(Boolean));
  const origin=`http://${host}:${port}`;
  const page=legacyPageAssets(html);
  if(authState&&!validLegacyAuth(authState,origin))throw new Error('Invalid panel session configuration');
  if(deviceToken!==null&&(typeof deviceToken!=='string'||!/^[0-9a-f]{64}$/.test(deviceToken)))throw new Error('Invalid panel device configuration');
  let auth=authState?{...authState}:{version:1,origin,launchToken,session:random(),csrf:random(),expires:Date.now()+ttlMs};
  let authQueue=Promise.resolve(),authFailed=false;
  function mutateAuth(operation){const next=authQueue.then(async()=>{if(authFailed)throw new Error('Panel session unavailable');return operation();});authQueue=next.catch(()=>{});return next;}
  async function commitAuth(next){
    try{await persistAuth({...next});if(next.launchToken!==auth.launchToken)await onLaunchToken(next.launchToken);}
    catch{authFailed=true;throw new Error('Panel session unavailable');}
    auth=next;
  }
  function sessionCookie(){return `genie_legacy=${auth.session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,Math.floor(ttlMs/1000))}`;}
  const counters={opened:0,states:0,actions:0,errors:0};let busy=false,closing=false;
  async function dashboard(){const r=await upstream(backend+'/api/dashboard',{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok)throw new Error('backend');return r.json();}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Connection','close');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    const local=req.socket.remoteAddress===host;
    if(![host,device].includes(req.socket.remoteAddress)||req.headers.host!==`${host}:${port}`||!req.url.startsWith('/')||req.url.startsWith('//')||req.url.includes('\\'))return json(res,403,{error:'허용되지 않은 연결입니다.'});
    if(closing)return json(res,503,{error:'연결을 다시 열어 주세요.'});
    let path;try{path=new URL(req.url,origin).pathname;}catch{return json(res,400,{error:'잘못된 경로입니다.'});}
    if(req.method==='GET'&&path==='/internal/status'&&local)return json(res,200,{ok:true,...counters});
    try{
      if(authFailed)return json(res,503,{error:'연결을 다시 열어 주세요.'});
      if(req.method==='GET'&&path.startsWith('/open/')){
        return await mutateAuth(async()=>{
          if(!equal(path.slice(6),auth.launchToken))return json(res,401,{error:'연결을 다시 열어 주세요.'});
          await commitAuth({...auth,launchToken:random(),session:random(),csrf:random(),expires:Date.now()+ttlMs});counters.opened++;
          res.writeHead(303,{Location:'/', 'Set-Cookie':sessionCookie()});return res.end();
        });
      }
      if(req.method==='POST'&&path==='/api/device/session'){
        if(req.headers.origin!==undefined&&req.headers.origin!==origin)return json(res,403,{error:'허용되지 않은 연결입니다.'});
        if(!deviceToken||!equal(req.headers.authorization,`Bearer ${deviceToken}`))return json(res,401,{error:'기기 연결을 확인해 주세요.'});
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return json(res,415,{error:'지원하지 않는 요청입니다.'});
        let input;try{input=await body(req);}catch{return json(res,400,{error:'잘못된 연결 요청입니다.'});}
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)return json(res,400,{error:'잘못된 연결 요청입니다.'});
        return await mutateAuth(async()=>{
          const valid=Date.now()<auth.expires;
          await commitAuth({...auth,session:valid?auth.session:random(),csrf:valid?auth.csrf:random(),expires:Date.now()+ttlMs});
          res.setHeader('Set-Cookie',sessionCookie());return json(res,200,{ok:true});
        });
      }
      if(Date.now()>=auth.expires||!equal(cookie(req),auth.session))return json(res,401,{error:'연결을 다시 열어 주세요.'});
      if(req.method==='GET'&&path==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(page.html);}
      if(req.method==='GET'&&path==='/panel.js'&&page.script){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end(page.script);}
      if(req.method==='GET'&&path==='/washer-alerts.js'&&alertScript){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end(alertScript);}
      if(req.method==='GET'&&path==='/offline-snapshot.js'&&snapshotScript){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});return res.end(snapshotScript);}
      if(req.method==='GET'&&path==='/api/state'){
        const d=await dashboard();counters.states++;return json(res,200,{...projectState(d,config),csrfToken:auth.csrf});
      }
      if(req.method==='POST'&&path==='/api/routines/run'){
        if(req.headers.origin!==origin||!equal(req.headers['x-csrf-token'],auth.csrf))return json(res,403,{error:'화면을 다시 열어 주세요.'});
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return json(res,415,{error:'지원하지 않는 요청입니다.'});
        if(busy)return json(res,409,{error:'실행 중입니다. 잠시 기다려 주세요.'});
        let requested;try{requested=await body(req);}catch{return json(res,400,{error:'실행할 모드를 다시 선택해 주세요.'});}
        if(!requested||typeof requested!=='object'||Array.isArray(requested)||Object.keys(requested).length!==1||!['away','sleep'].includes(requested.id))return json(res,400,{error:'실행할 모드를 다시 선택해 주세요.'});
        if(busy)return json(res,409,{error:'실행 중입니다. 잠시 기다려 주세요.'});
        busy=true;req.setTimeout(65000);
        try{
          const d=await dashboard();if(!usable(d))return json(res,409,{error:'Home Assistant 연결을 확인해 주세요.'});
          const response=await upstream(backend+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:backend,'X-CSRF-Token':d.csrfToken},body:JSON.stringify(requested),signal:AbortSignal.timeout(60000),redirect:'error'});
          const result=await response.json();
          if(!response.ok)return json(res,response.status===409?409:502,{error:'모드 실행 결과를 확인하지 못했습니다. 실제 기기를 확인해 주세요.'});
          const results=['거실','안방'].map(room=>({room,sent:Array.isArray(result.results)&&result.results.find(item=>item?.room===room)?.sent===true}));
          const ok=result.ok===true&&results.every(item=>item.sent);counters.actions++;
          return json(res,200,{ok,results,standby:requested.id==='sleep'&&ok&&result.standby===true,message:displayText(result.message,180)});
        }finally{busy=false;}
      }
      if(req.method==='POST'&&['/api/notifications/dismiss','/api/alert-settings','/api/favorites/settings','/api/favorites/run'].includes(path)){
        if(req.headers.origin!==origin||!equal(req.headers['x-csrf-token'],auth.csrf))return json(res,403,{error:'화면을 다시 열어 주세요.'});
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return json(res,415,{error:'지원하지 않는 요청입니다.'});
        if(busy)return json(res,409,{error:'실행 중입니다. 잠시 기다려 주세요.'});
        let requested;try{requested=await body(req);}catch{return json(res,400,{error:'요청 내용을 확인해 주세요.'});}
        if(!requested||typeof requested!=='object'||Array.isArray(requested)||Object.keys(requested).length!==1)return json(res,400,{error:'요청 내용을 확인해 주세요.'});
        const idRequest=path==='/api/notifications/dismiss'||path==='/api/favorites/run';
        if(idRequest&&!featureId(requested.id))return json(res,400,{error:'항목을 확인해 주세요.'});
        if(path==='/api/alert-settings'&&!validAlertSettings(requested.settings))return json(res,400,{error:'알림 설정 범위를 확인해 주세요.'});
        if(path==='/api/favorites/settings'&&(!Array.isArray(requested.selected)||requested.selected.length>8||requested.selected.some(id=>!featureId(id))||new Set(requested.selected).size!==requested.selected.length))return json(res,400,{error:'즐겨찾기를 확인해 주세요.'});
        if(busy)return json(res,409,{error:'실행 중입니다. 잠시 기다려 주세요.'});
        busy=true;
        try{
          const d=await dashboard(),features=projectState(d,config);
          if(path==='/api/notifications/dismiss'&&!features.notifications.some(n=>n.id===requested.id))return json(res,409,{error:'이미 해제된 알림입니다.'});
          if(path==='/api/favorites/run'&&!features.favorites.items.some(item=>item.id===requested.id&&item.available))return json(res,409,{error:'현재 실행할 수 없는 항목입니다.'});
          if(path==='/api/favorites/settings'&&requested.selected.some(id=>!features.favorites.items.some(item=>item.id===id)))return json(res,400,{error:'즐겨찾기를 다시 선택해 주세요.'});
          const r=await upstream(backend+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:backend,'X-CSRF-Token':d.csrfToken},body:JSON.stringify(requested),signal:AbortSignal.timeout(20000),redirect:'error'});
          const result=await r.json();
          if(!r.ok||result.ok!==true)return json(res,r.status===409?409:502,{error:path==='/api/favorites/run'?'실행 결과를 확인하지 못했습니다. 기기 상태를 확인해 주세요.':'변경 결과를 확인하지 못했습니다. 다시 조회해 주세요.'});
          if(path==='/api/favorites/run')counters.actions++;
          return json(res,200,{ok:true,message:path==='/api/favorites/run'?'실행 요청을 보냈습니다.':'저장했습니다.'});
        }finally{busy=false;}
      }
      if(req.method==='POST'&&path==='/api/scenes/run'){
        if(req.headers.origin!==origin||!equal(req.headers['x-csrf-token'],auth.csrf))return json(res,403,{error:'화면을 다시 열어 주세요.'});
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return json(res,415,{error:'지원하지 않는 요청입니다.'});
        if(busy)return json(res,409,{error:'실행 중입니다. 잠시 기다려 주세요.'});
        let b;try{b=await body(req);}catch{return json(res,400,{error:'실행할 장면을 확인해 주세요.'});}
        if(!b||Array.isArray(b)||Object.keys(b).length!==1||!sceneIds.has(b.entityId))return json(res,400,{error:'실행할 수 없는 장면입니다.'});
        if(busy)return json(res,409,{error:'실행 중입니다. 잠시 기다려 주세요.'});
        busy=true;
        try{
          const d=await dashboard();
          if(!usable(d)||!d.scenes?.some(s=>s.entityId===b.entityId&&s.available===true))return json(res,409,{error:'현재 실행할 수 없는 장면입니다.'});
          const r=await upstream(backend+'/api/scenes/run',{method:'POST',headers:{'Content-Type':'application/json',Origin:backend,'X-CSRF-Token':d.csrfToken},body:JSON.stringify({entityId:b.entityId}),signal:AbortSignal.timeout(15000),redirect:'error'});
          const result=await r.json();if(!r.ok||result.ok!==true)return json(res,502,{error:'실행 결과를 확인하지 못했습니다. 실제 기기 상태를 확인해 주세요.'});
          counters.actions++;return json(res,200,{ok:true,message:'장면 실행 요청을 보냈습니다.'});
        }finally{busy=false;}
      }
      return json(res,404,{error:'없는 경로입니다.'});
    }catch{counters.errors++;if(!res.headersSent)json(res,502,{error:'연결 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'});else res.end();}
  });
  server.requestTimeout=20000;server.headersTimeout=5000;server.timeout=25000;
  return {server,origin,counters,stop(){closing=true;server.close();server.closeAllConnections();}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),runtime=resolve(root,'runtime/legacy');
  await mkdir(runtime,{recursive:true,mode:0o700});
  await chmod(runtime,0o700);
  const config=await loadSetup(resolve(root,'runtime/setup.json'));
  const {host,device}=await loadLegacyNetwork(resolve(runtime,'network.json'));
  if(host!==config.server.address||device!==config.device.address)throw new Error('Run Setup.command again to align network settings');
  const port=4181,origin=`http://${host}:${port}`,authPath=resolve(runtime,'auth.json');
  const authState=await loadLegacyAuth(authPath,origin),deviceToken=await loadDeviceToken(resolve(runtime,'device.json'),origin);
  async function save(token){await writePrivateJson(resolve(runtime,'launch.json'),{origin,token,createdAt:new Date().toISOString()});}
  await save(authState.launchToken);
  const alertScript=legacyAlertScript(await readFile(resolve(root,'panel/src/washer-alerts.mjs'),'utf8'));
  const snapshotScript=legacySnapshotScript(await readFile(resolve(root,'panel/src/offline-snapshot.mjs'),'utf8'));
  const app=createLegacyServer({host,port,device,config,html:await readFile(resolve(root,'panel/legacy/index.html')),alertScript,snapshotScript,authState,deviceToken,persistAuth:next=>writePrivateJson(authPath,next),onLaunchToken:save});
  app.server.listen(port,host,()=>console.log('CT1105 home panel ready on the device network'));
  const end=()=>{app.stop();process.exitCode=0;};
  process.on('SIGINT',end);process.on('SIGTERM',end);
}
