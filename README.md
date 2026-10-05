# 🎬 Cinema Projector Keep Alive
PWA condivisa per il proiettore del Cinema Sotto le Stelle.

**Stack:** HTML/CSS/JavaScript + Supabase. Nessun build step e nessun framework: il progetto può essere pubblicato direttamente con GitHub Pages.

## Configurazione
1. Crea un progetto Supabase.
2. Esegui `supabase/schema.sql` nel SQL Editor.
3. Apri `app.js` e sostituisci `SUPABASE_URL` e `SUPABASE_ANON_KEY` con quelli del progetto Supabase. Usa solo la chiave `anon` pubblica, MAI `service_role`.
4. Carica il repository su GitHub e abilita GitHub Pages.
5. Apri il link dal telefono e installa la PWA.

## Primo amministratore
Dopo aver creato il primo account, nel pannello Supabase modifica il suo record in `profiles` impostando `role = 'admin'`.

## Funzioni
- login/registrazione
- dashboard condivisa
- intervallo configurabile
- registrazione proiettore/server/lampada
- avviso "qualcuno deve spegnere"
- presa in carico "VADO IO"
- conferma "PROIETTORE SPENTO"
- storico
- aggiornamento realtime tra utenti
- PWA installabile

Le notifiche push vere e proprie anche con browser completamente chiuso sono lasciate come estensione successiva; l'avviso condiviso è già realtime nel database.
