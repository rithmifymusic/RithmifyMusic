# Rythmify

Namizni Electron predvajalnik. Iskanje uporablja neuradni YouTube Music InnerTube endpoint, predvajanje pa YouTube vdelani predvajalnik; podprte so tudi lastne zvocne datoteke. Neuradni endpointi nimajo zagotovljene razpoložljivosti ali neomejene kvote. Aplikacija ne prenaša zvocnih datotek z YouTuba.

Zavihek **Slovenske postaje** predvaja 48 slovenskih spletnih radijskih tokov, s filtri za FM, DAB in zvrstmi. Seznam, frekvence, tokovi in PNG-logotipi so povzeti po [SIradio.si](https://siradio.si/); uradni seznam DAB-programov je na [dab.si](https://dab.si/programi). Aplikacija predvaja internetne tokove, ne sprejema radijskega signala. Programi DAB brez javnega spletnega toka zato niso predvajani v aplikaciji.

Zagon: npm start

## Namestitveni program in samodejne posodobitve

Lokalni Windows namestitveni program zgradiš z `npm run dist`; datoteke se ustvarijo v mapi `dist/`. Objave, oznacene z Gitovo oznako `v*`, sprožijo potek dela `.github/workflows/release.yml`, ki ustvari GitHub Release in priloži namestitveni program ter datoteke za posodabljanje.

Javni repozitorij `rithmifymusic/RithmifyMusic` vsebuje izvorno kodo in objavljene izdaje. Potek dela ob oznaki `v*` ustvari Windows namestitveni program in ga objavi kot GitHub Release z updater metapodatki. Uporablja GitHubov kratkotrajni `GITHUB_TOKEN`; osebnega dostopnega žetona ni treba ustvarjati ali vgrajevati v aplikacijo.

Za novo razlicico zvišaj `version` v `package.json`, spremembo objavi v zasebnem izvornem repozitoriju, nato ustvari in potisni ustrezno Gitovo oznako, na primer `v0.1.2`. Namešcena aplikacija preverja objavljene izdaje in prenese posodobitev v ozadju; namesti jo po potrditvi ponovnega zagona.

## Rythmify server (Render)

`server/server.js` in `server/jam.js` sta en servis: isti HTTP strežnik obravnava racune, prijatelje, skupne sezname in ponastavitev gesla, Socket.IO pa Jam. Jam povabilne povezave `/j/<koda>` in `/join?room=<koda>` uporabljajo isti javni URL. Render Blueprint je v `render.yaml`; zaklenjene odvisnosti so v `server/package-lock.json`.

Za objavo na GitHub naloži **celoten projekt**, vkljucno z `render.yaml` in mapo `server/` (ne samo vsebine mape `server/`). Repozitorij naj bo zaseben. Datoteka `.gitignore` izkljuci lokalne `.env` datoteke; `server/.env.example` vsebuje samo imena nastavitev in prazne nadomestne vrednosti.

1. Na Renderju poveži GitHub repozitorij kot Blueprint in uporabi `render.yaml`.
2. Ustvari ali izberi trajno PostgreSQL podatkovno bazo ter njen interni naslov nastavi kot `DATABASE_URL`. Blueprint baze ne ustvari samodejno. Za racune, ki jih želiš obdržati, ne uporabljaj zacasne brezplacne baze.
3. Za e-pošto za ponastavitev gesla nastavi `RESEND_API_KEY` in preverjen naslov pošiljatelja `MAIL_FROM` v okolju Render servisa. Lahko uporabiš tudi SMTP nastavitve `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` in `SMTP_PASS`; brezplacni Render web servisi lahko blokirajo odhodni SMTP.
4. Render sam nastavi `RENDER_EXTERNAL_URL`, ki ga Jam uporabi za povabilne povezave. `JAM_PUBLIC_URL` nastavi samo, ce želiš uporabiti drugo javno domeno.
5. Po objavi preveri `https://<javni-url-storitve>/health`; uspešen odgovor potrdi API, podatkovno bazo in Jam. Namizna aplikacija uporablja vgrajeni URL `https://rithmify-server.onrender.com` brez rocne nastavitve. Ce Renderjev naslov pozneje spremeniš, posodobi `DEFAULT_ACCOUNT_API_URL` v `renderer/gmajna.js` in `main.js`, nato objavi novo razlicico aplikacije.

Jam sobe so med delovanjem v pomnilniku; po ponovnem zagonu ali ustavitvi Render servisa se aktivni Jami koncajo. Renderov brezplacni spletni servis se lahko po neaktivnosti ustavi, zato je lahko prvi odziv pocasen. Pred izbiro placljivega paketa preveri cene. Gesel podatkovne baze, poštnih API-kljucev in SMTP gesel ne dodajaj v GitHub.

## Premium narocnine (Stripe)

Strežnik potrjuje Premium prek Stripe webhookov; stanje Premiuma se ne sprejema iz odjemalca. Namizna aplikacija trenutno ponuja šifriran offline uvoz zvocnih datotek, ki jih uporabnik ima pravico uporabljati. Datoteke so šifrirane z AES-256-GCM, kljuc pa zašciti Windows varna shramba. Ta funkcija ne prenaša glasbe z YouTuba in šifriranje samo po sebi ni DRM ali zašcita pred spreminjanjem odjemalca.

1. V Stripe ustvari narocniški izdelek in ponavljajoco se ceno; v Render nastavi njen ID kot `STRIPE_PRICE_ID`.
2. V okolju Render nastavi `STRIPE_SECRET_KEY` in `STRIPE_WEBHOOK_SECRET`. Nastavi tudi `STRIPE_SUCCESS_URL` na `https://<javni-url-storitve>/billing/success` ter `STRIPE_CANCEL_URL` na `https://<javni-url-storitve>/billing/cancel`. Po želji nastavi `STRIPE_RETURN_URL` za vrnitev iz Stripe portala.
3. V Stripe dodaj webhook na `https://<javni-url-storitve>/api/billing/stripe-webhook` in omogoci dogodke `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` in `invoice.payment_failed`.
4. Za upravljanje oziroma preklic narocnin v Stripe omogoci Customer Portal. Po placilu se vrni v aplikacijo in v profilu izberi **Osveži stanje**.

Placila ostanejo izklopljena, dokler zgornje Stripe nastavitve niso dodane na strežnik. Kljucev Stripe ne dodajaj v repozitorij. Mobilno predvajanje v ozadju zahteva loceno mobilno aplikacijo; trenutni projekt je namizna Electron aplikacija.

Renderov brezplacni spletni servis se lahko po neaktivnosti ustavi, zato je lahko prvi odziv pocasen. Pred izbiro placljivega paketa preveri cene. Gesel podatkovne baze, poštnih API-kljucev in SMTP gesel ne dodajaj v GitHub.
