# Accessibilitat: estat actual i propostes de millora

Document que resumix què hi ha ja
implementat d'accessibilitat a EduHoot, què falta, i com es compara amb
el que oferixen Kahoot i Wayground. És la base per a decidir què
s'afig a `POPULAR_FEATURES.md` i què passa directament a implementació.

## Índex

- [Context](#context)
- [Estat actual al codi](#estat-actual-al-codi)
- [Buits detectats](#buits-detectats)
- [Referència: Kahoot i Wayground](#referència-kahoot-i-wayground)
- [Propostes](#propostes)
- [Relació amb altres documents](#relació-amb-altres-documents)
- [Pròxims passos](#pròxims-passos)

## Context

Quines altres opcions d'accessibilitat es podrien
implementar a Eduhoot? Abans de proposar res nou, s'ha revisat el codi
(`src/public/`) per no duplicar el que ja existix, i s'ha buscat
informació pública sobre les funcions d'accessibilitat de Kahoot i
Wayground (la segona, de pagament en el seu pla per a centres), perquè
sembla que Wayground n'oferix moltes en la seua versió de
pagament.

## Estat actual al codi

Ja implementat, no cal tornar a proposar-ho:

- **Formes + color a les respostes** (triangle/romb/cercle/quadrat via
  `clip-path`), a `playerGameView.css` i `hostGameView.css`. Mitigació
  de daltonisme explícitament documentada en `README.md` i
  `CHANGELOG.md`.
- **`aria-live`** al cronòmetre entre preguntes i als missatges d'error
  de PIN/login (diverses vistes: `join.html`, `player/game`,
  `host/game`, `solo`, `multiplayer`, `create`).
- **`aria-pressed`** mantingut en els botons de tipus interruptor
  (`solo.js`, `multiplayer.js`, `hostGame.js`, `music-player.js`,
  `create.js`).
- **`role="dialog"` + `aria-modal`** en els tres modals existents
  (`join`, `create`, `multiplayer`).
- Patró **`.sr-only`**, encara que limitat a les vistes `solo` i
  `multiplayer`.
- **Cronòmetre amb doble canal** (barra visual + text numèric) al
  jugador i a l'amfitrió.
- El viewport no bloqueja el zoom (no hi ha `user-scalable=no`).

## Buits detectats

- **`lang` de pàgina**: només `index.html` el declara (`es`). Les
  altres 10 pàgines no tenen `lang`, tot i que l'app és multiidioma.
- **Botons de resposta del jugador sense `aria-label`**: depenen només
  de color + forma visual; un lector de pantalla no té cap pista de
  quina resposta és quina.
- **Imatges de pregunta amb `alt=""` buit**, sense camp a l'editor de
  quiz perquè el professorat afija una descripció.
- **Vídeos de pregunta sense subtítols** (`<video>` sense `<track>`,
  ni camp de transcripció).
- **Teclat/focus**: no hi ha `tabindex` explícit, ni skip-links, ni
  gestió de focus trap/`Escape` als modals.
- **Sense `prefers-reduced-motion`**: les animacions del compte enrere
  (parpelleig/pulsació) no es poden desactivar, rellevant per a
  alumnat amb sensibilitat vestibular o fotosensibilitat (és també una
  qüestió de clima d'aula segur, no només tècnica).
- **Sense alt contrast** ni `prefers-contrast`: un únic tema fosc fix.
- **CSS majoritàriament en `px`**, poca tipografia en `rem`, el que
  reduïx el respecte a la mida de text preferida del navegador.
- **`.sr-only` i patrons ARIA inconsistents** entre vistes: `host`,
  `create` i `join` no tenen el que `solo`/`multiplayer` sí tenen.
- **Sense lectura en veu alta (TTS)**: ja identificat com a idea
  pendent en `POPULAR_FEATURES.md` (vore més avall), no és un buit nou.

## Referència: Kahoot i Wayground

**Kahoot** (fonts: [support.kahoot.com](https://support.kahoot.com/hc/en-us/articles/115004537447),
[trust.kahoot.com](https://trust.kahoot.com/accessibility-settings/),
[kahoot.com/accessibility](https://kahoot.com/accessibility/)):

- Objectiu declarat de conformitat amb **WCAG 2.2 nivell AA** (només
  la infraestructura i la interfície pròpia; el contingut generat pel
  professorat queda exclòs).
- **Lectura en veu alta** de preguntes i respostes, integrada a les
  apps iOS/Android.
- Opció d'**augmentar el contrast** per a l'amfitrió/participants.
- **Navegació per teclat** (Alt, Enter, Barra espaiadora).
- Poder mostrar preguntes i respostes **al dispositiu propi del
  jugador**, perquè puga usar la seua pròpia tecnologia d'assistència.
- Alguns tipus de pregunta (Pin answer, Drop Pin) estan marcats pel
  mateix Kahoot com **no compatibles amb lector de pantalla**; una
  auditoria universitària (de data anterior a la documentació actual)
  apuntava també que l'estat de selecció en preguntes de resposta
  múltiple no s'anunciava al lector de pantalla.

**Wayground** (abans Quizizz; font: guia d'accommodations d'un centre
universitari i la pàgina pròpia d'accommodations de Wayground):

- Pestanya **"Accommodations"**, on el professorat aplica ajustos
  **per alumne o grup d'alumnes concret**, no de forma global per a
  tota la classe. Este és exactament l'enfocament que ja hem apuntat a
  la wishlist com **W5**.
- Entre els ajustos: **lectura en veu alta (TTS)**, **tipografia
  específica per a dislèxia**, traducció, diccionari bilingüe i
  calculadores Desmos.
- Wayground anuncia estes eines com a part del seu **pla de pagament
  per a centres/districtes**; les fonts no confirmen si cada eina té
  un cost diferenciat dins del pla, només que el conjunt és de pagament.
- No s'ha trobat cap menció d'un mode d'alt contrast propi de
  Wayground (buit d'evidència, no necessàriament absència real).

## Propostes

Agrupades per esforç estimat, sense prioritzar encara amb el criteri
pedagògic complet (quatre eixos) de `POPULAR_FEATURES.md` — això es fa
quan es decidisca incorporar-les al document principal:

**Esforç baix (canvis localitzats, sense tocar `server.js`):**
- `lang` correcte a cada pàgina (fixe, o dinàmic segons l'idioma actiu).
- `aria-label` als botons de resposta del jugador amb el nom de la
  forma (triangle/romb/cercle/quadrat), no només el color.
- `prefers-reduced-motion` per a desactivar/suavitzar les animacions
  del compte enrere.
- Estendre `.sr-only` i els patrons ARIA ja usats a `solo`/`multiplayer`
  cap a `host`, `create` i `join`.
- Gestió de focus/`Escape` als tres modals existents.

**Esforç mitjà:**
- Camp d'alt text a l'editor de quiz per a imatges de pregunta.
- Mode d'alt contrast (tema alternatiu, variables CSS).
- Migrar tipografia de `px` a `rem` on afecte la llegibilitat.
- Subtítols o transcripció per a vídeos de pregunta.

**Relacionades amb idees ja existents:**
- Lectura en veu alta (TTS): ja a la wishlist de `POPULAR_FEATURES.md`,
  no duplicar.
- Tipografia per a dislèxia: nova idea, inspirada directament en
  l'enfocament de Wayground.
- Ajustos per alumne/grup concret (temps, TTS, alt contrast...): amplia
  l'abast de **W5**, que hui només parla de temps límit.

## Relació amb altres documents

- `POPULAR_FEATURES.md` ja té la lectura en veu alta (TTS) com a idea
  de backlog amb alta inclusió/prioritat. Este document no la duplica,
  només l'ha confirmat com a no implementada.
- **W5** (personalització per jugador/grup, afegida hui a la wishlist)
  encaixa de ple amb el model d'"Accommodations" de Wayground; es
  podria ampliar el seu text per a cobrir explícitament ajustos
  d'accessibilitat, no només el temps límit.

## Pròxims passos

Pendent de decisió: quines d'estes propostes passen a
`POPULAR_FEATURES.md` (com a noves entrades numerades o wishlist), i
quines es volen implementar directament com a "quick wins" de codi.
