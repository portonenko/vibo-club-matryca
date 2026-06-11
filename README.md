# vibo.club — Matryca Losu

Strona kalkulatora Matrycy Losu (PL/EN/DE) + sklep z raportami PDF.
Live: **https://vibo.club** · Hosting: **Netlify** (projekt `vibo-club-matryca`).

To repozytorium zawiera **gotowy front-end i przyjmowanie płatności**. Część
„konto + realizacja zamówienia (PDF)” jest świadomie zostawiona do dokończenia
przez programistę — patrz **TODO (backend)** niżej.

---

## Struktura

```
site/                      # to, co jest publikowane (publish dir w Netlify)
  index.html               # cała aplikacja (HTML + CSS + JS w jednym pliku)
  legal.js                 # Polityka prywatności + Regulamin (PL/EN/DE)
  energy-forecast.js       # „Energia dnia” — prognozy 22 arkanów × 3 warianty (PL/EN/DE)
  texts.js                 # teksty interpretacji matrycy (ładowane leniwie)
  fonts/  reviews/  hero.png
  robots.txt  sitemap.xml  _headers
  google…html              # weryfikacja Google Search Console — NIE usuwać
netlify/functions/
  create-checkout.js       # tworzy sesję Stripe Checkout (ceny po stronie serwera)
netlify.toml               # publish = "site", functions = "netlify/functions"
package.json               # (funkcja nie używa już SDK Stripe — czysty fetch)
```

`index.html` jest jednoplikową aplikacją: i18n w obiekcie `I18N` (pl/en/de),
silnik matrycy 1:1 z aplikacji ViboClub, przełączanie widoków przez `showView()`.

## Uruchomienie / deploy

- Lokalnie: `netlify dev` (albo dowolny serwer statyczny na katalogu `site/`).
- Deploy: ze względu na bug konta Netlify `netlify deploy --prod` zwraca
  `Forbidden`. Działa obejście: `netlify deploy --dir site` (draft) → potem
  `netlify api restoreSiteDeploy --data '{"site_id":"<id>","deploy_id":"<id>"}'`.

## Zmienne środowiskowe (Netlify)

- `STRIPE_SECRET_KEY` — restricted live key Stripe (uprawnienia: Checkout
  Sessions write). **Tylko w Netlify env, nigdy w kodzie.**

## Ceny i produkty

Definiowane **po stronie serwera** w `netlify/functions/create-checkout.js`
(klient nie może podmienić kwoty). Produkty: `full` 55, `child` 45, `compat` 45,
`month` 25, `star` 33 zł. Add-ony liczone po cenie zniżkowej (`ADDON`), oprócz
`star` (zawsze 33). Front-endowe kwoty do wyświetlania: `PNUM` / `PNUM_ADDON`
w `index.html` — **muszą zgadzać się z serwerem**.

Płatność: przycisk „Kup” → ekran rejestracji + zamówienia (`#view-checkout`) →
`create-checkout` tworzy sesję Stripe (możliwe wiele pozycji + ilości) →
przekierowanie na Stripe → powrót na `/?paid=1` (ekran „dziękujemy”).

Dane zamówienia (osoby: imię/płeć/data, ilości) trafiają do **metadanych sesji
Stripe** (`metadata.people`, `metadata.people2`, `metadata.types`).

---

## TODO (backend) — do zrobienia przez programistę

1. **Konta użytkowników / logowanie.** Formularz rejestracji (`#view-checkout`:
   imię, e-mail, hasło) jest na razie tylko wizualny + walidacja po stronie
   przeglądarki. Trzeba podłączyć prawdziwą autoryzację (proponowane: Supabase
   Auth) i zapis zamówień do profilu. Widok konta (`#view-account`) pokazuje
   dane demonstracyjne.
2. **Generowanie i dostarczanie raportów PDF.** Po płatności PDF NIE jest
   tworzony ani wysyłany. Po opłacie wszystkie dane są w metadanych sesji Stripe
   (typy produktów + lista osób z datami + e-mail). Trzeba: webhook Stripe →
   wygenerować PDF dla każdej matrycy/osoby → wysłać na e-mail / udostępnić w
   koncie. Ekran sukcesu na razie tylko informuje „wyślemy na e-mail”.
3. **Powiązanie zamówienia z kontem** (po zalogowaniu) i historia w profilu.
4. **Treści produktów do uzupełnienia:** „Gwiazda Szczęścia” i „Prognoza na
   miesiąc” mają tymczasowe opisy/realizację; „Matryca Marki Osobistej” jest
   oferowana jako bonus do pełnej matrycy.
5. **Webhook + księgowanie** (faktury) wg potrzeb.

Kontakt do właściciela: info@vibo.club
