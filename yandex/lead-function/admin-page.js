'use strict';

function adminPage() {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="theme-color" content="#171411">
  <title>Заявки — photoprobiz</title>
  <style>
    :root{--ink:#171411;--muted:#756e66;--paper:#f5f0e7;--card:#fffdf8;--line:#d9cfc1;--accent:#b45332;--green:#2f6d4f;--blue:#315f82;--shadow:0 18px 50px rgba(43,32,22,.12)}
    *{box-sizing:border-box}html{background:var(--paper);color:var(--ink);font-family:"Trebuchet MS","Segoe UI",sans-serif}body{margin:0;min-height:100vh;background:radial-gradient(circle at 95% 0,rgba(180,83,50,.13),transparent 30rem),linear-gradient(180deg,#f8f4ed 0,#eee6da 100%)}
    button,input,select{font:inherit}button{cursor:pointer}.hidden{display:none!important}.shell{width:min(920px,100%);min-height:100vh;margin:auto;padding:env(safe-area-inset-top) 18px calc(28px + env(safe-area-inset-bottom))}
    .login{min-height:100vh;display:grid;place-items:center;padding:24px}.login-card{width:min(420px,100%);padding:38px 30px 32px;background:var(--card);border:1px solid var(--line);border-radius:28px;box-shadow:var(--shadow)}
    .eyebrow{margin:0 0 12px;color:var(--accent);font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.login h1,.top h1{font-family:Georgia,"Times New Roman",serif;font-weight:500;letter-spacing:-.04em}.login h1{margin:0 0 10px;font-size:42px}.login-copy{margin:0 0 28px;color:var(--muted);line-height:1.5}
    .password{width:100%;height:58px;padding:0 16px;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);outline:none}.password:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(180,83,50,.13)}
    .primary{width:100%;height:56px;margin-top:12px;border:0;border-radius:14px;background:var(--ink);color:#fff;font-weight:800}.primary:disabled{opacity:.55}.error{min-height:20px;margin:12px 0 0;color:#a3362e;font-size:13px}
    .top{position:sticky;top:0;z-index:5;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:28px 2px 16px;background:linear-gradient(180deg,#f8f4ed 76%,rgba(248,244,237,0))}.top h1{margin:0;font-size:46px;line-height:.9}.top-meta{margin:9px 0 0;color:var(--muted);font-size:13px}.icon-button{width:46px;height:46px;border:1px solid var(--line);border-radius:50%;background:rgba(255,253,248,.86);color:var(--ink);font-size:20px}.icon-button:active{transform:scale(.96)}
    .tools{display:grid;grid-template-columns:1fr auto;gap:10px;margin:8px 0 14px}.search{height:50px;padding:0 16px;border:1px solid var(--line);border-radius:14px;background:rgba(255,253,248,.9);outline:none}.search:focus{border-color:var(--accent)}
    .filters{display:flex;gap:8px;overflow:auto;padding:0 0 16px;scrollbar-width:none}.filters::-webkit-scrollbar{display:none}.filter{flex:none;padding:10px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(255,253,248,.8);color:var(--muted);font-size:13px;font-weight:700}.filter.active{border-color:var(--ink);background:var(--ink);color:#fff}
    .date-title{display:flex;align-items:center;gap:12px;margin:24px 2px 10px;color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.date-title:after{content:"";height:1px;flex:1;background:var(--line)}
    .lead{display:grid;grid-template-columns:1fr auto;gap:12px;margin-bottom:10px;padding:18px;background:var(--card);border:1px solid var(--line);border-radius:20px;box-shadow:0 6px 20px rgba(43,32,22,.05);transition:transform .16s ease,box-shadow .16s ease}.lead:active{transform:scale(.992)}.lead-main{min-width:0;border:0;padding:0;background:transparent;text-align:left;color:inherit}.lead-time{color:var(--muted);font-size:12px}.lead-name{margin:5px 0 4px;font-family:Georgia,"Times New Roman",serif;font-size:25px;line-height:1.05;overflow-wrap:anywhere}.lead-phone{color:var(--ink);font-size:15px}.lead-side{display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:10px}.status{padding:7px 10px;border:0;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap}.status-new{background:#f7dfd5;color:#86371e}.status-contacted{background:#dce8f1;color:#264f6d}.status-closed{background:#dceade;color:#27583c}.call{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--ink);color:#fff;text-decoration:none;font-size:18px}
    .empty{padding:60px 20px;text-align:center;color:var(--muted)}.load-more{display:block;width:100%;height:52px;margin:18px 0;border:1px solid var(--line);border-radius:14px;background:var(--card);font-weight:800}
    .drawer-backdrop{position:fixed;inset:0;z-index:20;background:rgba(23,20,17,.58);backdrop-filter:blur(4px)}.drawer{position:fixed;z-index:21;left:50%;bottom:0;width:min(640px,100%);max-height:92vh;overflow:auto;transform:translateX(-50%);padding:10px 20px calc(24px + env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:var(--card);box-shadow:0 -20px 70px rgba(0,0,0,.24)}.handle{width:42px;height:4px;margin:2px auto 18px;border-radius:4px;background:#cabfb1}.drawer-close{float:right;width:40px;height:40px;border:0;border-radius:50%;background:#eee7dc;font-size:21px}.detail-label{margin:0 0 7px;color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.detail-name{margin:0 48px 6px 0;font-family:Georgia,"Times New Roman",serif;font-size:36px;font-weight:500;line-height:1}.detail-phone{margin:0 0 22px;font-size:19px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:22px}.action{display:flex;align-items:center;justify-content:center;min-height:50px;padding:10px;border:1px solid var(--ink);border-radius:13px;color:var(--ink);background:#fff;text-decoration:none;font-weight:800}.action.primary-action{background:var(--ink);color:#fff}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;margin:0 0 20px;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--line)}.datum{min-width:0;padding:14px;background:#faf6ef}.datum small{display:block;margin-bottom:5px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.datum strong{font-size:13px;overflow-wrap:anywhere}.status-select{width:100%;height:52px;padding:0 13px;border:1px solid var(--line);border-radius:13px;background:#fff;color:var(--ink)}.saving{margin-top:8px;color:var(--muted);font-size:12px}
    .toast{position:fixed;z-index:40;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);max-width:calc(100% - 32px);padding:12px 18px;border-radius:999px;background:var(--ink);color:#fff;font-size:13px;box-shadow:var(--shadow)}
    @media(min-width:700px){.shell{padding-inline:28px}.lead{padding:20px 22px}.drawer{bottom:30px;border-radius:28px}.top h1{font-size:56px}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
  </style>
</head>
<body>
  <section id="login" class="login hidden">
    <form id="login-form" class="login-card">
      <p class="eyebrow">Photoprobiz · личный кабинет</p>
      <h1>Заявки</h1>
      <p class="login-copy">Введите пароль владельца. После входа кабинет останется доступен на этом устройстве.</p>
      <input class="hidden" type="text" name="username" autocomplete="username" value="owner" tabindex="-1" aria-hidden="true">
      <input id="password" class="password" type="password" autocomplete="current-password" placeholder="Пароль" required>
      <button id="login-button" class="primary" type="submit">Войти</button>
      <p id="login-error" class="error" role="alert"></p>
    </form>
  </section>
  <main id="app" class="shell hidden">
    <header class="top"><div><p class="eyebrow">Photoprobiz · кабинет</p><h1>Заявки</h1><p id="count" class="top-meta">Загрузка…</p></div><button id="refresh" class="icon-button" aria-label="Обновить">↻</button></header>
    <div class="tools"><input id="search" class="search" type="search" inputmode="search" placeholder="Имя или телефон"><button id="logout" class="icon-button" aria-label="Выйти">↥</button></div>
    <nav id="filters" class="filters" aria-label="Фильтр по статусу">
      <button class="filter active" data-status="all">Все</button><button class="filter" data-status="new">Новые</button><button class="filter" data-status="contacted">Связался</button><button class="filter" data-status="closed">Завершены</button>
    </nav>
    <section id="list" aria-live="polite"></section>
    <button id="more" class="load-more hidden">Показать ещё</button>
  </main>
  <div id="backdrop" class="drawer-backdrop hidden"></div>
  <section id="drawer" class="drawer hidden" role="dialog" aria-modal="true" aria-labelledby="detail-name">
    <div class="handle"></div><button id="drawer-close" class="drawer-close" aria-label="Закрыть">×</button>
    <p class="detail-label">Заявка клиента</p><h2 id="detail-name" class="detail-name"></h2><p id="detail-phone" class="detail-phone"></p>
    <div id="detail-actions" class="actions"></div><div id="detail-grid" class="detail-grid"></div>
    <label class="detail-label" for="detail-status">Статус заявки</label><select id="detail-status" class="status-select"><option value="new">Новая</option><option value="contacted">Связался</option><option value="closed">Завершена</option></select><p id="saving" class="saving"></p>
  </section>
  <div id="toast" class="toast hidden" role="status"></div>
  <script>
  (function(){
    'use strict';
    var SESSION_KEY='photoprobiz_admin_session';
    var state={leads:[],cursor:'',hasMore:false,status:'all',selected:null,target:new URLSearchParams(location.search).get('lead')||''};
    var byId=function(id){return document.getElementById(id)};
    var login=byId('login'),app=byId('app'),list=byId('list'),more=byId('more');
    function endpoint(action,params){var q=new URLSearchParams(params||{});q.set('admin_api',action);return location.pathname+'?'+q.toString()}
    function sessionToken(){try{return localStorage.getItem(SESSION_KEY)||''}catch(e){return ''}}
    function saveSession(value){try{if(value)localStorage.setItem(SESSION_KEY,value);else localStorage.removeItem(SESSION_KEY)}catch(e){}}
    async function request(action,options,params){var config=Object.assign({},options||{}),headers=Object.assign({'X-Admin-Request':'1'},config.headers||{}),token=sessionToken();if(token)headers['X-Admin-Session']=token;config.headers=headers;var response=await fetch(endpoint(action,params),config);var body={};try{body=await response.json()}catch(e){}if(response.status===401){if(action!=='login'){saveSession('');showLogin()}throw new Error(action==='login'?'INVALID_LOGIN':'AUTH')}if(!response.ok)throw new Error(body.error||'REQUEST');return body}
    function showLogin(){app.classList.add('hidden');login.classList.remove('hidden');setTimeout(function(){byId('password').focus()},60)}
    function showApp(){login.classList.add('hidden');app.classList.remove('hidden')}
    function dateOf(value){return new Date(value)}
    function dateKey(value){return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(dateOf(value))}
    function dateTitle(value){var d=dateOf(value),now=new Date(),yesterday=new Date(now.getTime()-86400000);var key=dateKey(value);if(key===dateKey(now))return 'Сегодня';if(key===dateKey(yesterday))return 'Вчера';return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',year:'numeric'}).format(d)}
    function time(value){return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}).format(dateOf(value))}
    function fullDate(value){return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(dateOf(value))}
    function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
    function labelsStatus(value){return value==='contacted'?'Связался':value==='closed'?'Завершена':'Новая'}
    function method(value){return {phone:'Телефон',telegram:'Telegram',whatsapp:'WhatsApp',max_messenger:'Max'}[value]||'Телефон'}
    function source(value){return value==='inline'?'Форма на странице':'Всплывающая форма'}
    function digits(value){return String(value||'').replace(/\\D/g,'')}
    function visible(){var query=byId('search').value.trim().toLowerCase().replace(/\\D/g,'');var raw=byId('search').value.trim().toLowerCase();return state.leads.filter(function(lead){var matchesStatus=state.status==='all'||lead.status===state.status;var matchesSearch=!raw||lead.name.toLowerCase().includes(raw)||digits(lead.phone).includes(query);return matchesStatus&&matchesSearch})}
    function render(){var rows=visible(),html='',day='';rows.forEach(function(lead){var nextDay=dateKey(lead.serverReceivedAt);if(nextDay!==day){day=nextDay;html+='<h2 class="date-title">'+esc(dateTitle(lead.serverReceivedAt))+'</h2>'}html+='<article class="lead" data-id="'+esc(lead.submissionId)+'"><button class="lead-main" data-open="'+esc(lead.submissionId)+'"><span class="lead-time">'+esc(time(lead.serverReceivedAt))+' · '+esc(method(lead.contactMethod))+'</span><h3 class="lead-name">'+esc(lead.name)+'</h3><span class="lead-phone">'+esc(lead.phone)+'</span></button><div class="lead-side"><span class="status status-'+esc(lead.status)+'">'+esc(labelsStatus(lead.status))+'</span><a class="call" href="tel:'+esc(lead.phone)+'" aria-label="Позвонить">☎</a></div></article>'});list.innerHTML=html||'<div class="empty">Заявок по этому фильтру нет</div>';byId('count').textContent=state.leads.length+' '+plural(state.leads.length,'заявка','заявки','заявок');more.classList.toggle('hidden',!state.hasMore)}
    function plural(n,one,few,many){var m=n%100;if(m>=11&&m<=19)return many;var d=n%10;return d===1?one:(d>=2&&d<=4?few:many)}
    function cursorFrom(lead){return btoa(unescape(encodeURIComponent(JSON.stringify({receivedAt:lead.serverReceivedAt,submissionId:lead.submissionId})))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'')}
    async function load(reset){if(reset){state.leads=[];state.cursor='';state.hasMore=false;byId('count').textContent='Обновление…'}var body=await request('leads',null,{limit:'50',cursor:state.cursor});var known=new Set(state.leads.map(function(x){return x.submissionId}));body.leads.forEach(function(x){if(!known.has(x.submissionId))state.leads.push(x)});state.hasMore=body.hasMore;if(body.leads.length)state.cursor=cursorFrom(body.leads[body.leads.length-1]);render();if(state.target){var found=state.leads.find(function(x){return x.submissionId===state.target});if(!found){try{found=(await request('lead',null,{id:state.target})).lead}catch(e){}}if(found)openDetail(found);state.target=''}}
    function datum(label,value){return '<div class="datum"><small>'+esc(label)+'</small><strong>'+esc(value||'—')+'</strong></div>'}
    function openDetail(lead){state.selected=lead;byId('detail-name').textContent=lead.name;byId('detail-phone').textContent=lead.phone;var acts='<a class="action primary-action" href="tel:'+esc(lead.phone)+'">Позвонить</a><button id="copy-phone" class="action">Скопировать</button>';if(lead.contactMethod==='whatsapp')acts+='<a class="action" target="_blank" rel="noopener" href="https://wa.me/'+digits(lead.phone)+'">WhatsApp</a>';if(lead.contactMethod==='telegram')acts+='<a class="action" href="tg://resolve?phone='+digits(lead.phone)+'">Telegram</a>';byId('detail-actions').innerHTML=acts;byId('detail-grid').innerHTML=datum('Дата и время',fullDate(lead.serverReceivedAt))+datum('Способ связи',method(lead.contactMethod))+datum('Пакет',lead.packageName)+datum('Источник',source(lead.source))+datum('Форма',lead.formId)+datum('ID',lead.submissionId);byId('detail-status').value=lead.status;byId('saving').textContent='';byId('backdrop').classList.remove('hidden');byId('drawer').classList.remove('hidden');document.body.style.overflow='hidden';var copy=byId('copy-phone');if(copy)copy.onclick=function(){navigator.clipboard.writeText(lead.phone).then(function(){toast('Телефон скопирован')})}}
    function closeDetail(){byId('backdrop').classList.add('hidden');byId('drawer').classList.add('hidden');document.body.style.overflow='';state.selected=null}
    function toast(text){var el=byId('toast');el.textContent=text;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(function(){el.classList.add('hidden')},1800)}
    byId('login-form').addEventListener('submit',async function(e){e.preventDefault();var button=byId('login-button'),error=byId('login-error');button.disabled=true;error.textContent='';try{var body=await request('login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:byId('password').value})});if(!body.session)throw new Error('SESSION');saveSession(body.session);byId('password').value='';showApp();await load(true)}catch(err){error.textContent=err.message==='INVALID_LOGIN'?'Неверный пароль.':'Временная ошибка. Попробуйте ещё раз.'}finally{button.disabled=false}})
    byId('filters').addEventListener('click',function(e){var button=e.target.closest('[data-status]');if(!button)return;state.status=button.dataset.status;document.querySelectorAll('.filter').forEach(function(x){x.classList.toggle('active',x===button)});render()});
    byId('search').addEventListener('input',render);list.addEventListener('click',function(e){var button=e.target.closest('[data-open]');if(!button)return;var lead=state.leads.find(function(x){return x.submissionId===button.dataset.open});if(lead)openDetail(lead)});more.addEventListener('click',function(){load(false).catch(function(){toast('Не удалось загрузить заявки')})});byId('refresh').addEventListener('click',function(){load(true).catch(function(){toast('Не удалось обновить')})});
    byId('drawer-close').addEventListener('click',closeDetail);byId('backdrop').addEventListener('click',closeDetail);document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDetail()});
    byId('detail-status').addEventListener('change',async function(e){if(!state.selected)return;var next=e.target.value,old=state.selected.status;byId('saving').textContent='Сохраняю…';try{await request('status',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Request':'1'},body:JSON.stringify({submissionId:state.selected.submissionId,status:next})});state.selected.status=next;render();byId('saving').textContent='Статус сохранён'}catch(err){state.selected.status=old;e.target.value=old;byId('saving').textContent='Не удалось сохранить'}});
    byId('logout').addEventListener('click',async function(){try{await request('logout',{method:'POST'})}catch(e){}saveSession('');showLogin()});
    request('session').then(function(body){if(!body.authenticated){showLogin();return}showApp();return load(true)}).catch(function(){showLogin()});
  }());
  </script>
</body>
</html>`;
}

module.exports = { adminPage };
