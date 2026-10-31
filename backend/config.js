import {resolve} from 'node:path';
export function readConfig(env=process.env){
  const production=env.NODE_ENV==='production';
  const port=Number(env.PORT||3000);if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT inválida.');
  // Vercel provides trusted deployment domains without a protocol. Do not infer
  // the application's origin from a request Host header.
  const vercelHost=env.VERCEL==='1'
    ? (env.VERCEL_ENV==='preview'?env.VERCEL_URL:(env.VERCEL_PROJECT_PRODUCTION_URL||env.VERCEL_URL))
    : '';
  if(!env.APP_URL&&vercelHost&&!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(vercelHost))throw Error('Domínio da Vercel inválido.');
  const baseURL=env.APP_URL||(vercelHost?`https://${vercelHost}`:`http://localhost:${port}`);const u=new URL(baseURL);
  if(u.origin!==baseURL||u.username||u.password)throw Error('APP_URL deve conter somente a origem, sem barra final.');
  if(production&&u.protocol!=='https:')throw Error('Produção exige APP_URL HTTPS.');
  const mode=env.MERCADO_PAGO_MODE||'disabled';if(!['disabled','test','production'].includes(mode))throw Error('MERCADO_PAGO_MODE inválido.');
  if(mode==='production'&&!production)throw Error('Pagamentos reais exigem NODE_ENV=production.');
  const trustProxy=env.TRUST_PROXY||false;
  if(trustProxy==='true'||/^\d+$/.test(String(trustProxy)))throw Error('TRUST_PROXY deve ser IP/CIDR explícito ou loopback, nunca true ou número.');
  const adminPassword=env.ADMIN_PASSWORD||'',adminSessionSecret=env.ADMIN_SESSION_SECRET||'';
  const adminEmail=String(env.ADMIN_EMAIL||'contato@saobentodobroes.com').trim().toLowerCase();
  const adminConfigured=adminPassword.length>=8&&adminSessionSecret.length>=32&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail);
  const databaseUrl=String(env.DATABASE_URL||'').trim();
  const resendApiKey=String(env.RESEND_API_KEY||'').trim();
  const resendFromEmail=String(env.RESEND_FROM_EMAIL||'São Bento Dobrões <Contato@saobentodobroes.com>').trim();
  const resendReplyTo=String(env.RESEND_REPLY_TO||'').trim().toLowerCase();
  if(resendReplyTo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendReplyTo))throw Error('RESEND_REPLY_TO inválido.');
  if(databaseUrl){const db=new URL(databaseUrl);if(!['postgres:','postgresql:'].includes(db.protocol)||!db.hostname||!db.username||!db.password)throw Error('DATABASE_URL PostgreSQL inválida.');}
  return {storeIdentity:{name:String(env.STORE_LEGAL_NAME||''),document:String(env.STORE_DOCUMENT||''),address:String(env.STORE_ADDRESS||''),email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.STORE_SUPPORT_EMAIL||'')?env.STORE_SUPPORT_EMAIL:'',phone:String(env.STORE_SUPPORT_PHONE||'')},privacyController:String(env.PRIVACY_CONTROLLER||""),privacyEmail:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.PRIVACY_EMAIL||"")?env.PRIVACY_EMAIL:"",production,port,baseURL,mode,trustProxy,accessToken:env.MERCADO_PAGO_ACCESS_TOKEN||'',publicKey:env.MERCADO_PAGO_PUBLIC_KEY||'',webhookSecret:env.WEBHOOK_SECRET||'',resendApiKey,resendFromEmail,resendReplyTo,sellerId:env.MERCADO_PAGO_SELLER_ID||'',applicationId:env.MERCADO_PAGO_APPLICATION_ID||'',adminEmail,adminPassword,adminSessionSecret,adminConfigured,databaseUrl,databaseSchema:env.DATABASE_SCHEMA||'public',databasePath:resolve(env.DATABASE_PATH||'backend/data/shop.sqlite'),frontendPath:resolve('frontend'),checkoutLimit:10,webhookLimit:120,sessionLimit:30};
}


