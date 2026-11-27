export class WeeklyView {
  constructor({weekly,now=Date.now}) { this.weekly=weekly;this.now=now;this.key=null;this.value=null;this.pending=null; }
  snapshot(data,settings) {
    const key=JSON.stringify([(data?.rooms||[]).map(room=>[room.id,room.name,room.temperatureEntity,room.humidityEntity,room.co2Entity]),settings.co2Threshold]);
    if(!this.pending) {
      this.pending=Promise.resolve().then(()=>this.weekly.summarize(data,settings)).then(value=>{
        this.key=key;this.value=value;
      }).catch(()=>{this.key=key;this.value=null;}).finally(()=>{this.pending=null;});
    }
    const updatedAt=Date.parse(this.value?.updatedAt);
    return this.key===key&&Number.isFinite(updatedAt)&&updatedAt<=this.now()+60000&&this.now()-updatedAt<30*60000?this.value:null;
  }
}
