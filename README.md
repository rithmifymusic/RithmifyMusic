# Rythmify

Namizni Electron predvajalnik. Iskanje uporablja neuradni YouTube Music InnerTube endpoint, predvajanje pa YouTube vdelani predvajalnik; podprte so tudi lastne zvočne datoteke. Neuradni endpointi nimajo zagotovljene razpoložljivosti ali neomejene kvote. Aplikacija ne prenaša zvočnih datotek z YouTuba.

Zavihek **Slovenske postaje** predvaja 43 slovenskih spletnih radijskih tokov, s filtri za FM, DAB in zvrstmi. Seznam, frekvence, tokovi in PNG-logotipi so povzeti po [SIradio.si](https://siradio.si/); uradni seznam DAB-programov je na [dab.si](https://dab.si/programi). Aplikacija predvaja internetne tokove, ne sprejema radijskega signala. Programi DAB brez javnega spletnega toka zato niso predvajani v aplikaciji.

Zavihek **Podcasti** išče oddaje v javnem katalogu Apple Podcasts ter bere epizode iz RSS-virov izdajateljev. Ustvarjalcem podcastov in YouTube kanalom lahko slediš; oddaje in najdeni videi se shranijo v uporabnikov profil ter prikažejo pod ustvarjalcem. Ponuja tudi samodejna YouTube priporočila; videoposnetki se predvajajo v vdelanem YouTube predvajalniku. Zvok in videoposnetki se ne prenašajo za poslušanje brez povezave.

Zagon: npm start

## Namestitveni program in samodejne posodobitve

Lokalni Windows namestitveni program zgradiš z `npm run dist`; datoteke se ustvarijo v mapi `dist/`. Objave, označene z Gitovo oznako `v*`, sprožijo potek dela `.github/workflows/release.yml`, ki ustvari GitHub Release in priloži namestitveni program ter datoteke za posodabljanje.

Javni repozitorij `rithmifymusic/RithmifyMusic` vsebuje izvorno kodo in objavljene izdaje. Potek dela ob oznaki `v*` ustvari Windows namestitveni program in ga objavi kot GitHub Release z updater metapodatki. Uporablja GitHubov kratkotrajni `GITHUB_TOKEN`; osebnega dostopnega žetona ni treba ustvarjati ali vgrajevati v aplikacijo.

Za novo različico zvišaj `version` v `package.json`, spremembo objavi v zasebnem izvornem repozitoriju, nato ustvari in potisni ustrezno Gitovo oznako, na primer `v1.2.3`. Nameščena aplikacija preverja objavljene izdaje in prenese posodobitev v ozadju; namesti jo po potrditvi ponovnega zagona.

## Rythmify server (Railway)

`server/server.js` in `server/jam.js` sta en servis: isti HTTP strežnik obravnava račune, prijatelje, skupne sezname in ponastavitev gesla, Socket.IO pa Jam. Prijatelje lahko gostitelj povabi v aktivni Jam; povabljenemu se v aplikaciji prikaže popup za sprejem ali zavrnitev, povabilo pa poteče po petih minutah. Ročne povabilne povezave `/j/<koda>` in `/join?room=<koda>` uporabljajo isti javni URL. Zaklenjene odvisnosti so v `server/package-lock.json`.

Na Railwayu poveži javni repozitorij `rithmifymusic/RithmifyMusic`, nastavi **Root Directory** storitve na `/server` in ji dodaj PostgreSQL v istem projektu. V storitvi nastavi `DATABASE_URL` na Railwayjev zasebni sklic `${{Postgres.DATABASE_URL}}` in `JAM_PUBLIC_URL` na njen javni HTTPS naslov, na primer `https://rithmifymusic.up.railway.app`. Railway sam posreduje `PORT`.

Po objavi preveri `https://<javni-url-storitve>/health`; uspešen odgovor potrdi API, podatkovno bazo in Jam. Za e-pošto za ponastavitev gesla nastavi `RESEND_API_KEY` in preverjen naslov pošiljatelja `MAIL_FROM`, ali pa uporabi nastavitve SMTP iz `server/.env.example`. Skrivnosti hrani samo v nastavitvah storitve, nikoli v repozitoriju.

Jam sobe so med delovanjem v pomnilniku; po ponovnem zagonu ali ustavitvi servisa se aktivni Jami končajo. Railway PostgreSQL povezavo aplikacije nastavi na zasebni naslov, za lokalni uvoz ali administracijo pa uporabi javno povezavo in jo po uporabi zamenjaj.

## Premium naročnine (Stripe)

Strežnik potrjuje Premium prek Stripe webhookov; stanje Premiuma se ne sprejema iz odjemalca. Namizna aplikacija trenutno ponuja šifriran offline uvoz zvočnih datotek, ki jih uporabnik ima pravico uporabljati. Datoteke so šifrirane z AES-256-GCM, ključ pa zaščiti Windows varna shramba. Ta funkcija ne prenaša glasbe z YouTuba in šifriranje samo po sebi ni DRM ali zaščita pred spreminjanjem odjemalca.

1. V Stripe ustvari naročniški izdelek in ponavljajočo se ceno; v okolju strežnika nastavi njen ID kot `STRIPE_PRICE_ID`.
2. Nastavi `STRIPE_SECRET_KEY` in `STRIPE_WEBHOOK_SECRET`. Nastavi tudi `STRIPE_SUCCESS_URL` na `https://<javni-url-storitve>/billing/success` ter `STRIPE_CANCEL_URL` na `https://<javni-url-storitve>/billing/cancel`. Po želji nastavi `STRIPE_RETURN_URL` za vrnitev iz Stripe portala.
3. V Stripe dodaj webhook na `https://<javni-url-storitve>/api/billing/stripe-webhook` in omogoči dogodke `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` in `invoice.payment_failed`.
4. Za upravljanje oziroma preklic naročnin v Stripe omogoči Customer Portal. Po plačilu se vrni v aplikacijo in v profilu izberi **Osveži stanje**.

Plačila ostanejo izklopljena, dokler zgornje Stripe nastavitve niso dodane na strežnik. Ključev Stripe ne dodajaj v repozitorij. Mobilno predvajanje v ozadju zahteva ločeno mobilno aplikacijo; trenutni projekt je namizna Electron aplikacija.
