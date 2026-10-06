import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://ginbznhpjwskfsxocmpx.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_M8X8AoswTDFSLTf-iKdLUg_GBDA6B9O';
const configured=!SUPABASE_URL.startsWith('INSERISCI_QUI')&&!SUPABASE_ANON_KEY.startsWith('INSERISCI_QUI');
const sb=configured?createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
window.testSb = sb;
const app=document.querySelector('#app'),userArea=document.querySelector('#userArea');
let user=null,profile=null,projector=null,rows=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const fmt=s=>s?new Date(s).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):'—';
const name=p=>p?(p.first_name||'Utente')+(p.last_name?' '+p.last_name:''):'—';
function status(){
  if(rows[0]&&(rows[0].state==='LASCIATO_ACCESO'||rows[0].state==='IN_CARICO')){
    return 'alert';
  }

  if(!rows[0]||!projector){
    return 'overdue';
  }

  const next = new Date(rows[0].powered_at);
  next.setDate(next.getDate() + projector.interval_days);

  const today = new Date();
  today.setHours(0,0,0,0);
  next.setHours(0,0,0,0);

  return today >= next ? 'overdue' : 'ok';
}
function toast(t){let x=document.createElement('div');x.className='toast';x.textContent=t;document.body.append(x);setTimeout(()=>x.remove(),3500)}
function modal(title,body){let o=document.createElement('div');o.className='overlay';o.innerHTML=`<div class="modal"><div class="mhead"><h2>${title}</h2><button class="x">×</button></div>${body}</div>`;o.querySelector('.x').onclick=()=>o.remove();document.body.append(o);return o}
async function load(){
  if(!sb||!user){render();return}
  const p=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(p.error){console.error('profiles load error',p.error);toast('Errore profilo: '+p.error.message);return}
  profile=p.data;
  const q=await sb.from('projectors').select('*').eq('active',true).order('created_at').limit(1).maybeSingle();
  if(q.error){console.error('projectors load error',q.error);toast('Errore proiettore: '+q.error.message);return}
  projector=q.data;
  if(!projector){toast('Nessun proiettore configurato nel database.');renderDashboard();return}
  const r=await sb.from('maintenance_sessions').select('*, user:profiles!maintenance_sessions_user_id_fkey(*), shutdown_user:profiles!maintenance_sessions_shutdown_user_id_fkey(*), claimed_user:profiles!maintenance_sessions_claimed_by_fkey(*)').eq('projector_id',projector.id).order('powered_at',{ascending:false}).limit(100);
  if(r.error){console.error('sessions load error',r.error);toast('Errore storico: '+r.error.message);return}
  rows=r.data||[];render()
}
function render(){if(!configured){userArea.innerHTML='<span class="pill warn">DEMO / DA CONFIGURARE</span>';renderSetup();return}if(!user){userArea.innerHTML='<button class="login" id="login">Accedi</button>';app.innerHTML=`<section class="welcome"><img src="icons/icon-192.png"><h1>Projector Control</h1><p>Gestione condivisa delle accensioni del proiettore.</p><button class="primary" id="login2">ACCEDI</button><button class="secondary" id="signup">CREA ACCOUNT</button></section>`;document.querySelector('#login').onclick=loginModal;document.querySelector('#login2').onclick=loginModal;document.querySelector('#signup').onclick=signupModal;return}userArea.innerHTML=`<span class="pill">${esc(name(profile))}</span><button class="login" id="logout">Esci</button>`;document.querySelector('#logout').onclick=async()=>{await sb.auth.signOut();location.reload()};renderDashboard()}
function renderSetup(){app.innerHTML=`<section class="welcome"><img src="icons/icon-192.png"><h1>Cinema Projector Control</h1><p>L'app è pronta. Devi solo collegarla a Supabase.</p><div class="setup">Apri <b>README.md</b>: inserisci URL e anon key in <b>app.js</b>, esegui <b>supabase/schema.sql</b>, poi pubblica su GitHub Pages.</div></section>`}
function renderDashboard(){
  let s=status();
  let last=rows[0];
  let open=rows.find(x=>x.state==='LASCIATO_ACCESO'||x.state==='IN_CARICO');

  let nextDate=null;

  if(last&&projector){
    nextDate=new Date(last.powered_at);
    nextDate.setDate(nextDate.getDate()+projector.interval_days);
  }

  const today=new Date();
  today.setHours(0,0,0,0);

  let overdue=nextDate&&today>=new Date(
    nextDate.getFullYear(),
    nextDate.getMonth(),
    nextDate.getDate()
  );

  let title=open
    ? 'QUALCUNO DEVE SPEGNERE'
    : !last
      ? 'PRIMA ACCENSIONE'
      : overdue
        ? 'ACCENSIONE DA ESEGUIRE'
        : 'TUTTO OK';

  let sub=open
    ? `${name(open.user)} ha lasciato acceso il proiettore il ${fmt(open.powered_at)}.`
    : overdue
      ? 'Accendere il proiettore prima possibile.'
      : last
        ? 'Il proiettore è in regola.'
        : 'Nessuna accensione registrata.';

  let centralNumber=last&&nextDate
    ? overdue
      ? 'ORA'
      : nextDate.toLocaleDateString('it-IT',{
          day:'2-digit',
          month:'2-digit',
          year:'numeric'
        })
    : '—';

  app.innerHTML=`
    <section class="status ${s}">
      <div class="statusIcon">
        ${s==='ok'?'✓':s==='alert'?'⚠':'!'}
      </div>

      <div>
        <small>STATO PROIETTORE</small>
        <h1>${title}</h1>
        <p>${esc(sub)}</p>
      </div>
    </section>

    ${open?`
    <section class="alert">
      <div>
        <b>🔴 Proiettore acceso</b>
        <p>
          Registrato da <b>${esc(name(open.user))}</b> · ${fmt(open.powered_at)}
        </p>
        ${open.claimed_by
          ? `<small>In carico a ${esc(name(open.claimed_user))}</small>`
          : ''}
      </div>

      <div>
        ${!open.claimed_by
          ? '<button class="secondary" id="claim">🙋 VADO IO</button>'
          : ''}

        ${(open.claimed_by===user.id||profile?.role==='admin')
          ? '<button class="danger" id="shutdown">✓ PROIETTORE SPENTO</button>'
          : ''}
      </div>
    </section>`
    : ''}

    <div class="grid">

      <section class="card center">

        <small>${esc(projector?.name||'Proiettore Cinema')}</small>

        <div class="muted" style="font-size:1rem;font-weight:700;margin-top:12px;">
          PROSSIMA ACCENSIONE
        </div>

        <div class="number">${centralNumber}</div>

        <div class="muted">
          ${last
            ? overdue
              ? '⚠ ACCENDERE PRIMA POSSIBILE'
              : 'Data prevista'
            : 'Nessuna accensione registrata'}
        </div>

        <button class="primary full" id="register">
          ⚡ REGISTRA ACCENSIONE
        </button>

      </section>

      <section class="card stats">

        <div>
          <small>Ultima accensione</small>
          <b>${fmt(last?.powered_at)}</b>
        </div>

        <div>
          <small>Eseguita da</small>
          <b>${esc(name(last?.user))}</b>
        </div>

        <div>
          <small>Intervallo</small>
          <b>${projector?.interval_days||14} giorni</b>
        </div>

        <div>
          <small>Operazioni</small>
          <b>${rows.length}</b>
        </div>

      </section>

    </div>

    <div class="actions">

      <button class="quick" id="history">
        📋 <b>Storico</b>
        <span>Ultime operazioni</span>
      </button>

      ${profile?.role==='admin'
        ? `<button class="quick" id="settings">
            ⚙️ <b>Impostazioni</b>
            <span>Intervallo e proiettore</span>
          </button>`
        : ''}

    </div>
  `;

  document.querySelector('#register').onclick=registerModal;
  document.querySelector('#history').onclick=historyModal;
  document.querySelector('#claim')?.addEventListener('click',claim);
  document.querySelector('#shutdown')?.addEventListener('click',shutdown);
  document.querySelector('#settings')?.addEventListener('click',settingsModal);
}
function loginModal(){let m=modal('Accedi',`<label>Email<input id="e" type="email"></label><label>Password<input id="p" type="password"></label><button class="primary full" id="go">ACCEDI</button>`);m.querySelector('#go').onclick=async()=>{let {error}=await sb.auth.signInWithPassword({email:m.querySelector('#e').value,password:m.querySelector('#p').value});if(error)toast(error.message);else m.remove()}}
function signupModal(){let m=modal('Crea account',`<label>Nome<input id="n"></label><label>Cognome<input id="c"></label><label>Email<input id="e" type="email"></label><label>Password<input id="p" type="password"></label><button class="primary full" id="go">CREA ACCOUNT</button>`);m.querySelector('#go').onclick=async()=>{let {data,error}=await sb.auth.signUp({email:m.querySelector('#e').value,password:m.querySelector('#p').value,options:{data:{first_name:m.querySelector('#n').value,last_name:m.querySelector('#c').value}}});if(error){console.error('signup error',error);toast((error.code?error.code+': ':'')+error.message)}else{toast(data.session?'Account creato':'Controlla la mail per confermare l’account');m.remove()}}}
function registerModal(){let m=modal('Registra accensione',`<p class="note">Data e ora automatiche · ${new Date().toLocaleString('it-IT')}</p><label><input type="checkbox" checked> Proiettore acceso</label><label><input id="server" type="checkbox"> Server cinema acceso</label><label><input id="lamp" type="checkbox"> Lampada accesa</label><label>Note<textarea id="notes" placeholder="Eventuali note…"></textarea></label><label class="leave"><input id="leave" type="checkbox"> 🟠 <b>Non spengo tutto</b><small>Avvisa gli altri.</small></label><button class="primary full" id="save">CONFERMA</button>`);m.querySelector('#save').onclick=async()=>{let leave=m.querySelector('#leave').checked;let {error}=await sb.from('maintenance_sessions').insert({projector_id:projector.id,user_id:user.id,projector_on:true,server_on:m.querySelector('#server').checked,lamp_on:m.querySelector('#lamp').checked,notes:m.querySelector('#notes').value||null,state:leave?'LASCIATO_ACCESO':'COMPLETATA'});if(error)toast(error.message);else{m.remove();await load();toast(leave?'⚠️ Avviso condiviso creato':'Accensione registrata')}}}
async function claim(){let id=rows.find(x=>x.state==='LASCIATO_ACCESO')?.id;if(!id)return;let {error}=await sb.from('maintenance_sessions').update({claimed_by:user.id,claimed_at:new Date().toISOString(),state:'IN_CARICO'}).eq('id',id).eq('state','LASCIATO_ACCESO');if(error)toast(error.message);else{await load();toast('Hai preso in carico lo spegnimento')}}
async function shutdown(){let r=rows.find(x=>x.state==='IN_CARICO'||x.state==='LASCIATO_ACCESO');if(!r)return;let {error}=await sb.from('maintenance_sessions').update({shutdown_at:new Date().toISOString(),shutdown_user_id:user.id,state:'SPENTO'}).eq('id',r.id);if(error)toast(error.message);else{await load();toast('Spegnimento registrato')}}
function historyModal(){modal('Storico',`<div class="history">${rows.length?rows.map(r=>`<div class="row"><b>${fmt(r.powered_at)}</b><span>${esc(name(r.user))}</span><small>${r.state==='COMPLETATA'?'✓ Completata':r.state==='SPENTO'?'✓ Spento':r.state==='IN_CARICO'?'In carico':'⚠ Lasciato acceso'} · Proiettore ✓ · Server ${r.server_on?'✓':'—'} · Lampada ${r.lamp_on?'✓':'—'}</small></div>`).join(''):'Nessuna operazione.'}</div>`)}
function settingsModal(){let m=modal('Impostazioni',`<label>Nome proiettore<input id="n" value="${esc(projector.name)}"></label><label>Intervallo (giorni)<input id="d" type="number" min="1" max="365" value="${projector.interval_days}"></label><button class="primary full" id="save">SALVA</button>`);m.querySelector('#save').onclick=async()=>{let {error}=await sb.from('projectors').update({name:m.querySelector('#n').value,interval_days:+m.querySelector('#d').value}).eq('id',projector.id);if(error)toast(error.message);else{m.remove();await load();toast('Impostazioni salvate')}}}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
let realtimeChannel = null;

function subscribeRealtime(){
  if(!sb) return;

  if(realtimeChannel){
    sb.removeChannel(realtimeChannel);
  }

  realtimeChannel = sb
    .channel('maintenance-sessions-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'maintenance_sessions'
      },
      () => {
        load();
      }
    )
    .subscribe();
}
if(sb){
  sb.auth.getSession().then(({data})=>{
    user=data.session?.user||null;
    load();
    subscribeRealtime();
  });

  sb.auth.onAuthStateChange((_e,s)=>{
    user=s?.user||null;
    load();
    subscribeRealtime();
  });
}
else render();
