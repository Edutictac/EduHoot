# Funcionalitats populars per a EduHoot

## Índex

- [Introducció](#introducció)
- [Lectura d'este resum](#lectura-deste-resum)
- [Llegenda](#llegenda)
- [Criteri pedagògic](#criteri-pedagògic)
- [Llistat de propostes](#llistat-de-propostes)
  - [Notes de la taula](#notes-de-la-taula)
- [Descripció detallada de cada proposta](#descripció-detallada-de-cada-proposta)
- [Resum per origen](#resum-per-origen)
- [Resum per dificultat](#resum-per-dificultat)
- [Full de ruta d'implementació](#full-de-ruta-dimplementació)
  - [Troballes que condicionen l'orde](#troballes-que-condicionen-lorde)
  - [Fase 0 — Habilitadors (requisits, no una recomanació)](#fase-0--habilitadors-requisits-no-una-recomanació)
  - [Fase 1a — Millores cosmètiques/aïllades, sense tocar la lògica de joc](#fase-1a--millores-cosmètiquesaïllades-sense-tocar-la-lògica-de-joc)
  - [Fase 1b — Mecàniques de Solo/amfitrió, sense tocar l'arquitectura del cicle de partida](#fase-1b--mecàniques-de-soloamfitrió-sense-tocar-larquitectura-del-cicle-de-partida)
  - [Fase 2 — Mecàniques de joc de major abast, però autocontingudes](#fase-2--mecàniques-de-joc-de-major-abast-però-autocontingudes)
  - [Fase 3 — Canvi d'arquitectura del cicle de partida](#fase-3--canvi-darquitectura-del-cicle-de-partida)
  - [Fase 4 — Integracions externes o de baixa prioritat per escala](#fase-4--integracions-externes-o-de-baixa-prioritat-per-escala)
  - [Aparcades](#aparcades)
  - [Descartades](#descartades)

## Introducció

Llistat unificat a partir d'una anàlisi de 20 propostes inspirades en
Kahoot i 20 propostes inspirades en Wayground, fusionant les que
representen la mateixa idea de fons encara que cada plataforma li done un
matís distint (p. ex. "mode equips" en Kahoot i "mode equips amb relay" en
Wayground es compten com una sola proposta). Resultat: **31 propostes
úniques** (de les 40 originals, 9 parelles es van fusionar en 9 propostes
"Ambdues"), més la **proposta 32**, afegida després en separar de la 15 la
part que crida a un proveïdor d'IA extern (vore nota 5 de la taula).

## Lectura d'este resum

Kahoot i Wayground són les dos plataformes educatives més usades del
sector: la seua popularitat és un senyal fiable de quines funcionalitats
valora de veritat el professorat i l'alumnat. Però eixa popularitat no
basta per si sola: el criteri pedagògic és el que decidix finalment si
una proposta avança, s'aparca o es descarta, per damunt de lo popular que
siga en Kahoot/Wayground.

De les 9 propostes marcades com «Ambdues»: 5 (avatars) queda aparcada; 18
i 22 queden descartades per protecció de dades; 4 (power-ups) continua
avant amb l'abast reduït (sense "robar punts"); i 1, 6, 7, 13 i 20 queden
confirmades com a prioritat alta, combinant popularitat i valor pedagògic.

## Llegenda

**Origen:**
- 🟨 Kahoot — identificada només en l'anàlisi de Kahoot.
- 🟦 Wayground — identificada només en l'anàlisi de Wayground.
- 🟩 Ambdues — identificada en les dos anàlisis i fusionada en una sola entrada.
- ➕ Nova — afegida després, no prové de la comparativa Kahoot/Wayground original.

**Dificultat tècnica:** 🟢 Baixa / 🟡 Mitjana / 🔴 Alta.

**Criteri pedagògic** (vore més avall com s'aplica):
- Aprenentatge: 📚 Alt · ➖ Neutre · ✖️ Cap
- Clima d'aula: 🙂 Segur · ⚠️ Risc
- Inclusió: 🤝 Alta · ➖ Neutra · 🚧 Baixa
- Context supervisat: ✅ Encaixa · 🚫 No encaixa

**Itinerari:** Fase 1a, 1b, 2, 3 o 4 del [full de ruta](#full-de-ruta-dimplementació), 📦
Aparcada (no es descarta, queda disponible per a revisar en el futur), o
❌ Descartada (decisió de producte, no es retomarà).

## Criteri pedagògic

La popularitat en Kahoot/Wayground és un senyal del que agrada, no del que
aporta a l'aula. Per això cada proposta es valora també en els 4 eixos
d'ací dalt, independents de la popularitat i de la dificultat tècnica.

**Regla de decisió:**
- ⚠️ Risc en clima, o 🚫 No encaixa en context → es descarta (o es
  reduïx l'abast per a llevar justament la part arriscada).
- ✖️ Cap en aprenentatge i ➖ Neutra en inclusió, sense risc en els altres
  eixos → no és urgent: s'aparca.
- 📚 Alt en aprenentatge o 🤝 Alta en inclusió, sense risc → prioritat
  alta, amb independència de la popularitat en Kahoot/Wayground.

Este criteri és independent de la fase tècnica del full de ruta: una
proposta pot tindre un valor pedagògic alt i continuar en una fase tardana
si depén de treball tècnic previ (p. ex. la proposta 1, que depén de la
3). Algunes decisions d'aparcar/descartar van més enllà del que suggerix
la regla mecànica (p. ex. la 28): queden igualment recollides com a
decisió de producte.

## Llistat de propostes

| # | Proposta | Origen | Dificultat | 📚 Aprenentatge | 🙂 Clima | 🤝 Inclusió | ✅ Context | Itinerari |
|---|---|---|---|---|---|---|---|---|
| 1 | Deures asíncrons amb data límit | 🟩 | 🔴 | 📚 Alt | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 3 |
| 2 | Podi final amb confeti | 🟨 | 🟡 | ✖️ Cap | 🙂 Segur | ➖ Neutra | ✅ Encaixa | 📦 Aparcada |
| 3 | Mode autoritme (self-paced) | 🟦 | 🔴 | 📚 Alt | 🙂 Segur | 🤝 Alta | ✅ Encaixa | Fase 3 |
| 4 | Power-ups (doble puntuació, 50/50, congelar ratxa) | 🟩 | 🔴 | ➖ Neutre | 🙂 Segur¹ | ➖ Neutra | ✅ Encaixa | Fase 2 |
| 5 | Avatars de personatge personalitzables | 🟩 | 🟡 | ✖️ Cap | 🙂 Segur | ➖ Neutra | ✅ Encaixa | 📦 Aparcada |
| 6 | Mode equips, amb variant "relay" | 🟩 | 🔴 | 📚 Alt | ⚠️ Risc lleu² | 🤝 Alta | ✅ Encaixa | Fase 2 |
| 7 | Tipus de pregunta: ordenar i emparellar | 🟩 | 🔴 | 📚 Alt | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 2 |
| 8 | Memes i GIF com a feedback | 🟦 | 🟡 | ✖️ Cap | 🙂 Segur | ➖ Neutra | ✅ Encaixa | 📦 Aparcada |
| 9 | Música/so de tensió per fases | 🟨 | 🟡 | ✖️ Cap | 🙂 Segur | ➖ Neutra | ✅ Encaixa | 📦 Aparcada |
| 10 | Modes de joc immersius tipus arcade | 🟦 | 🔴 | ➖ Neutre | ⚠️ Risc³ | 🚧 Baixa | ✅ Encaixa | Fase 4 |
| 11 | Ratxa d'encerts consecutius | 🟨 | 🟢/🟡 | ➖ Neutre | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 1b |
| 12 | Generador de sobrenoms aleatoris | 🟨 | 🟢 | ✖️ Cap⁴ | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 1a |
| 13 | Lectura en veu alta (TTS) | 🟩 | 🟢 | ➖ Neutre | 🙂 Segur | 🤝 Alta | ✅ Encaixa | Fase 1a |
| 14 | So de feedback individual | 🟨 | 🟢 | ✖️ Cap | 🙂 Segur | ➖ Neutra | ✅ Encaixa | 📦 Aparcada |
| 15 | Ampliar la importació: GIFT, JSON, XML de Moodle i la resta de formats de Moodle/AULES⁵ | 🟦 | 🟡 | ➖ Neutre | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 1a |
| 16 | Reaccions en directe (emoji) | 🟨 | 🟡 | ✖️ Cap | ⚠️ Risc | ➖ Neutra | ✅ Encaixa | 📦 Aparcada |
| 17 | Tipus de pregunta addicionals | 🟦 | 🔴 | 📚 Alt | 🙂 Segur | 🤝 Alta | ✅ Encaixa | Fase 2 |
| 18 | Informe de progrés històric | 🟩 | 🔴 | 📚 Alt⁶ | 🙂 Segur | ➖ Neutra | ✅ Encaixa | ❌ Descartada |
| 19 | Lliçons interactives | 🟦 | 🔴 | 📚 Alt | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 4 |
| 20 | Mode d'estudi "Flashcards" | 🟩 | 🟡 | 📚 Alt | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 1a |
| 21 | Integració amb Google Classroom | 🟦 | 🔴 | ➖ Neutre | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 4 |
| 22 | Insígnies i nivells persistents | 🟩 | 🔴 | 📚 Alt⁶ | 🙂 Segur | ➖ Neutra | ✅ Encaixa | ❌ Descartada |
| 23 | Compte arrere "¡Prepara't!" 3-2-1 | 🟨 | 🟢 | ✖️ Cap | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 1a⁷ |
| 24 | Vídeos "aprén i després respon" | 🟦 | 🟡 | 📚 Alt | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 1b |
| 25 | Pràctica adaptativa (repetir fallades) | 🟦 | 🟡 | 📚 Alt | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 1b |
| 26 | Mode "fantasma"/millor marca personal | 🟨 | 🟡 | ➖ Neutre⁸ | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 1b |
| 27 | Mode "presentació" híbrid | 🟦 | 🟡 | 📚 Alt | 🙂 Segur | 🤝 Alta | ✅ Encaixa | Fase 3 |
| 28 | "Energizers"/pauses amb vídeo | 🟨 | 🟡 | ✖️ Cap | 🙂 Segur | ➖ Neutra | ✅ Encaixa | ❌ Descartada |
| 29 | Matchmaking contra desconeguts | 🟦 | 🔴 | ➖ Neutre | 🙂 Segur | ➖ Neutra | 🚫 No encaixa | ❌ Descartada |
| 30 | Mode "Time Attack" | 🟨 | 🟡 | ➖ Neutre | 🙂 Segur | ➖ Neutra | ✅ Encaixa | Fase 1b |
| 31 | Mode "paper" (sense dispositiu per alumne) | 🟦 | 🟢 | ➖ Neutre | 🙂 Segur | 🤝 Alta | ✅ Encaixa | Fase 1b |
| 32 | Generació nativa de preguntes amb IA (crida a un proveïdor extern) | ➕⁹ | 🔴 | pendent | 🙂 Segur | ➖ Neutra | ✅ Encaixa | 📦 Aparcada |

### Notes de la taula

1. **4 (Power-ups)** — el "🙂 Segur" és després de reduir l'abast: el
   sub-ítem original "robar punts a un company" sí que era ⚠️ Risc, i s'ha
   descartat per això. El que queda (doble puntuació manual, 50/50,
   congelar ratxa) és segur.
2. **6 (Equips)** — risc lleu: un alumne pot sentir-se senyalat si la seua
   fallada "costa punts a l'equip". A vigilar en el disseny (p. ex.
   repartir punts sense exposar qui ha fallat), no és motiu de descart.
3. **10 (Modes arcade)** — mecàniques d'eliminació tipus Battle Royale
   exposen públicament a qui queda fora primer. Es manté en Fase 4 (ja
   era la de menor prioritat), amb esta reserva de disseny si es retoma
   algun dia.
4. **12 (Sobrenoms aleatoris)** — el "✖️ Cap" en aprenentatge no reflectix
   bé el seu valor real: no és pedagògic, és de **seguretat/gestió
   d'aula** (evita noms inapropiats). Per això continua en Fase 1a pese
   a eixa marca.
5. **15 (abans "IA nativa")** — redefinida després de la revisió
   pedagògica d'este llistat: el generador de preguntes amb IA que crida
   a un proveïdor extern se separa com a proposta 32; esta proposta 15
   passa a ser ampliar l'importador de preguntes existent (hui només
   accepta CSV) a GIFT, JSON, XML de Moodle i la resta de formats que
   accepta Moodle/AULES. No crida a cap proveïdor extern, així que no té
   el risc de dades de la proposta 32.
6. **18 i 22** — tindrien Aprenentatge 📚 Alt, però la protecció de dades
   prevaldria: cap de les dos es retomarà sense guardar un històric de
   resultats de l'alumnat identificable entre partides, cosa que no es
   farà.
7. **23 (Compte arrere 3-2-1)** — ja implementada en el mode "Jugar a
   l'aula" des del commit `9b8c345`; l'únic pendent és portar-la al mode
   Solo, que és justament el que cobrix la seua Fase 1a.
8. **26 (Mode fantasma)** — compara el jugador contra la seua pròpia
   millor marca, no contra companys: pedagògicament més sa que un
   rànquing competitiu, encara que no aporte aprenentatge directe per si
   mateix.
9. **32 (IA nativa, nova)** — no prové de la comparativa Kahoot/Wayground
   original: és l'abast que tenia la proposta 15 abans de separar-la.
   Pendent de valorar junt amb la mateixa restricció de protecció de
   dades que la proposta 18: quin proveïdor d'IA s'usaria i quines dades
   li arribarien, abans de decidir si es fa. Aparcada fins eixa decisió
   de producte (sí/no, proveïdor, garanties) — no descartada, a
   diferència de 18/22, perquè ací sí que podria haver-hi una resposta
   acceptable en el futur.

## Descripció detallada de cada proposta

La taula anterior és per a escanejar ràpid, amb origen, dificultat,
itinerari i context inclosos; ací va l'explicació completa de cada
proposta i el seu criteri pedagògic raonat (sense repetir l'itinerari ni
el context, que ja estan en la taula).

1. 🟩 **Ambdues** — Mode "tasca"/deures asíncrons amb data límit — 🔴 Alta
   El cas d'ús més valorat pel professorat en les dos plataformes; en
   Wayground és a més el seu mode fundacional.
   → **Criteri pedagògic:** 📚 Aprenentatge: Alt · 🙂 Clima: Segur ·
   🤝 Inclusió: Neutra → **Prioritat alta** (encara que es manté en Fase 3
   per dependre tècnicament de la proposta 3).

2. 🟨 **Kahoot** — Podi final animat amb confeti — 🟡 Mitjana
   La imatge més icònica i reconeixible del gènere.
   → **Criteri pedagògic:** ✖️ Aprenentatge: Cap · 🙂 Clima: Segur ·
   ➖ Inclusió: Neutra → **Aparcada.**

3. 🟦 **Wayground** — Mode autoritme (self-paced) — 🔴 Alta
   El tret que més caracteritza Wayground entre les plataformes
   educatives de referència.
   → **Criteri pedagògic:** 📚 Aprenentatge: Alt (permet un ritme
   diferenciat, reduïx la pressió d'un temps compartit) · 🙂 Clima:
   Segur · 🤝 Inclusió: Alta → **Prioritat alta**, reforça el seu paper
   de peça base de la Fase 3.

4. 🟩 **Ambdues** — Power-ups: doble puntuació manual, 50/50 i congelar
   ratxa — 🔴 Alta
   → **Criteri pedagògic:** ➖ Aprenentatge: Neutre · ⚠️ Clima: Risc
   (només en el sub-ítem "robar punts a un company") · ➖ Inclusió:
   Neutra → es reduïx l'abast: **es descarta "robar punts"**, per risc de
   conflicte a l'aula; la resta de power-ups continua avant.

5. 🟩 **Ambdues** — Avatars de personatge personalitzables — 🟡 Mitjana
   Ja existix un selector de 29 icones/emojis fixos (`join.html:44-73`,
   `join.js:2,33-52,191-193`, persistit com `avatar_icon` en
   `server.js:438,2337,2367,3459`); la proposta seria ampliar-lo (color,
   accessoris, galeria més àmplia), no crear-lo des de zero.
   → **Criteri pedagògic:** ✖️ Aprenentatge: Cap · 🙂 Clima: Segur ·
   ➖ Inclusió: Neutra → **Aparcada** (no es descarta el que ja existix,
   s'aparca l'ampliació).

6. 🟩 **Ambdues** — Mode equips, amb variant de torns "relay" — 🔴 Alta
   → **Criteri pedagògic:** 📚 Aprenentatge: Alt (fomenta la cooperació
   entre iguals) · ⚠️ Clima: Risc lleu (un alumne pot sentir-se senyalat
   si la seua fallada "costa punts a l'equip"; a vigilar en el disseny,
   p. ex. repartint punts sense exposar qui ha fallat) · 🤝 Inclusió:
   Alta (menys dispositius necessaris) → **Prioritat alta**, amb nota de
   disseny acurat en l'eix de clima.

7. 🟩 **Ambdues** — Nous tipus de pregunta: ordenar (Jumble) i emparellar
   (Puzzle/Matching) — 🔴 Alta
   → **Criteri pedagògic:** 📚 Aprenentatge: Alt (seqüenciació i relació
   de conceptes són formats d'avaluació amb valor pedagògic clar) ·
   🙂 Clima: Segur · ➖ Inclusió: Neutra → **Prioritat alta.**

8. 🟦 **Wayground** — Memes i GIF com a feedback d'encert/fallada — 🟡 Mitjana
   → **Criteri pedagògic:** ✖️ Aprenentatge: Cap · 🙂 Clima: Segur ·
   ➖ Inclusió: Neutra → **Aparcada.**

9. 🟨 **Kahoot** — Música/so de tensió per fases — 🟡 Mitjana
   `music-player.js` (377 línies) ja és un reproductor de pista de fons
   amb selector/volum/rotació, usat al vestíbul, a la partida, en
   multijugador i en Solo, més un efecte de gong al tancar cada pregunta
   (`effects/gong.mp3`, `hostGame.js:599-648`) — base reutilitzable, però
   encara no distingix música per fases.
   → **Criteri pedagògic:** ✖️ Aprenentatge: Cap · 🙂 Clima: Segur ·
   ➖ Inclusió: Neutra → **Aparcada.**

10. 🟦 **Wayground** — Modes de joc immersius tipus tauler/arcade
    (Battle Royale, Team Relay, Checkpoint) — 🔴 Alta
    → **Criteri pedagògic:** ➖ Aprenentatge: Neutre (pot distraure del
    contingut si el joc pesa més que la pregunta) · ⚠️ Clima: Risc
    (mecàniques d'eliminació tipus Battle Royale exposen públicament a
    qui queda fora primer) · 🚧 Inclusió: Baixa (més exigència tècnica i
    de dispositiu) → es manté en Fase 4 (ja era la de menor prioritat),
    amb nota de risc de clima a resoldre en el disseny si es retoma
    algun dia.

11. 🟨 **Kahoot** — Bonificació per ratxa d'encerts consecutius —
    🟢/🟡 Baixa-Mitjana
    → **Criteri pedagògic:** ➖ Aprenentatge: Neutre · 🙂 Clima: Segur
    (és individual, no compara contra altres alumnes) · ➖ Inclusió:
    Neutra → sense canvis.

12. 🟨 **Kahoot** — Generador de sobrenoms aleatoris en unir-se — 🟢 Baixa
    → **Criteri pedagògic:** ✖️ Aprenentatge: Cap · 🙂 Clima: Segur ·
    ➖ Inclusió: Neutra → es manté en Fase 1a **pese al "Cap" en
    aprenentatge**, perquè el seu valor real no és pedagògic sinó de
    seguretat/gestió d'aula (evita noms inapropiats); l'eix d'aprenentatge
    no ho captura bé.

13. 🟩 **Ambdues** — Lectura en veu alta de la pregunta (TTS / Read Aloud) —
    🟢 Baixa
    → **Criteri pedagògic:** ➖ Aprenentatge: Neutre · 🙂 Clima: Segur ·
    🤝 Inclusió: Alta (accessibilitat per a alumnat amb dificultats
    lectores) → **Prioritat alta.**

14. 🟨 **Kahoot** — So de feedback individual al respondre (ding/buzz) —
    🟢 Baixa
    → **Criteri pedagògic:** ✖️ Aprenentatge: Cap · 🙂 Clima: Segur ·
    ➖ Inclusió: Neutra → **Aparcada.**

15. 🟦 **Wayground** — Ampliar la importació de preguntes: GIFT, JSON,
    XML de Moodle i la resta de formats que accepta Moodle/AULES — 🟡 Mitjana
    Redefinida després de la revisió pedagògica d'este llistat. Abans
    era "Generador de preguntes amb IA natiu"; eixa part amb risc de
    dades se separa com a proposta 32. `create.js` (línies ~2923-3760) ja
    té un "Generador IA" que construïx un prompt, el docent el pega en la
    seua pròpia IA externa, i puja el **CSV** resultant — EduHoot mai
    crida a cap proveïdor en eixe flux. Esta proposta estén eixe mateix
    importador (`importCsv.js`) per a acceptar més formats d'entrada —
    GIFT, JSON, XML de Moodle i la resta de formats que admet Moodle/AULES
    — sense tocar cap proveïdor d'IA ni afegir risc de dades nou: és
    només un importador de fitxers més ampli, vinga el contingut d'una
    IA, de Moodle, o d'on siga.
    → **Criteri pedagògic:** ➖ Aprenentatge: Neutre · 🙂 Clima: Segur ·
    ➖ Inclusió: Neutra → sense risc, es manté en Fase 1a (començar per
    GIFT, JSON i XML de Moodle, que són els formats de pregunta més
    estàndards, i afegir la resta de formats de Moodle/AULES de forma
    incremental sobre la mateixa base).

16. 🟨 **Kahoot** — Reaccions en directe (emoji) enviades pel jugador —
    🟡 Mitjana
    → **Criteri pedagògic:** ✖️ Aprenentatge: Cap · ⚠️ Clima: Risc
    (es poden usar per a burlar-se d'un company que falla) · ➖
    Inclusió: Neutra → **Aparcada**, per risc sobre el clima de l'aula.

17. 🟦 **Wayground** — Tipus de pregunta addicionals (arrossegar i deixar
    anar, dibuix, resposta d'àudio, omplir buits, "hotspot" sobre imatge) —
    🔴 Alta
    → **Criteri pedagògic:** 📚 Aprenentatge: Alt · 🙂 Clima: Segur ·
    🤝 Inclusió: Neutra/Alta (el dibuix i l'àudio poden ajudar qui no
    s'expressa bé per escrit) → **Prioritat alta.**

18. 🟩 **Ambdues** — Informe de progrés de l'alumnat al llarg del temps
    (inclou variant per habilitat/estàndard curricular) — 🔴 Alta
    → **Criteri pedagògic:** 📚 Aprenentatge: hauria sigut Alt, però la
    protecció de dades prevaldria sobre el valor pedagògic en este cas
    → **❌ Descartada.** No es portarà cap històric de resultats de
    l'alumnat entre partides, per respecte a la normativa de protecció
    de dades. Esta decisió és independent de la dificultat tècnica: no es
    retomarà a no ser que eixa decisió de producte canvie.

19. 🟦 **Wayground** — Lliçons interactives (diapositives + preguntes
    intercalades) — 🔴 Alta
    → **Criteri pedagògic:** 📚 Aprenentatge: Alt (barreja contingut i
    avaluació, amb valor didàctic directe) · 🙂 Clima: Segur · ➖
    Inclusió: Neutra → valor pedagògic alt, però es manté en Fase 4 pel
    seu cost tècnic.

20. 🟩 **Ambdues** — Mode d'estudi "Flashcards" — 🟡 Mitjana
    → **Criteri pedagògic:** 📚 Aprenentatge: Alt · 🙂 Clima: Segur ·
    ➖ Inclusió: Neutra → **Prioritat alta** (confirmat).

21. 🟦 **Wayground** — Integració amb Google Classroom (assignar i
    autoqualificar) — 🔴 Alta
    → **Criteri pedagògic:** ➖ Aprenentatge: Neutre (és
    logística/gestió, no aprenentatge directe) · 🙂 Clima: Segur · ➖
    Inclusió: Neutra → sense canvis (condicionada a que Authentik es
    tanque).

22. 🟩 **Ambdues** — Insígnies i nivells de progrés persistents entre
    partides/assignacions — 🔴 Alta
    → **Criteri pedagògic:** 📚 Aprenentatge: mateix matís que la
    proposta 18, la protecció de dades prevaldria sobre el valor
    pedagògic/motivacional que tindria → **❌ Descartada.** Igual que la
    proposta 18, requerix identitat d'alumnat persistent entre partides;
    no es portarà eixe històric, per respecte a la normativa de
    protecció de dades.

23. 🟨 **Kahoot** — Pantalla "¡Prepara't!" amb compte arrere 3-2-1 — 🟢 Baixa
    Ja implementada en el mode "Jugar a l'aula" des del commit `9b8c345`
    (`server.js:76,2107-2120`, esdeveniment `questionCountdown`). No
    existix en Solo; l'únic pendent és portar `showQuestionCountdown`.
    → **Criteri pedagògic:** ✖️ Aprenentatge: Cap · 🙂 Clima: Segur ·
    ➖ Inclusió: Neutra → sense valor pedagògic directe, però s'implementa
    igualment: el cost real és mínim (ja existix en multijugador, només
    falta portar-la a Solo).

24. 🟦 **Wayground** — Vídeos integrats "aprén i després respon" —
    🟡 Mitjana
    → **Criteri pedagògic:** 📚 Aprenentatge: Alt (vincula contingut
    audiovisual directament amb la pregunta, és explícitament
    instructiu) · 🙂 Clima: Segur · ➖ Inclusió: Neutra → **Prioritat
    alta.**

25. 🟦 **Wayground** — Pràctica adaptativa (repetir automàticament les
    preguntes fallades) — 🟡 Mitjana
    → **Criteri pedagògic:** 📚 Aprenentatge: Alt · 🙂 Clima: Segur ·
    ➖ Inclusió: Neutra → **Prioritat alta** (confirmat).

26. 🟨 **Kahoot** — Mode "fantasma"/millor marca personal en Solo — 🟡 Mitjana
    → **Criteri pedagògic:** ➖ Aprenentatge: Neutre (autoavaluació
    progressiva) · 🙂 Clima: Segur (compara contra un mateix, no contra
    companys) · ➖ Inclusió: Neutra → sense canvis; nota positiva: al
    comparar contra un mateix en lloc de contra companys, és
    pedagògicament més sa que un rànquing competitiu.

27. 🟦 **Wayground** — Mode "presentació" híbrid (projecció + ritme
    individual) — 🟡 Mitjana
    → **Criteri pedagògic:** 📚 Aprenentatge: Alt (hereta el valor del
    mode autoritme, proposta 3) · 🙂 Clima: Segur · 🤝 Inclusió: Alta
    → **Prioritat alta.**

28. 🟨 **Kahoot** — "Energizers"/pauses amb vídeo entre blocs de
    preguntes — 🟡 Mitjana
    → **Criteri pedagògic:** ✖️ Aprenentatge: Cap (són pauses de
    descans, no contingut) · 🙂 Clima: Segur · ➖ Inclusió: Neutra →
    el criteri mecànic suggeria aparcar-la, però es decidix
    **descartar-la** directament, per decisió de producte. No
    s'implementarà.

29. 🟦 **Wayground** — Matchmaking de partides en directe contra altres
    classes/desconeguts — 🔴 Alta
    → **Criteri pedagògic:** ➖ Aprenentatge: Neutre · 🙂 Clima: Segur ·
    ➖ Inclusió: Neutra → **❌ Descartada.** No encaixa en un context
    escolar supervisat: exposaria l'alumnat a jugar contra desconeguts
    fora del control del docent. Baixa prioritat també per escala (només
    20 comptes docents reals hui), però el motiu principal és pedagògic.

30. 🟨 **Kahoot** — Mode "Time Attack" (cronòmetre únic per a tot el
    qüestionari) — 🟡 Mitjana
    → **Criteri pedagògic:** ➖ Aprenentatge: Neutre · 🙂 Clima: Segur ·
    ➖ Inclusió: Neutra → sense canvis.

31. 🟦 **Wayground** — Mode "paper" (sense dispositiu per alumne) — 🟢 Baixa
    → **Criteri pedagògic:** ➖ Aprenentatge: Neutre · 🙂 Clima: Segur ·
    🤝 Inclusió: Alta (permet jugar sense que cada alumne tinga
    dispositiu propi) → **Prioritat alta** (confirmat).

32. ➕ **Nova** — Generació nativa de preguntes amb IA (crida a un
    proveïdor extern des del servidor) — 🔴 Alta
    No prové de la comparativa Kahoot/Wayground original: és l'abast que
    tenia la proposta 15 abans de separar-la, després de la revisió
    pedagògica d'este llistat. A diferència de la 15 ja redefinida, esta
    sí implicaria que EduHoot cride a un proveïdor d'IA des del seu propi
    servidor, amb dades del docent (i potencialment dels documents que
    adjunte) eixint cap a eixe proveïdor.
    → **Criteri pedagògic:** pendent de valorar — mateixa restricció de
    protecció de dades que la proposta 18: quin proveïdor d'IA s'usaria i
    quines dades li arribarien, abans de decidir si es fa →
    **📦 Aparcada**, pendent d'una decisió de producte (sí/no, quin
    proveïdor, quines garanties). No descartada com 18/22: ací sí que
    podria haver-hi en el futur una resposta acceptable a eixes
    preguntes.

## Resum per origen

- 🟨 **Només Kahoot**: 10 — podi, música per fases, ratxa, sobrenoms
  aleatoris, so de feedback, reaccions, "¡Prepara't!" 3-2-1, mode
  fantasma, energizers, Time Attack.
- 🟦 **Només Wayground**: 12 — autoritme, modes arcade, memes/GIF, IA
  nativa, tipus de pregunta addicionals, lliçons interactives, Google
  Classroom, vídeos "aprén i respon", pràctica adaptativa, mode
  presentació híbrid, matchmaking, mode paper.
- 🟩 **Ambdues**: 9 — deures asíncrons, power-ups, avatars, mode equips,
  tipus de pregunta ordenar/emparellar, TTS, informe de progrés,
  flashcards, insígnies.

(Estos recomptes són els de la comparativa original Kahoot/Wayground i no
reflectixen les decisions posteriors — vore "Itinerari" en la taula i el
full de ruta més avall.)

## Resum per dificultat

- 🟢 **Baixa**: 5 — sobrenoms aleatoris, TTS, so de feedback, "¡Prepara't!"
  3-2-1, mode paper.
- 🟡 **Mitjana**: 13 — podi, música per fases, avatars, memes/GIF, ratxa
  (límit baixa/mitjana), reaccions, flashcards, mode fantasma, energizers,
  Time Attack, vídeos "aprén i respon", pràctica adaptativa, mode
  presentació híbrid.
- 🔴 **Alta**: 13 — deures asíncrons, power-ups, mode equips, tipus de
  pregunta ordenar/emparellar, autoritme, modes arcade, IA nativa, tipus
  de pregunta addicionals, informe de progrés, lliçons interactives,
  Google Classroom, insígnies, matchmaking.

## Full de ruta d'implementació

Esta secció creua les 31 propostes anteriors amb la resta de la
documentació del repositori (`PROXIMAS_MEJORAS_PLAN.md`,
`PLAN_ESTABILIDAD_SESION.md`, `REVISION_MEJORAS.md`, els documents de
migració a Authentik, `FEATURES.md`, `TESTING.md`, `docs/DOCKER_HOWTO.md`,
`docs/DOCKER.md`, `CHANGELOG.md`) per a fixar un orde de treball
realista, no només una llista d'idees.

### Troballes que condicionen l'orde

- **Identitat de l'alumnat no persistent, per decisió de producte.** Les
  propostes 18 (informe de progrés) i 22 (insígnies) queden descartades:
  cap de les dos necessita només esforç tècnic, sinó guardar un històric
  de resultats de l'alumnat identificable entre partides, cosa que no es
  farà per respecte a la normativa de protecció de dades.
- **Criteri pedagògic per damunt de la popularitat.** La proposta 29
  (matchmaking amb desconeguts) queda descartada per no encaixar en un
  context supervisat; 28 (energizers) queda descartada per decisió de
  producte; i 2 (podi), 5 (avatars), 8 (memes/GIF), 9 (música per fases)
  i 14 (so de feedback) queden aparcades — encara que algunes d'elles
  siguen populars en Kahoot/Wayground. La proposta 4 (power-ups) continua,
  però sense el sub-ítem "robar punts".
- **Accés docent en transició activa.** La migració a Authentik
  (`docs/PLA-MIGRACIO-AUTHENTIK-2026-10.md`) continua oberta: hi va haver
  una fallada real de detecció del rol docent detectada el 12 d'octubre
  de 2026, per la qual cosa es va desactivar la data de tall automàtica
  del 26 d'octubre i encara no hi ha una nova data de tancament. Mentre
  això no es tanque, convé no tocar el mateix codi d'accés/sessió
  (`server.js`) per un altre motiu, i posposar qualsevol proposta que
  depenga d'una integració d'identitat docent estable (21, Google
  Classroom).
- **El codi del servidor ha crescut sense reorganitzar-se.**
  `src/server/server.js` ha passat de 3.588 a 5.122 línies des de
  l'auditoria d'abril (`REVISION_MEJORAS.md`), i `src/public/js/create.js`
  de 3.898 a 4.184. Abans d'apilar diverses propostes de dificultat 🔴
  ahí dins, convé anar separant responsabilitats en fitxers propis (p.
  ex. la lògica de tipus de pregunta, abans d'afegir els tipus nous de la
  Fase 2) per a no seguir agreujant eixe problema.
- **Base ja sòlida per a mecàniques de joc en directe.** El pla
  d'estabilitat de sessió (`PLAN_ESTABILIDAD_SESION.md`) està complet en
  el codi (reconnexió, periode de gràcia, Wake Lock), encara que el propi
  document no ho reflectisca. Les propostes de les Fases 2 i 3 poden
  recolzar-se en eixa base sense preocupar-se primer per la reconnexió
  bàsica.
- **No hi ha entorn de desenvolupament amb recàrrega automàtica.**
  `docs/DOCKER_HOWTO.md` continua sent només una guia de disseny; hui
  cada canvi exigix reiniciar `node server/server.js` a mà.
  Implementar-ho abans de començar diverses propostes accelera la
  iteració de totes les fases següents.
- **El full de ruta de biblioteca pública (`PROXIMAS_MEJORAS_PLAN.md`) és
  un eix a banda.** No competix pel mateix codi que estes 31 propostes
  (excepte parcialment en "perfil d'autor docent"), així que pot avançar
  en paral·lel sense necessitat de seqüenciar-lo amb este document.
- **Diverses propostes ja estan parcial o totalment implementades.**
  Comprovat contra el codi actual:
  - **5 (avatars)** — ja existix un selector de 29 icones/emojis fixos
    (`src/public/join.html:44-73`, `join.js:2,33-52,191-193`, persistit
    com `avatar_icon` en `server.js:438,2337,2367,3459`).
  - **9 (música per fases)** — `music-player.js` (377 línies) ja és un
    reproductor de pista de fons amb selector/volum/rotació, més un
    efecte de gong al tancar cada pregunta (`effects/gong.mp3`,
    `hostGame.js:599-648`). Encara no distingix música per fases.
  - **23 (compte arrere 3-2-1)** — ja implementada abans de cada
    pregunta en el mode "Jugar a l'aula" (commit `9b8c345`,
    `server.js:76,2107-2120`, esdeveniment `questionCountdown`). **No
    existix en Solo**: ahí només faltaria portar `showQuestionCountdown`.
  - **4 (power-ups)** — el submecanisme de "doble puntuació" ja existix
    (commit `ef9cb40`, `server.js:144-146,2747-2778`), però només
    s'activa automàticament en importar un qüestionari de Kahoot que ja
    ho portava marcat; no hi ha control manual en el creador propi.
  - **15 (importació ampliada)** — `create.js` (línies ~2923-3760) ja té
    un "Generador IA" que construïx un prompt, el docent el pega en la
    seua pròpia IA externa, i puja el **CSV** resultant — és dir, EduHoot
    mai crida a un proveïdor d'IA en eixe flux. La proposta 15 estén eixe
    mateix importador a GIFT, JSON i XML de Moodle; la crida nativa a un
    proveïdor d'IA es tracta a banda en la proposta 32 (aparcada).
  - Existix a més un mode **"multijugador local"** (`src/public/multiplayer/`,
    pantalla compartida 2-4 jugadors, sense PIN) no reflectit en cap lloc
    d'este document: no és "mode paper" (31) ni "mode equips" (6), però
    gestiona diversos jugadors en un dispositiu i repartix preguntes per
    ronda — base de disseny a revisar abans d'especificar 6 i 31 des de
    zero.
  - La resta de les 31 propostes (incloses les descartades/aparcades) no
    té cap indici d'implementació en el codi actual.
- **El token de restabliment en els logs ja no està vigent en
  producció/staging.** A diferència del que indicava `REVISION_MEJORAS.md`,
  el token ja no s'escrivia en producció, i des del commit `23a53f7`
  tampoc s'escriu en staging; el correu del docent només apareix al log
  en desenvolupament.

### Fase 0 — Habilitadors (requisits, no una recomanació)

Separar responsabilitats de `server.js` i tindre recàrrega automàtica en
desenvolupament haurien de ser **requisits per a començar la Fase 2**, no
un suggeriment ajornable:

- Entorn de desenvolupament amb recàrrega automàtica (`docs/DOCKER_HOWTO.md`).
- Separar del monòlit `server.js` almenys la lògica de tipus de pregunta,
  abans d'afegir els tipus nous de la Fase 2.
- Deixar que la migració a Authentik es tanque abans de tocar codi
  d'accés/sessió per un altre motiu.

### Fase 1a — Millores cosmètiques/aïllades, sense tocar la lògica de joc

12 (sobrenoms aleatoris), 13 (TTS), 15 (ampliar importació:
GIFT/JSON/XML Moodle/AULES), 20 (flashcards), 23 (compte arrere 3-2-1).

No canvien ni la puntuació ni la seqüència de preguntes: són canvis
d'interfície, d'àudio, o d'importació de contingut, autocontinguts en un
fitxer o una vista concreta. 13 i 20 tenen a més prioritat pedagògica alta
confirmada.

### Fase 1b — Mecàniques de Solo/amfitrió, sense tocar l'arquitectura del cicle de partida

11 (ratxa), 24 (vídeos "aprén i respon"), 25 (pràctica adaptativa), 26
(mode fantasma), 30 (Time Attack), 31 (mode paper).

A diferència de la Fase 1a, estes sí que canvien la puntuació (11) o la
seqüència de preguntes (24, 25, 26, 30, 31) dins del mode Solo o de
l'amfitrió, encara que sense requerir el canvi d'arquitectura de ritme
compartit que sí necessita la Fase 3. 24, 25 i 31 tenen prioritat
pedagògica alta confirmada.

### Fase 2 — Mecàniques de joc de major abast, però autocontingudes

4 (power-ups, sense "robar punts"), 6 (mode equips), 7 (tipus de
pregunta: ordenar/emparellar), 17 (tipus de pregunta addicionals).

Amplien el model de dades de la partida (equips, power-ups, tipus de
pregunta nous), però no canvien el ritme compartit de la partida: continua
sent l'amfitrió qui controla l'avanç. Les 4 tenen prioritat pedagògica
alta confirmada (6 amb una nota de disseny sobre el clima d'aula).

### Fase 3 — Canvi d'arquitectura del cicle de partida

3 (mode autoritme, la peça base), 1 (deures asíncrons), 27 (mode
presentació híbrid).

Totes depenen de rompre l'assumpció actual de que tots els jugadors
avancen al mateix ritme dirigits per l'amfitrió (confirmat en
`FEATURES.md → Avanç de pregunta`). Convé construir primer el mode
autoritme (3) com a primitiva reutilitzable, i recolzar-se en ell per a
les altres dos. Les 3 tenen prioritat pedagògica alta confirmada.

### Fase 4 — Integracions externes o de baixa prioritat per escala

10 (modes arcade), 19 (lliçons interactives), 21 (Google Classroom).

Comparteixen que depenen de factors externs al propi producte (que la
identitat docent d'Authentik estiga tancada, o una base d'usuaris major a
l'actual — 20 comptes docents reals hui) més que de dificultat tècnica
pura. 10 té a més una nota de risc de clima d'aula a resoldre en el
disseny; 19 té alt valor pedagògic pese a quedar en esta fase per cost
tècnic.

### Aparcades

- **2 — Podi final amb confeti.**
- **5 — Avatars de personatge personalitzables.**
- **8 — Memes i GIF com a feedback.**
- **9 — Música/so de tensió per fases.**
- **14 — So de feedback individual.**
- **16 — Reaccions en directe (emoji).**
- **32 — Generació nativa de preguntes amb IA.**

2, 5, 8, 9, 14 i 16 no aporten valor d'aprenentatge directe i no són
urgents; no es descarten, queden disponibles per a revisar en el futur
per motius d'experiència d'usuari. 32 és distinta: queda aparcada perquè
abans de dissenyar-la cal decidir si es fa, amb quin proveïdor d'IA i
quines garanties de dades (mateixa restricció que 18/22, però sense
descartar-la d'entrada).

### Descartades

- **18 — Informe de progrés històric.**
- **22 — Insígnies i nivells persistents.**
- **28 — "Energizers"/pauses amb vídeo.**
- **29 — Matchmaking de partides en directe contra desconeguts.**

18 i 22 requerixen guardar un històric de resultats de l'alumnat
identificable entre partides distintes; és una decisió de producte, no
de dificultat tècnica, per respecte a la normativa de protecció de
dades. 29 no encaixa en un context escolar supervisat: exposaria
l'alumnat a jugar contra desconeguts fora del control del docent. 28 es
descarta per decisió de producte, sense que el criteri mecànic ho
exigira.
