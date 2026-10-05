# Installazione rapida

## 1. Supabase
Crea un progetto gratuito su Supabase e apri **SQL Editor**. Incolla ed esegui `supabase/schema.sql`.

## 2. Collega l'app
Apri `app.js` e sostituisci:

`INSERISCI_QUI_SUPABASE_URL`

`INSERISCI_QUI_SUPABASE_ANON_KEY`

con URL e **anon/public key** del tuo progetto. Non inserire mai la `service_role` key.

## 3. Primo account
Apri l'app, scegli CREA ACCOUNT e crea il primo utente. Nel Table Editor di Supabase apri `profiles` e imposta per quell'utente `role = admin`.

## 4. GitHub Pages
Crea un repository GitHub e carica tutti i file di questa cartella. Vai in **Settings → Pages → Deploy from a branch → main / root**. Dopo la pubblicazione apri il link HTTPS dal telefono.

## 5. Installazione sui telefoni
Android: Chrome → ⋮ → Installa app / Aggiungi alla schermata Home.

iPhone: Safari → Condividi → Aggiungi alla schermata Home.

## 6. Dati condivisi
Tutti gli utenti accedono allo stesso database Supabase. L'app aggiorna lo storico tramite Realtime quando una persona registra un'accensione, prende in carico uno spegnimento o lo conclude.

## 7. Push notification
Questa versione implementa l'avviso condiviso realtime. Le push vere anche con browser completamente chiuso possono essere aggiunte successivamente con Web Push + Supabase Edge Function/VAPID.
