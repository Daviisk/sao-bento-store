// Isolated durable records; transactions serialize stock and catalog writes.
export function createCommerceStore(store,schema='public'){
 const parse=v=>typeof v==='string'?JSON.parse(v):v;
 if(store.kind==='postgres'){
  const sql=store.sql,table=sql(schema+'.medalhas_commerce_documents');
  const adapter=db=>({async get(kind,id){const r=await db`SELECT document FROM ${table} WHERE kind=${kind} AND id=${id}`;return r[0]?parse(r[0].document):null;},async put(kind,id,v){await db`INSERT INTO ${table} (kind,id,document) VALUES (${kind},${id},${JSON.stringify(v)}::jsonb) ON CONFLICT (kind,id) DO UPDATE SET document=excluded.document,updated_at=now()`;},async list(kind){return (await db`SELECT document FROM ${table} WHERE kind=${kind} ORDER BY updated_at DESC`).map(r=>parse(r.document));}});
  return {...adapter(sql),transaction(fn){return sql.begin(async tx=>{await tx`SELECT pg_advisory_xact_lock(109384,78301)`;return fn(adapter(tx));});}};
 }
 const db=store.db;db.exec('CREATE TABLE IF NOT EXISTS commerce_documents(kind TEXT NOT NULL,id TEXT NOT NULL,document TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(kind,id))');
 const api={async get(k,id){const r=db.prepare('SELECT document FROM commerce_documents WHERE kind=? AND id=?').get(k,id);return r?parse(r.document):null;},async put(k,id,v){db.prepare('INSERT INTO commerce_documents VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET document=excluded.document,updated_at=excluded.updated_at').run(k,id,JSON.stringify(v),new Date().toISOString());},async list(k){return db.prepare('SELECT document FROM commerce_documents WHERE kind=? ORDER BY updated_at DESC').all(k).map(r=>parse(r.document));}};
 let queue=Promise.resolve();return {...api,transaction(fn){const r=queue.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const v=await fn(api);db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}});queue=r.catch(()=>{});return r;}};
}
