import {createHash} from 'node:crypto';

// Per-instance protection, bounded to avoid unbounded memory use on public endpoints.
export function createRequestLimiter({limit=60,windowMs=60000,maxKeys=10000,now=Date.now}={}){
  const entries=new Map();
  return req=>{
    const time=now();
    for(const [key,value] of entries)if(value.resetAt<=time)entries.delete(key);
    const address=String(req.headers?.['x-real-ip']||req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const key=createHash('sha256').update(address).digest('hex');
    let entry=entries.get(key);
    if(!entry){
      if(entries.size>=maxKeys)return Math.ceil(windowMs/1000);
      entry={count:0,resetAt:time+windowMs};entries.set(key,entry);
    }
    entry.count++;
    return entry.count>limit?Math.max(1,Math.ceil((entry.resetAt-time)/1000)):0;
  };
}


