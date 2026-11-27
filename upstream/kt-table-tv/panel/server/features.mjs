import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { writePrivateJson } from './legacy-auth.mjs';

export const defaultAlertSettings = Object.freeze({enabled:true,co2Threshold:1200,co2DurationMinutes:5,co2CooldownMinutes:60,connectionDelaySeconds:60});
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>record(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
const text=v=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,80):'';
const safeError=message=>Object.assign(new Error(message),{status:400});
export function validateAlertSettings(value){
  if(!exact(value,Object.keys(defaultAlertSettings))||typeof value.enabled!=='boolean')throw safeError('알림 설정을 다시 확인해 주세요.');
  for(const [key,min,max,step] of [['co2Threshold',600,5000,100],['co2DurationMinutes',1,30,1],['co2CooldownMinutes',15,240,1],['connectionDelaySeconds',30,300,1]])
    if(!Number.isInteger(value[key])||value[key]<min||value[key]>max||value[key]%step!==0)throw safeError('알림 설정 범위를 확인해 주세요.');
  return {...value};
}
export function validateFavorites(value,catalog=[]){
  if(!Array.isArray(value)||value.length>8||new Set(value).size!==value.length||value.some(id=>!catalog.some(item=>item.id===id)))throw safeError('즐겨찾기는 목록에서 최대 8개까지 선택해 주세요.');
  return value.slice();
}
export async function runFavorite(body,{runScene,catalog=[]}){
  if(!exact(body,['id']))throw safeError('즐겨찾기 항목을 다시 선택해 주세요.');
  const item=catalog.find(item=>item.id===body.id);
  if(!item)throw safeError('지원하지 않는 즐겨찾기입니다.');
  if(item.type==='scene')return runScene(item.entity);
  throw safeError('설정된 Home Assistant 장면만 실행할 수 있습니다.');
}
export class PanelFeatures {
  constructor({path,catalog=[],now=Date.now,read=async()=>JSON.parse(await readFile(path,'utf8')),write=value=>writePrivateJson(path,value)}={}){
    this.catalog=catalog;this.now=now;this.read=read;this.write=write;this.saved={version:1,settings:{...defaultAlertSettings},favorites:catalog.slice(0,4).map(item=>item.id),cooldowns:{},dismissedConnections:[]};
    this.conditions=new Map();this.active=new Map();this.lastPoll=null;this.queue=Promise.resolve();
  }
  async init(){
    try{
      const value=await this.read();
      if(!exact(value,['version','settings','favorites','cooldowns','dismissedConnections'])||value.version!==1||!record(value.cooldowns))throw new Error('Invalid preferences');
      const settings=validateAlertSettings(value.settings),favorites=validateFavorites(value.favorites,this.catalog),cooldowns={};
      for(const [key,time]of Object.entries(value.cooldowns).slice(0,100))if(/^[a-z0-9:_-]{1,100}$/.test(key)&&Number.isFinite(time)&&time>=0&&time<=this.now()+86400000)cooldowns[key]=time;
      const dismissedConnections=Array.isArray(value.dismissedConnections)?value.dismissedConnections.filter(key=>typeof key==='string'&&/^(ha|device:[a-f0-9]{24})$/.test(key)).slice(0,100):[];
      this.saved={version:1,settings,favorites,cooldowns,dismissedConnections};
    }catch(error){if(error.code&&error.code!=='ENOENT')throw error;await this.write(this.saved);}
  }
  mutate(work){const result=this.queue.then(work);this.queue=result.catch(()=>{});return result;}
  async commit(next){await this.write(next);this.saved=next;}
  settings(){return {...this.saved.settings};}
  configure(body){return this.mutate(async()=>{
    if(!exact(body,['settings']))throw safeError('알림 설정을 다시 확인해 주세요.');
    await this.commit({...this.saved,settings:validateAlertSettings(body.settings)});this.conditions.clear();this.active.clear();this.lastPoll=null;
  });}
  choose(body){return this.mutate(async()=>{if(!exact(body,['selected']))throw safeError('즐겨찾기를 다시 선택해 주세요.');await this.commit({...this.saved,favorites:validateFavorites(body.selected,this.catalog)});});}
  dismiss(body){return this.mutate(async()=>{
    if(!exact(body,['id'])||typeof body.id!=='string'||!/^n-[a-f0-9]{16}-\d{1,16}$/.test(body.id))throw safeError('알림을 다시 선택해 주세요.');
    const pair=[...this.active].find(([,item])=>item.id===body.id);if(!pair)return;
    const [key,item]=pair;
    if(item.kind==='connection')await this.commit({...this.saved,dismissedConnections:[...new Set([...this.saved.dismissedConnections,key])].slice(-100)});
    else await this.commit({...this.saved,cooldowns:{...this.saved.cooldowns,[key]:this.now()+this.saved.settings.co2CooldownMinutes*60000}});
    this.active.delete(key);
  });}
  observe(data,{reliable=true}={}){return this.mutate(async()=>{
    const now=this.now(),settings=this.saved.settings;
    if(!settings.enabled){this.conditions.clear();this.active.clear();this.lastPoll=now;return;}
    if(this.lastPoll===null||now<this.lastPoll||now-this.lastPoll>90000){this.conditions.clear();this.active.clear();}
    this.lastPoll=now;
    const desired=new Map();
    if(!reliable)desired.set('ha',{kind:'connection',title:'Home Assistant 연결 확인',message:'상태를 받지 못하고 있어요. 연결이 복구되면 알림이 사라집니다.',delay:settings.connectionDelaySeconds*1000});
    else{
      for(const room of data?.rooms||[]){
        if(!room.co2Entity)continue;
        const key='co2:'+createHash('sha256').update(room.co2Entity).digest('hex').slice(0,24),reported=Date.parse(room.co2ReportedAt);
        const fresh=Number.isFinite(reported)&&reported<=now+60000&&now-reported<=600000;
        if(fresh&&Number.isFinite(room.co2)&&room.co2>=settings.co2Threshold){
          desired.set(key,{kind:'co2',title:(text(room.name)||'실내')+' 환기 알림',message:'CO₂ '+Math.round(room.co2)+' ppm · 설정한 '+settings.co2Threshold+' ppm 기준을 확인해 주세요.',delay:settings.co2DurationMinutes*60000});
        }
      }
      const monitored=new Set((data?.rooms||[]).flatMap(room=>[room.temperatureEntity,room.humidityEntity,room.co2Entity]).filter(Boolean));
      for(const device of data?.devices||[]){
        if(device.kind==='tracker'||!(monitored.has(device.entityId)||['light','switch','fan','washer'].includes(device.kind)))continue;
        if(device.available!==false)continue;
        const key='device:'+createHash('sha256').update(device.entityId).digest('hex').slice(0,24);
        desired.set(key,{kind:'connection',title:(text(device.name)||'기기')+' 연결 확인',message:(text(device.room)?text(device.room)+' · ':'')+'기기 상태를 받지 못하고 있어요. 연결이 복구되면 알림이 사라집니다.',delay:settings.connectionDelaySeconds*1000});
      }
    }
    for(const key of this.conditions.keys())if(!desired.has(key)){this.conditions.delete(key);this.active.delete(key);}
    const dismissedConnections=this.saved.dismissedConnections.filter(key=>desired.has(key)||(!reliable&&key!=='ha'));
    const cooldowns=Object.fromEntries(Object.entries(this.saved.cooldowns).filter(([,until])=>until>now));let changed=Object.keys(cooldowns).length!==Object.keys(this.saved.cooldowns).length||dismissedConnections.length!==this.saved.dismissedConnections.length;
    for(const [key,item]of desired){
      if(!this.conditions.has(key))this.conditions.set(key,now);
      const since=this.conditions.get(key);
      if(now-since<item.delay)continue;
      if(this.active.has(key)){this.active.set(key,{...this.active.get(key),title:item.title,message:item.message});continue;}
      if(cooldowns[key]>now||dismissedConnections.includes(key)||this.active.size>=20)continue;
      const id='n-'+createHash('sha256').update(key).digest('hex').slice(0,16)+'-'+now;
      this.active.set(key,{id,kind:item.kind,title:item.title,message:item.message,since:new Date(since).toISOString()});
      if(item.kind==='co2'){cooldowns[key]=now+settings.co2CooldownMinutes*60000;changed=true;}
    }
    if(changed)await this.commit({...this.saved,cooldowns,dismissedConnections});
  });}
  snapshot(data){return {alertSettings:this.settings(),notifications:[...this.active.values()].sort((a,b)=>Date.parse(b.since)-Date.parse(a.since)),favorites:{selected:this.saved.favorites.slice(),items:this.catalog.map(({id,label,type,entity})=>({id,label,type,available:type!=='scene'||!!data?.scenes?.some(s=>s.entityId===entity&&s.available===true)}))}};}
}
