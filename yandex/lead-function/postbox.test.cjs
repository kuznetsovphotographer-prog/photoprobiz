'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createYdbStore, UPSERT_LEAD } = require('./storage.js');
const { createHandler } = require('./index.js');
const { buildMail, sendMail, createDrainHandler, POSTBOX_URL, CRM_URL } = require('./postbox.js');
const env = { ENDPOINT:'grpcs://example.test:2135',DATABASE:'/test/database',DELIVERY_MODE:'postbox',
  POSTBOX_FROM_EMAIL:'notifications@prointeriors.ru',POSTBOX_TO_EMAIL:'TheAlexMay@yandex.ru' };
const context = { token:{access_token:'synthetic-iam-token'} };
const lead = { name:'Тест',contact:'+79990000000',contactMethod:'phone',source:'modal',consent:true,
  consentVersion:'2026-11-18',consentAcceptedAt:'2026-11-18T12:00:00.000Z',
  submissionId:'00000000-0000-4000-8000-000000000001',formId:'modal-general',deviceType:'phone',osFamily:'android' };
const event = (value=lead,origin='https://photoprobiz.ru')=>({httpMethod:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(value)});
const now = ()=>new Date().toISOString();

// In-memory SDK transaction model: exercises production SQL, transaction boundaries and rollback.
// It is not a substitute for the deferred release-time YDB integration check.
function database() {
  let state={leads:{},consent_events:{},notification_outbox:{}}, staged, serial=Promise.resolve();
  const stats={commits:0,rollbacks:0,writes:0,failWrite:false,failFinish:false};
  const native=rows=>({resultSets:[rows]});
  const session={
    describeTable:async()=>({columns:[]}),alterTable:async()=>{},prepareQuery:async q=>q,
    beginTransaction:async options=>{assert.deepEqual(options,{serializableReadWrite:{}});staged=structuredClone(state);return {id:'tx'};},
    commitTransaction:async tx=>{assert.deepEqual(tx,{txId:'tx'});state=staged;staged=undefined;stats.commits++;},
    rollbackTransaction:async()=>{staged=undefined;stats.rollbacks++;},
    executeQuery:async(q,p={},tx)=>{
      const v=Object.fromEntries(Object.entries(p).map(([k,value])=>[k,value.value]));
      const db=tx ? staged : state;
      if(tx)assert.deepEqual(tx,{txId:'tx'});
      if(q.includes('SELECT * FROM leads'))return native(db.leads[v.$id]?[db.leads[v.$id]]:[]);
      if(q.includes('SELECT submission_id FROM notification_outbox WHERE submission_id'))return native(db.notification_outbox[v.$id]?[db.notification_outbox[v.$id]]:[]);
      if(q===UPSERT_LEAD){
        assert.ok(tx,'all web writes must be in the explicit transaction');
        for(const table of ['leads','consent_events','notification_outbox'])assert.match(q,new RegExp('INSERT INTO '+table));
        const id=v.$submission_id;assert.equal(db.leads[id],undefined);
        const record=Object.fromEntries(Object.entries(v).map(([key,value])=>[key.slice(1),value]));
        db.leads[id]={...record,status:'new',expires_at:v.$lead_expires_at};
        db.consent_events[id]={...record,expires_at:v.$consent_expires_at};
        if(stats.failWrite)throw Error('synthetic write failure');
        db.notification_outbox[id]={submission_id:id,site_host:v.$site_host,state:v.$notification_state,
          server_received_at:v.$server_received_at,expires_at:v.$lead_expires_at,message_id:''};stats.writes++;return native([]);
      }
      if(q.includes('SELECT state, site_host'))return native(db.notification_outbox[v.$id]?[db.notification_outbox[v.$id]]:[]);
      if(q.includes('SELECT submission_id FROM notification_outbox'))return native(Object.values(db.notification_outbox)
        .filter(row=>['postbox-pending','postbox-retry-1','postbox-retry-2'].includes(row.state)&&new Date(row.expires_at)>new Date()).slice(0,5));
      if(q.includes('UPDATE notification_outbox')){
        const row=db.notification_outbox[v.$id];
        if(v.$claim&&row?.state!==v.$claim)return native([]);
        if(stats.failFinish&&v.$claim)throw Error('synthetic finish write failure');
        if(row){row.state=v.$state;if(v.$message!==undefined)row.message_id=v.$message;}return native([]);
      }
      throw Error('Unexpected test query');
    },
  };
  class Driver{constructor(){this.tableClient={withSessionRetry:callback=>{
    const pending=serial.then(()=>callback(session));serial=pending.catch(()=>{});return pending;
  }};}async ready(){return true;}}
  class Column{constructor(name,type){this.name=name;this.type=type;}}
  class AlterTableDescription{withAddColumn(){return this;}}
  const typed=value=>({value});
  const sdk={Driver,Column,AlterTableDescription,Types:{UTF8:'utf8',UINT64:'uint64',TIMESTAMP:'timestamp',optional:value=>value},
    TypedValues:{utf8:typed,timestamp:typed},TypedData:{createNativeObjects:rows=>rows}};
  return {store:createYdbStore({env,sdk}),state:()=>state,stats};
}

test('atomic write, same-ID concurrent replay, immutable consent, conflict and historical no-backfill',async()=>{
  const db=database();
  const results=await Promise.all([db.store.save(lead,now(),context.token.access_token,'photoprobiz.ru',true),
    db.store.save(lead,now(),context.token.access_token,'photoprobiz.ru',true)]);
  assert.deepEqual(results.map(r=>r.created),[true,false]);assert.equal(db.stats.writes,1);
  const row=db.state().leads[lead.submissionId];row.status='contacted';
  await db.store.save(lead,now(),context.token.access_token,'photoprobiz.ru',true);
  assert.equal(row.status,'contacted');assert.equal(db.state().consent_events[lead.submissionId].consent_version,'2026-11-18');
  await assert.rejects(db.store.save({...lead,contact:'+79990000001'},now(),context.token.access_token,'photoprobiz.ru',true),{code:'SUBMISSION_CONFLICT'});
  await assert.rejects(db.store.save(lead,now(),context.token.access_token,'aleksreport.ru',true),{code:'SUBMISSION_CONFLICT'});
  delete db.state().notification_outbox[lead.submissionId];
  assert.equal((await db.store.save(lead,now(),context.token.access_token,'photoprobiz.ru',true)).created,false);
  assert.deepEqual(db.state().notification_outbox,{});
});

test('a failed transaction leaves neither lead nor consent nor mail job',async()=>{
  const db=database();db.stats.failWrite=true;
  await assert.rejects(db.store.save(lead,now(),context.token.access_token,'photoprobiz.ru',true));
  assert.deepEqual(db.state(),{leads:{},consent_events:{},notification_outbox:{}});assert.equal(db.stats.rollbacks,1);
});

test('receipt success is independent of rejection, timeout or a failed finish write; replay never resends',async()=>{
  for(const scenario of ['success','reject','timeout','finish-failure']){
    const db=database();const handle=createHandler({env,leadStore:db.store});
    const response=await handle(event(),context);assert.equal(response.statusCode,202);assert.equal(JSON.parse(response.body).ok,true);
    let calls=0;
    const drain=createDrainHandler({env,store:db.store,fetchImpl:async(url,options)=>{
      calls++;assert.equal(url,POSTBOX_URL);assert.equal(options.headers['X-YaCloud-SubjectToken'],context.token.access_token);
      assert.equal(Object.keys(db.state().leads).length,1);assert.equal(Object.keys(db.state().consent_events).length,1);
      if(scenario==='timeout')throw Object.assign(Error('timeout'),{name:'TimeoutError'});
      return {status:scenario==='reject'?403:200,json:async()=>({MessageId:'synthetic-message-id'})};
    }});
    db.stats.failFinish=scenario==='finish-failure';
    if(db.stats.failFinish)await assert.rejects(drain({},context));else await drain({},context);
    assert.equal(JSON.parse((await handle(event(),context)).body).notification,'already-recorded');
    await drain({},context);assert.equal(calls,1);
    assert.equal(Object.keys(db.state().leads).length,1);assert.equal(Object.keys(db.state().consent_events).length,1);
    assert.equal(db.state().notification_outbox[lead.submissionId].state,
      {success:'postbox-sent',reject:'postbox-failed',timeout:'postbox-uncertain','finish-failure':'postbox-sending-1'}[scenario]);
  }
});

test('two drain invocations claim a job once and retry only explicit pre-send failures at most three times',async()=>{
  const db=database();await db.store.save(lead,now(),context.token.access_token,'photoprobiz.ru',true);
  let calls=0;const drain=createDrainHandler({env,store:db.store,fetchImpl:async()=>{calls++;return {status:429};}});
  await Promise.all([drain({},context),drain({},context)]);
  // A second invocation may legitimately perform a later explicit-rejection retry.
  await drain({},context);await drain({},context);await drain({},context);
  assert.equal(calls,3);assert.equal(db.state().notification_outbox[lead.submissionId].state,'postbox-failed');
  const fresh=database();await fresh.store.save(lead,now(),context.token.access_token,'photoprobiz.ru',true);
  const claims=await Promise.all([fresh.store.claimPostbox(lead.submissionId,context.token.access_token),fresh.store.claimPostbox(lead.submissionId,context.token.access_token)]);
  assert.equal(claims.filter(Boolean).length,1);
});

test('mail allowlist contains no client fields and both links retain the protected CRM card for both domains',()=>{
  for(const siteHost of ['photoprobiz.ru','aleksreport.ru']){
    const mail=buildMail({...lead,siteHost,serverReceivedAt:'2026-11-18T12:00:00Z',bookingDetails:'PRIVATE-TEXT'},
      {from:env.POSTBOX_FROM_EMAIL,to:env.POSTBOX_TO_EMAIL});
    assert.equal(mail.Content.Simple.Subject.Data,`Новая заявка с сайта ${siteHost}`);
    assert.deepEqual(mail.Content.Simple.Headers,[{Name:'X-Submission-Id',Value:lead.submissionId},{Name:'X-Source-Site',Value:siteHost}]);
    assert.deepEqual(mail.Destination,{ToAddresses:[env.POSTBOX_TO_EMAIL]});
    const text=JSON.stringify(mail);for(const forbidden of [lead.name,lead.contact,'PRIVATE-TEXT',lead.consentVersion])assert.ok(!text.includes(forbidden));
    assert.match(mail.Content.Simple.Body.Text.Data,/15:00:00/);
    const links=[...mail.Content.Simple.Body.Html.Data.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
    assert.equal(links.length,2);assert.equal(links[0],links[1]);
    const url=new URL(links[0]);assert.equal(url.origin+url.pathname,CRM_URL);
    assert.deepEqual([...url.searchParams],[['admin','1'],['lead',lead.submissionId]]);
  }
  assert.throws(()=>buildMail({submissionId:lead.submissionId,siteHost:'evil.test',serverReceivedAt:now()},{from:'a@test.test',to:'b@test.test'}));
});

test('disabled delivery and low remaining time perform no provider request',async()=>{
  const db=database();await db.store.save(lead,now(),context.token.access_token,'photoprobiz.ru',true);
  const forbidden=()=>assert.fail('must not send');
  assert.deepEqual(await createDrainHandler({env:{...env,DELIVERY_MODE:'storage-only'},store:db.store,fetchImpl:forbidden})({},context),{attempted:0,disabled:true});
  assert.deepEqual(await createDrainHandler({env,store:db.store,fetchImpl:forbidden})({},
    {...context,getRemainingTimeInMillis:()=>20000}),{attempted:0});
  assert.equal(db.state().notification_outbox[lead.submissionId].state,'postbox-pending');
  const second=database();await second.store.save(lead,now(),context.token.access_token,'photoprobiz.ru',false);
  assert.deepEqual(await second.store.listPostbox(context.token.access_token),[]);
  assert.deepEqual(await createDrainHandler({env,store:db.store,fetchImpl:forbidden})({prepare:true},context),{prepared:true,attempted:0});
  assert.equal(db.state().notification_outbox[lead.submissionId].state,'postbox-pending');
});

test('all ambiguous provider responses stop automatic retries',async()=>{
  for(const status of [200,408,500,502,503,302]){
    const result=await sendMail({},'synthetic',async()=>({status,json:async()=>({})}));assert.equal(result.outcome,'uncertain');
  }
  for(const status of [400,401,403,404])assert.equal((await sendMail({},'synthetic',async()=>({status}))).outcome,'failed');
  assert.equal((await sendMail({},'synthetic',async()=>{throw {cause:{code:'ENOTFOUND'}};})).outcome,'retry');
  assert.equal((await sendMail({},'synthetic',async()=>{throw {cause:{code:'ECONNRESET'}};})).outcome,'uncertain');
});

test('old open form versions queue only newly inserted leads and retain their actual version',async()=>{
  for(const consentVersion of ['2026-09-11','2026-09-12','2026-09-12-2','2026-09-12-3','2026-11-17','2026-11-18']){
    const db=database();const handle=createHandler({env,leadStore:db.store});
    assert.equal((await handle(event({...lead,consentVersion,site:'evil.test'}),context)).statusCode,202);
    assert.equal(db.state().consent_events[lead.submissionId].consent_version,consentVersion);
    assert.equal(db.state().notification_outbox[lead.submissionId].site_host,'photoprobiz.ru');
  }
});

test('CRM card API is protected before reading data; receiver never depends on mail credentials',async()=>{
  const configured={...env,ADMIN_BASE_URL:CRM_URL,ADMIN_PASSWORD_SCRYPT:'scrypt:test:test',ADMIN_SESSION_SECRET:'synthetic-session-secret-long-enough'};
  const handle=createHandler({env:configured,leadStore:{get:()=>assert.fail('unauthenticated read')}});
  assert.equal((await handle({httpMethod:'GET',queryStringParameters:{admin_api:'lead',id:lead.submissionId}})).statusCode,401);
  const db=database();assert.equal((await createHandler({env:{DELIVERY_MODE:'postbox'},leadStore:db.store})(event(),context)).statusCode,202);
});

test('Wedding keeps its dynamic package, booking details and optional device profile under all consent editions',async()=>{
  const wedding={siteHost:'aleksreport.ru',label:'Свадебная съёмка',origins:['https://aleksreport.ru'],
    consentVersions:['2026-09-23-crm','2026-11-17-crm','2026-11-18-crm'],
    formIds:['aleksreport-modal','aleksreport-contacts'],packages:[],notifications:true};
  for(const consentVersion of wedding.consentVersions)for(const formId of wedding.formIds){
    const db=database();const handle=createHandler({env:{...env,CRM_SITES_JSON:JSON.stringify([wedding])},leadStore:db.store});
    const {deviceType,osFamily,...request}=lead;
    const value={...request,consentVersion,formId,shootingType:'weddings',
      packageName:'Свадьбы · Базовый · 4 ч · 45000 ₽',bookingDetails:'4 часа, 200 фотографий; synthetic@example.test'};
    assert.equal((await handle(event(value,'https://aleksreport.ru'),context)).statusCode,202);
    const saved=db.state().leads[lead.submissionId];
    assert.equal(saved.consent_version,consentVersion);assert.equal(saved.package_name,value.packageName);
    assert.equal(saved.booking_details,'Вид съёмки: Свадьбы\n'+value.bookingDetails);
    assert.equal(saved.device_type,'unknown');assert.equal(db.state().notification_outbox[lead.submissionId].site_host,'aleksreport.ru');
  }
});
