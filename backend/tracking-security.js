import {createHmac,timingSafeEqual} from 'node:crypto';
const TTL=90*86400000;
// Grace period only for links issued before expiring tokens were introduced.
const LEGACY_END=Date.parse('2026-10-27T00:00:00Z');
const sign=(secret,value)=>createHmac('sha256',secret).update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&/^[a-f0-9]{64}$/.test(a)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function issueTrackingToken(id,secret,now=Date.now()){
 const expires=now+TTL;return `${expires}.${sign(secret,`order-tracking:v2:${id}:${expires}`)}`;
}
export function verifyTrackingToken(id,token,secret,now=Date.now()){
 if(typeof token!=='string'||token.length>100)return false;
 if(/^[a-f0-9]{64}$/.test(token))return now<LEGACY_END&&equal(token,sign(secret,'order-tracking:'+id));
 const parts=token.split('.');if(parts.length!==2||!/^\d{13}$/.test(parts[0]))return false;
 const expires=Number(parts[0]);return expires>now&&expires<=now+TTL&&equal(parts[1],sign(secret,`order-tracking:v2:${id}:${expires}`));
}
export function trackingCredential(req,url){const header=String(req.headers.authorization||'');return header.startsWith('Bearer ')?header.slice(7):String(url.searchParams.get('token')||'');}

