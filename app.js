import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ginbznhpjwskfsxocmpx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_M8X8AoswTDFSLTf-iKdLUg_GBDA6B9O';

const configured =
  !SUPABASE_URL.startsWith('INSERISCI_QUI') &&
  !SUPABASE_ANON_KEY.startsWith('INSERISCI_QUI');

const sb = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

window.testSb = sb;

const app = document.querySelector('#app');
const userArea = document.querySelector('#userArea');

let user = null;
let profile = null;
let projector = null;
let rows = [];
let realtimeChannel = null;


/* =========================
   UTILITY
========================= */

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}


function fmt(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}


function name(profileData) {
  if (!profileData) return '—';

  return (
    profileData.first_name || 'Utente'
  ) + (
    profileData.last_name
      ? ' ' + profileData.last_name
      : ''
  );
}


function toast(message) {
  const element = document.createElement('div');

  element.className = 'toast';
  element.textContent = message;

  document.body.appendChild(element);

  setTimeout(() => {
    element.remove();
  }, 3500);
}


function modal(title, body) {
  const overlay = document.createElement('div');

  overlay.className = 'overlay';

  overlay.innerHTML = `
    <div class="modal">
      <div class="mhead">
        <h2>${title}</h2>
        <button class="x" type="button">×</button>
      </div>

      ${body}
    </div>
  `;

  overlay.querySelector('.x').onclick = () => {
    overlay.remove();
  };

  document.body.appendChild(overlay);

  return overlay;
}


/* =========================
   STATO
========================= */

function getOpenSession() {
  return rows.find(row =>
    row.state === 'ACCESO' ||
    row.state === 'LASCIATO_ACCESO' ||
    row.state === 'IN_CARICO'
  );
}


function status() {
  const open = getOpenSession();

  if (open) {
    return 'alert';
  }

  if (!rows[0] || !projector) {
    return 'overdue';
  }

  const next = new Date(rows[0].powered_at);

  next.setDate(
    next.getDate() + projector.interval_days
  );

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  next.setHours(0, 0, 0, 0);

  return today >= next
    ? 'overdue'
    : 'ok';
}


/* =========================
   CARICAMENTO DATI
========================= */

async function load() {
  if (!sb || !user) {
    render();
    return;
  }

  const profileResult = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileResult.error) {
    console.error(
      'profiles load error',
      profileResult.error
    );

    toast(
      'Errore profilo: ' +
      profileResult.error.message
    );

    return;
  }

  profile = profileResult.data;


  const projectorResult = await sb
    .from('projectors')
    .select('*')
    .eq('active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (projectorResult.error) {
    console.error(
      'projectors load error',
      projectorResult.error
    );

    toast(
      'Errore proiettore: ' +
      projectorResult.error.message
    );

    return;
  }

  projector = projectorResult.data;


  if (!projector) {
    toast(
      'Nessun proiettore configurato nel database.'
    );

    renderDashboard();
    return;
  }


  const sessionsResult = await sb
    .from('maintenance_sessions')
    .select(
      '*, user:profiles!maintenance_sessions_user_id_fkey(*), shutdown_user:profiles!maintenance_sessions_shutdown_user_id_fkey(*), claimed_user:profiles!maintenance_sessions_claimed_by_fkey(*)'
    )
    .eq(
      'projector_id',
      projector.id
    )
    .order(
      'powered_at',
      { ascending: false }
    )
    .limit(100);

  if (sessionsResult.error) {
    console.error(
      'sessions load error',
      sessionsResult.error
    );

    toast(
      'Errore storico: ' +
      sessionsResult.error.message
    );

    return;
  }

  rows = sessionsResult.data || [];

  render();
}


/* =========================
   RENDER PRINCIPALE
========================= */

function render() {
  if (!configured) {
    userArea.innerHTML =
      '<span class="pill warn">DEMO / DA CONFIGURARE</span>';

    renderSetup();
    return;
  }


  if (!user) {
    userArea.innerHTML = `
      <button class="login" id="login">
        Accedi
      </button>
    `;

    app.innerHTML = `
      <section class="welcome">

        <img src="icons/icon-192.png">

        <h1>
          Projector Control
        </h1>

        <p>
          Gestione condivisa delle accensioni del proiettore.
        </p>

        <button
          class="primary"
          id="login2"
          type="button"
        >
          ACCEDI
        </button>

        <button
          class="secondary"
          id="signup"
          type="button"
        >
          CREA ACCOUNT
        </button>

      </section>
    `;

    document.querySelector('#login').onclick =
      loginModal;

    document.querySelector('#login2').onclick =
      loginModal;

    document.querySelector('#signup').onclick =
      signupModal;

    return;
  }


  userArea.innerHTML = `
    <span class="pill">
      ${esc(name(profile))}
    </span>

    <button
      class="login"
      id="logout"
      type="button"
    >
      Esci
    </button>
  `;

  document.querySelector('#logout').onclick =
    async () => {
      await sb.auth.signOut();
      location.reload();
    };


  renderDashboard();
}


/* =========================
   SETUP
========================= */

function renderSetup() {
  app.innerHTML = `
    <section class="welcome">

      <img src="icons/icon-192.png">

      <h1>
        Cinema Projector Control
      </h1>

      <p>
        L'app è pronta.
        Devi solo collegarla a Supabase.
      </p>

      <div class="setup">
        Apri <b>README.md</b>:
        inserisci URL e anon key in
        <b>app.js</b>,
        esegui <b>supabase/schema.sql</b>,
        poi pubblica su GitHub Pages.
      </div>

    </section>
  `;
}


/* =========================
   DASHBOARD
========================= */

function renderDashboard() {
  const currentStatus = status();
  const last = rows[0];
  const open = getOpenSession();

  let nextDate = null;

  if (last && projector) {
    nextDate = new Date(last.powered_at);

    nextDate.setDate(
      nextDate.getDate() +
      projector.interval_days
    );
  }


  const today = new Date();

  today.setHours(0, 0, 0, 0);


  const overdue =
    nextDate &&
    today >= new Date(
      nextDate.getFullYear(),
      nextDate.getMonth(),
      nextDate.getDate()
    );


  const title =
    open
      ? 'QUALCUNO DEVE SPEGNERE'
      : !last
        ? 'PRIMA ACCENSIONE'
        : overdue
          ? 'ACCENSIONE DA ESEGUIRE'
          : 'TUTTO OK';


  const sub =
    open
      ? `${name(open.user)} ha acceso il proiettore il ${fmt(open.powered_at)}.`
      : overdue
        ? 'Accendere il proiettore prima possibile.'
        : last
          ? 'Il proiettore è in regola.'
          : 'Nessuna accensione registrata.';


  const centralNumber =
    last && nextDate
      ? overdue
        ? 'ORA'
        : nextDate.toLocaleDateString(
            'it-IT',
            {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }
          )
      : '—';


  let statusIcon = '!';

  if (currentStatus === 'ok') {
    statusIcon = '✓';
  } else if (currentStatus === 'alert') {
    statusIcon = '⚠';
  }


  app.innerHTML = `
    <section class="status ${currentStatus}">

      <div class="statusIcon">
        ${statusIcon}
      </div>

      <div>

        <small>
          STATO PROIETTORE
        </small>

        <h1>
          ${title}
        </h1>

        <p>
          ${esc(sub)}
        </p>

      </div>

    </section>


    ${
      open
        ? `
          <section class="alert">

            <div>

              <b>
                🔴 Proiettore acceso
              </b>

              <p>
                Registrato da
                <b>
                  ${esc(name(open.user))}
                </b>
                · ${fmt(open.powered_at)}
              </p>

              ${
                open.state === 'ACCESO'
                  ? `
                    <small>
                      Il proiettore è ancora acceso.
                    </small>
                  `
                  : open.state === 'LASCIATO_ACCESO'
                    ? `
                      <small>
                        ⚠️ Nessuno ha ancora preso in carico lo spegnimento.
                      </small>
                    `
                    : `
                      <small>
                        In carico a
                        ${esc(name(open.claimed_user))}
                      </small>
                    `
              }

            </div>


            <div>

              ${
                open.state === 'ACCESO' &&
                open.user_id === user.id
                  ? `
                    <button
                      class="primary"
                      id="shutdown"
                      type="button"
                    >
                      ✓ HO SPENTO
                    </button>

                    <button
                      class="danger"
                      id="leaveOn"
                      type="button"
                    >
                      ⚠ NON HO SPENTO, VADA QUALCUNO
                    </button>
                  `
                  : ''
              }


              ${
                open.state === 'LASCIATO_ACCESO' &&
                !open.claimed_by
                  ? `
                    <button
                      class="secondary"
                      id="claim"
                      type="button"
                    >
                      🙋 VADO IO
                    </button>
                  `
                  : ''
              }


              ${
                open.state === 'IN_CARICO' &&
                open.claimed_by === user.id
                  ? `
                    <button
                      class="danger"
                      id="shutdown"
                      type="button"
                    >
                      ✓ HO SPENTO
                    </button>
                  `
                  : ''
              }

            </div>

          </section>
        `
        : ''
    }


    <div class="grid">

      <section class="card center">

        <small>
          ${esc(projector?.name || 'Proiettore Cinema')}
        </small>

        <div
          class="muted"
          style="
            font-size:1rem;
            font-weight:700;
            margin-top:12px;
          "
        >
          PROSSIMA ACCENSIONE
        </div>

        <div class="number">
          ${centralNumber}
        </div>

        <div class="muted">

          ${
            last
              ? overdue
                ? '⚠ ACCENDERE PRIMA POSSIBILE'
                : 'Data prevista'
              : 'Nessuna accensione registrata'
          }

        </div>

        <button
          class="primary full"
          id="register"
          type="button"
        >
          ⚡ REGISTRA ACCENSIONE
        </button>

      </section>


      <section class="card stats">

        <div>

          <small>
            Ultima accensione
          </small>

          <b>
            ${fmt(last?.powered_at)}
          </b>

        </div>


        <div>

          <small>
            Eseguita da
          </small>

          <b>
            ${esc(name(last?.user))}
          </b>

        </div>


        <div>

          <small>
            Intervallo
          </small>

          <b>
            ${projector?.interval_days || 14} giorni
          </b>

        </div>


        <div>

          <small>
            Operazioni
          </small>

          <b>
            ${rows.length}
          </b>

        </div>

      </section>

    </div>


    <div class="actions">

      <button
        class="quick"
        id="history"
        type="button"
      >
        📋 <b>Storico</b>

        <span>
          Ultime operazioni
        </span>
      </button>


      ${
        profile?.role === 'admin'
          ? `
            <button
              class="quick"
              id="settings"
              type="button"
            >
              ⚙️ <b>Impostazioni</b>

              <span>
                Intervallo e proiettore
              </span>
            </button>
          `
          : ''
      }

    </div>
  `;


  document.querySelector('#register').onclick =
    registerModal;

  document.querySelector('#history').onclick =
    historyModal;

  document.querySelector('#claim')?.addEventListener(
    'click',
    claim
  );

  document.querySelector('#shutdown')?.addEventListener(
    'click',
    shutdown
  );

  document.querySelector('#leaveOn')?.addEventListener(
    'click',
    leaveOn
  );

  document.querySelector('#settings')?.addEventListener(
    'click',
    settingsModal
  );
}


/* =========================
   LOGIN
========================= */

function loginModal() {
  const m = modal(
    'Accedi',
    `
      <label>
        Email

        <input
          id="e"
          type="email"
        >
      </label>

      <label>
        Password

        <input
          id="p"
          type="password"
        >
      </label>

      <button
        class="primary full"
        id="go"
        type="button"
      >
        ACCEDI
      </button>
    `
  );


  m.querySelector('#go').onclick =
    async () => {

      const {
        error
      } = await sb.auth.signInWithPassword({
        email:
          m.querySelector('#e').value,

        password:
          m.querySelector('#p').value
      });


      if (error) {
        toast(error.message);
      } else {
        m.remove();
      }
    };
}


/* =========================
   REGISTRAZIONE ACCOUNT
========================= */

function signupModal() {
  const m = modal(
    'Crea account',
    `
      <label>
        Nome

        <input id="n">
      </label>

      <label>
        Cognome

        <input id="c">
      </label>

      <label>
        Email

        <input
          id="e"
          type="email"
        >
      </label>

      <label>
        Password

        <input
          id="p"
          type="password"
        >
      </label>

      <button
        class="primary full"
        id="go"
        type="button"
      >
        CREA ACCOUNT
      </button>
    `
  );


  m.querySelector('#go').onclick =
    async () => {

      const {
        data,
        error
      } = await sb.auth.signUp({
        email:
          m.querySelector('#e').value,

        password:
          m.querySelector('#p').value,

        options: {
          data: {
            first_name:
              m.querySelector('#n').value,

            last_name:
              m.querySelector('#c').value
          }
        }
      });


      if (error) {

        console.error(
          'signup error',
          error
        );

        toast(
          (error.code
            ? error.code + ': '
            : '') +
          error.message
        );

      } else {

        toast(
          data.session
            ? 'Account creato'
            : 'Controlla la mail per confermare l’account'
        );

        m.remove();
      }
    };
}


/* =========================
   REGISTRA ACCENSIONE
========================= */

function registerModal() {
  const m = modal(
    'Registra accensione',
    `
      <p class="note">
        Data e ora automatiche ·
        ${new Date().toLocaleString('it-IT')}
      </p>

      <label>
        <input
          id="server"
          type="checkbox"
        >
        Server cinema acceso
      </label>

      <label>
        Note

        <textarea
          id="notes"
          placeholder="Eventuali note…"
        ></textarea>
      </label>

      <button
        class="primary full"
        id="save"
        type="button"
      >
        CONFERMA ACCENSIONE
      </button>
    `
  );


  m.querySelector('#save').onclick =
    async () => {

      const {
        error
      } = await sb
        .from('maintenance_sessions')
        .insert({
          projector_id:
            projector.id,

          user_id:
            user.id,

          projector_on:
            true,

          server_on:
            m.querySelector('#server').checked,

          notes:
            m.querySelector('#notes').value || null,

          state:
            'ACCESO'
        });


      if (error) {

        console.error(
          'registration error',
          error
        );

        toast(error.message);

      } else {

        m.remove();

        await load();

        toast(
          '⚡ Accensione registrata'
        );
      }
    };
}


/* =========================
   LASCIA ACCESO
========================= */

async function leaveOn() {
  const row = rows.find(
    item => item.state === 'ACCESO'
  );

  if (!row) return;


  const {
    error
  } = await sb
    .from('maintenance_sessions')
    .update({
      state:
        'LASCIATO_ACCESO'
    })
    .eq('id', row.id)
    .eq('state', 'ACCESO');


  if (error) {

    toast(error.message);

  } else {

    await load();

    toast(
      '⚠️ Avviso condiviso: qualcuno deve spegnere'
    );
  }
}


/* =========================
   VADO IO
========================= */

async function claim() {
  const row = rows.find(
    item =>
      item.state === 'LASCIATO_ACCESO'
  );

  if (!row) return;


  const {
    error
  } = await sb
    .from('maintenance_sessions')
    .update({
      claimed_by:
        user.id,

      claimed_at:
        new Date().toISOString(),

      state:
        'IN_CARICO'
    })
    .eq('id', row.id)
    .eq('state', 'LASCIATO_ACCESO');


  if (error) {

    toast(error.message);

  } else {

    await load();

    toast(
      'Hai preso in carico lo spegnimento'
    );
  }
}


/* =========================
   HO SPENTO
========================= */

async function shutdown() {
  const row = rows.find(
    item =>
      item.state === 'ACCESO' ||
      item.state === 'LASCIATO_ACCESO' ||
      item.state === 'IN_CARICO'
  );

  if (!row) return;


  const {
    error
  } = await sb
    .from('maintenance_sessions')
    .update({
      shutdown_at:
        new Date().toISOString(),

      shutdown_user_id:
        user.id,

      state:
        'SPENTO'
    })
    .eq('id', row.id);


  if (error) {

    toast(error.message);

  } else {

    await load();

    toast(
      '✓ Spegnimento registrato'
    );
  }
}


/* =========================
   STORICO
========================= */

function historyModal() {
  modal(
    'Storico',
    `
      <div class="history">

        ${
          rows.length
            ? rows.map(row => `
                <div class="row">

                  <b>
                    ${fmt(row.powered_at)}
                  </b>

                  <span>
                    ${esc(name(row.user))}
                  </span>

                  <small>

                    ${
                      row.state === 'ACCESO'
                        ? '🔴 Proiettore acceso'
                        : row.state === 'COMPLETATA'
                          ? '✓ Completata'
                          : row.state === 'SPENTO'
                            ? '✓ Spento'
                            : row.state === 'IN_CARICO'
                              ? '🙋 In carico'
                              : '⚠ Lasciato acceso'
                    }

                    · Proiettore ✓

                    · Server
                    ${row.server_on ? '✓' : '—'}

                    ${
                      row.shutdown_user
                        ? ' · Spento da ' +
                          esc(name(row.shutdown_user))
                        : ''
                    }

                  </small>

                </div>
              `).join('')
            : 'Nessuna operazione.'
        }

      </div>
    `
  );
}


/* =========================
   IMPOSTAZIONI ADMIN
========================= */

function settingsModal() {
  const m = modal(
    'Impostazioni',
    `
      <label>
        Nome proiettore

        <input
          id="n"
          value="${esc(projector.name)}"
        >
      </label>

      <label>
        Intervallo (giorni)

        <input
          id="d"
          type="number"
          min="1"
          max="365"
          value="${projector.interval_days}"
        >
      </label>

      <button
        class="primary full"
        id="save"
        type="button"
      >
        SALVA
      </button>
    `
  );


  m.querySelector('#save').onclick =
    async () => {

      const {
        error
      } = await sb
        .from('projectors')
        .update({
          name:
            m.querySelector('#n').value,

          interval_days:
            Number(
              m.querySelector('#d').value
            )
        })
        .eq(
          'id',
          projector.id
        );


      if (error) {

        toast(error.message);

      } else {

        m.remove();

        await load();

        toast(
          'Impostazioni salvate'
        );
      }
    };
}


/* =========================
   REALTIME
========================= */

function subscribeRealtime() {
  if (!sb) return;


  if (realtimeChannel) {
    sb.removeChannel(
      realtimeChannel
    );
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


/* =========================
   SERVICE WORKER
========================= */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js')
    .catch(() => {});
}


/* =========================
   AVVIO APP
========================= */

if (sb) {

  sb.auth
    .getSession()
    .then(({ data }) => {

      user =
        data.session?.user ||
        null;

      load();

      subscribeRealtime();
    });


  sb.auth.onAuthStateChange(
    (_event, session) => {

      user =
        session?.user ||
        null;

      load();

      subscribeRealtime();
    }
  );

} else {

  render();
}
```
