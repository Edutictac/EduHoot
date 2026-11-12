# Changelog

<!-- markdownlint-configure-file { "MD024": { "siblings_only": true } } -->

Tots els canvis notables d'EduHoot es documenten en este fitxer.

El format es basa en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
i este projecte segueix, de manera flexible, el
[Versionat Semàntic](https://semver.org/).

Les versions de l'1.0.0 a l'1.0.7 són una reconstrucció retroactiva a partir
de l'historial de Git (missatges de commit i el camp `version` de
`src/package.json`), ja que este fitxer no existia abans d'ara.

Les versions 1.0.2 i 1.0.5 van tindre en el seu moment una nota de versió
pròpia (`RELEASE-X.Y.Z.md`); el seu contingut ja està integrat ací i als
fitxers corresponents, i els originals es van eliminar.

## [Sense publicar]

### Afegit
- En el panell de logs, triar un tag en el desplegable ja filtra, sense
  haver de prémer «Filtrar».
- Els distintius de dev i stage són més transparents i deixen veure el
  que hi ha darrere.
- Els panells d'estadístiques i de logs s'enllacen entre ells amb un botó
  visible; en logs, la configuració (nivell, mida i «Guardar») queda
  alineada.
- S'activa la CSP (*Content Security Policy*): el navegador només executa
  scripts del propi EduHoot, de les llibreries de `/create/` i del Commons
  configurat, i no executa cap script en línia. És una segona barrera
  contra XSS (issue #20). Amb `CSP_REPORT_ONLY=true` només avisa.
- En el panell de logs, el botó «Ver» del detall passa a la primera
  columna de la taula.

- En acabar la partida, la pantalla de l'amfitrió mostra «Tornar» al
  costat de «Descarregar informe», per a tornar a la biblioteca
  (`/create/`) sense haver d'usar el botó d'arrere del navegador
  ([#17](https://github.com/Edutictac/EduHoot/issues/17)).
- En desenvolupament, el distintiu «Entorn: desenvolupament» mostra
  davall el nom del professorat loguejat, si en té, en totes les
  pantalles.
- El visor `/admin/logs` té un botó «Ver» a les entrades amb detall
  addicional (p. ex. `uncaughtException`), que obri un modal amb la
  resta de camps i el stack trace complet.
- La pantalla d'entrada de l'alumnat (`/join.html`) té un enllaç
  «Tornar» a la portada, com `/solo/` i `/multiplayer/`, i el modal del
  PIN té un botó «Cancel·la» que hi torna (el modal tapava l'enllaç).

### Canviat

- El lobby de l'amfitrió (`/host/`) és ara una app de Vue 3, sense build
  step: és la prova pilot de la Subfase B de
  [`docs/MIGRATING.md`](docs/MIGRATING.md). Funciona igual que abans; Vue
  s'inclou en el propi repositori perquè la pàgina funcione sense
  connexió.
- La pantalla de joc de l'alumnat (`/player/game/`) també és ara una app
  de Vue 3, seguint el mateix patró: pregunta, respostes, temporitzador,
  compte arrere, nom/puntuació/rànquing i missatges de resultat. Funciona
  igual que abans.
- La pantalla de joc de l'amfitrió (`/host/game/`) també és ara una app
  de Vue 3: pregunta, respostes, temporitzador, comptador de jugadors,
  insígnia de punts dobles, compte arrere, modal de resultats i
  rànquing, celebració de grup i fi de partida. Funciona igual que
  abans.
- El mode Multijugador (`/multiplayer/`) també és ara una app de Vue 3:
  catàleg, configuració, partida i resultats. Funciona igual que abans.
- L'editor de qüestionaris (`/create/quiz-creator/`) també és ara una
  app de Vue 3. Funciona igual que abans; a més, en canviar d'idioma es
  tradueixen també les preguntes ja creades.
- El mode individual (`/solo/`) també és ara una app de Vue 3: catàleg,
  partida, resultat i rànquing. Funciona igual que abans.
- La biblioteca (`/create/`) també usa ara Vue 3: biblioteca, generador
  IA, importació i compte. Funciona igual que abans.
- El pont de sessió amb el xip d'EduTicTac, que estava copiat en
  `/create/` i en els dos panells d'administració, ara és un sol fitxer
  comú (`session-bridge.js`).
- La pantalla per a unir-se a una partida (`/join.html`), la sala
  d'espera (`/player/`) i els panells d'estadístiques i de logs
  (`/admin-*`) també són ara apps de Vue 3. Funciona igual que abans.

### Corregit
- En els desplegables, les opcions no seleccionades es veien molt
  clares (text blanc sobre la llista clara del sistema); ara la llista és
  fosca i es llig bé en totes les pantalles.
- Si en obrir `/create/` o un panell `/admin-*` el xip de compte ja no
  tenia sessió, EduHoot podia tancar la seua dues vegades seguides.
- En la pantalla de joc de l'alumnat (`/player/game/`), en PC les
  respostes eixien desplaçades a l'esquerra; ara formen una quadrícula de
  2x2 centrada. En mòbil, quan la pregunta té imatge, esta s'ajusta a
  l'alçada de la pantalla perquè les quatre respostes es vegen sense
  desplaçar. El text de cada resposta s'alinea a l'esquerra, després del
  símbol, amb més separació entre tots dos.
- En acabar la partida, la pantalla de l'amfitrió continuava mostrant
  «Saltar pregunta», i l'avís «Ningú ha encertat…» de l'última pregunta
  podia quedar damunt del podi.
- En la sala d'espera (`/player/`), el missatge «Connectat a la partida»
  es podia substituir pel text inicial d'espera si la connexió arribava
  abans que la traducció de la pàgina.
- En obrir `/create/` amb sessió, la sessió es comprovava dues vegades i
  un quiz pendent de desar en el compte es podia reclamar dues vegades.
- En el mode individual (`/solo/`), qui entrava des de Commons apareixia
  en el rànquing com «AAA» en lloc del seu codi públic.

- En canviar d'idioma en el lobby de `/host/`, l'error visible (p. ex.
  «Falta el quiz…») es convertia en el missatge genèric; ara es traduïx.
- El temporitzador de l'amfitrió en la partida no es repintava fins al
  primer segon: començava cada pregunta mostrant el valor anterior, i
  si tot l'alumnat responia de seguida es quedava en «20» encara que el
  temps per pregunta fora un altre
  ([#21](https://github.com/Edutictac/EduHoot/issues/21)).
- A la pantalla de l'amfitrió (`/host/game/`), el comptador «Han
  respost X / Y» es quedava ocult per sempre a partir de la segona
  pregunta, i no es podia saltar la primera pregunta de cada partida.
- Les preguntes de resposta curta i numèrica ja arriben a «Jugar a
  l'aula»: el servidor les filtrava sempre per error (un filtre pensat
  només per al mode Multijugador), i si un qüestionari no en tenia cap
  altra, ni es podia llançar la partida
  ([#24](https://github.com/Edutictac/EduHoot/issues/24)).
- En el mode Multijugador, l'ordre «Millor valorats» mostrava el text
  intern `sortRating` i ordenava per partides jugades; ara ordena per
  valoració.
- En el mode Multijugador, un encert parcial en resposta múltiple sumava
  punts però el panell no deia res; ara mostra «Parcialment correcte».

## [1.1.0] - 2026-11-07

### Afegit

- Entorn de desenvolupament amb Docker (`docker compose up`): alça EduHoot
  amb recàrrega automàtica, sense instal·lar Node ni MongoDB en local.
  Documentat en [`docs/DEV_DOCKER_SETUP.md`](docs/DEV_DOCKER_SETUP.md).
- L'entorn de desenvolupament carrega automàticament 5 qüestionaris públics
  de mostra i 5 usuaris de prova (1 administrador, 4 editors), de forma
  idempotent i reversible (`npm run seed:dev` / `unseed:dev`).
- Distintiu visual d'entorn: quan l'app s'executa en desenvolupament o en
  stage, totes les pantalles principals mostren un distintiu fix a la part
  superior, un tint de fons i un prefix al títol de la pestanya, per a no
  confondre estos entorns amb producció. No fa res quan l'entorn és
  producció.
- `/dev/login` (només amb `NODE_ENV=development`): entrar com a qualsevol
  usuari de prova del seed amb un clic, ara que `/create/` només té l'accés
  pel xip d'EduTicTac. El distintiu de desenvolupament hi enllaça.
- Authentik simulat en `docker compose` (servei `oidc`,
  `src/scripts/dev-oidc.js`): prova el flux OIDC real en local amb usuaris de
  prova (docents del seed, un docent nou i un alumne sense rol docent).
- Camps `idioma`, `llicència` i `descripció` en crear o editar un qüestionari.
- El peu de pàgina i el distintiu d'entorn mostren també l'etiqueta de
  desplegament quan l'app s'executa en stage.

### Canviat

- El distintiu verd de stage ara és clicable: porta a la portada del
  mateix origen, igual que el de desenvolupament porta a `/dev/login`.
- En stage i desenvolupament s'amaga l'enllaç "Inici" del xip de compte
  (porta a `edutictac.es` sense manera evident de tornar i confonia a
  qui prova l'entorn); en producció es manté visible.
- El títol de la pestanya del creador de qüestionaris mostra el seu nom o correu.
- Les enquestes («opinió») ja no compten en el total de preguntes puntuables
  en mode aula (abans només quedaven excloses en mode Solo).
- El mode "a cegues" (desmarcar "Mostra la pregunta a l'alumnat") ja no deixa
  el dispositiu sense cap botó: ara pinta botons amb forma/color i
  `aria-label`, sense el text de la resposta. Funciona en qualsevol
  dispositiu, no només mòbils (la casella es deia abans "Enviar als mòbils").

### Corregit

- Les preguntes d'enquesta («opinió») en el mode Solo ja no es compten com a
  errors: ja no obrin el diàleg d'error, queden excloses del total puntuat
  del rànquing, i una partida només d'enquestes no demana entrada al
  rànquing.
- L'avís de falta de permisos en la biblioteca de qüestionaris ara s'obri
  sempre que cal, encara que l'usuari tinga sessió iniciada (abans només
  apareixia si no n'hi havia cap). Els botons de jugar, editar, eliminar,
  clonar i compartir sense permís ara apareixen deshabilitats amb un
  missatge explicatiu, en lloc de quedar clicables sense cap avís previ.
- El CSV d'informe de partida ja distingix entre resposta incorrecta,
  parcial i enquesta, en lloc de marcar-ho tot indistintament com
  "incorrecta".
- El nom del CSV d'informe de partida ara inclou el nom del qüestionari i un
  moment exacte, no només el PIN (que es reutilitza entre partides i podia
  produir dos fitxers amb el mateix nom). El mateix criteri de nom de fitxer
  (sense accents, longitud acotada) s'aplica ara també en exportar un
  qüestionari a CSV o a Moodle XML.
- El panell d'administració (`/admin/stats`) ara usa el mateix accés per
  xip d'EduTicTac/Authentik que la resta de l'app, en lloc del formulari
  antic de correu+contrasenya/Google, que ja no funcionava en producció
  des que l'accés docent és únicament per Authentik.

## [1.0.13] - 2026-10-25

### Afegit

- `EDUTICTAC_COMMONS_URL`: el xip de compte pot apuntar a un Commons local
  (p. ex. `http://edutictac.local:8082`) en lloc de `commons.edutictac.es`. El
  servidor reescriu l'adreça del xip a les pàgines que el porten.

### Canviat

- Si Commons no respon i el xip no es pinta, «Entrar» de `/create/` porta
  directament a l'accés Authentik d'EduHoot, perquè el professorat mai es
  quede sense entrar.
- El pont de sessió accepta un Commons local del mateix host (nom local o IP)
  i exigix el mateix host quan l'adreça és una IP o un nom sense domini.

## [1.0.12] - 2026-10-25

### Canviat

- El peu mostra la versió d'EduHoot desplegada (p. ex. «v1.0.12»), servida per
  `GET /api/version` a partir de `package.json`, en lloc de la versió de la
  memòria cau del service worker. Ara també apareix a host, lobby i
  multijugador. `sw-version.js` passa a `app-version.js`.

## [1.0.11] - 2026-10-25

### Corregit

- El botó «Entrar» de `/create/` obri el menú del xip i el deixa obert; abans
  el mateix clic el tancava perquè el xip el prenia com un clic de fora.

## [1.0.10] - 2026-10-25

### Canviat

- El xip de compte d'EduTicTac és l'únic accés del professorat. Quan el xip
  té sessió de professorat, EduHoot hi entra sense demanar res més (SSO amb
  Authentik), i quan el xip la tanca, EduHoot també. Només actua quan EduHoot
  i Commons comparteixen domini; una instal·lació local no es veu afectada.
- «Compte» passa a «Preferències» (nom visible i eines d'administració) i
  només apareix amb sessió.
- Alumnat i joc públic (`/join.html`, `/player/`, `/solo/`, `/multiplayer/`)
  mostren només l'enllaç «Inici» del xip i conserven el selector d'idioma propi.

### Llevat

- Formulari antic d'accés de `/create/`: correu i contrasenya, recuperació de
  contrasenya, alta i restabliment d'usuaris, Google, avís de migració i botons
  «Entrar»/«Eixir» de la capçalera, amb els seus textos.

### Corregit

- Integració del xip i del peu: el xip ja no es mescla amb el títol de
  `/create/` ni aixafa la capçalera de multijugador en mòbil; «Cancel·la la
  partida» ja no es parteix en tres línies; el títol del lobby no queda davall
  del xip en mòbil; el peu de la portada té marges laterals.

## [1.0.9] - 2026-10-25

### Corregit

- El xip de compte ara pren l'idioma detectat per cada pàgina; abans podia
  mostrar els textos en català amb la pàgina en castellà o anglés.

## [1.0.8] - 2026-10-25

### Afegit

- Xip de compte central d'EduTicTac i peu comú a la portada, l'entrada, el joc
  individual, la creació, el multijugador local i els lobbys d'amfitrió i
  d'alumnat. El selector d'idioma propi queda com a resposta si Commons no
  carrega.
- Declaració explícita d'UTF-8 a les pàgines que no la tenien.

### Canviat

- Traduccions que faltaven al peu de pàgina; el llistat públic d'activitats
  ara s'ordena per valoració.
- La música de la partida ara s'inicia automàticament, sense esperar que
  l'amfitrió prema «Comencem!».

## [1.0.7] - 2026-10-09

### Afegit

- Tipus de pregunta d'enquesta («opinió»), amb suport de puntuació parcial en
  preguntes de resposta múltiple.

### Canviat

- Les preguntes de resposta múltiple ara penalitzen les seleccions errònies,
  en lloc de només premiar les correctes.
- L'ordre aleatori de preguntes en el mode amfitrió ara ve desmarcat
  (desactivat) per defecte.

## [1.0.6]

Omesa. Mai es va publicar cap versió amb este número; `src/package.json` va
passar directament d'1.0.5 a 1.0.7.

## [1.0.5] - 2026-09-19

Lot de millores basat en feedback real d'ús a l'aula (Daniel Sàez Buedo
i el seu alumnat).

### Afegit

- Icones de forma (triangle, rombe, cercle, quadrat) en cada opció de
  resposta, dibuixades amb CSS pur (`clip-path`), per a distingir-les millor
  i per accessibilitat (daltonisme).
- Botó de pantalla completa en la vista del professor/amfitrió.
- Celebració quan tota la classe encerta una pregunta, i avís quan tota la
  classe la falla.
- Animació en revelar la insígnia de punts dobles en preguntes especials.
- Animació de canvis de posició en el rànquing entre preguntes.
- Correu de contacte afegit al peu de pàgina per a notificar problemes.

### Canviat

- La pantalla de pregunta ara es neteja a l'instant entre preguntes, sense
  restes de l'anterior.
- Els noms de jugador en multijugador ja poden tindre fins a 40 caràcters.
- La pantalla d'espera de l'amfitrió ara apareix immediatament en avançar a
  la pregunta següent.
- Miniatures SVG normalitzades; corregits diversos problemes de renderitzat
  i codificació SVG.
- Els camps de vídeo importats ara es validen abans d'utilitzar-se.

### Corregit

- L'informe de partida (Top 5 / `report.csv`) ja no perd jugadors després
  que acabe la partida.

### Seguretat

- Els informes de partida (`report.csv`) només els pot descarregar ara
  l'amfitrió real d'esa partida (abans s'acceptava qualsevol valor de
  `hostId` no buit).
- Els fitxers d'informe en disc ara es netegen de manera programada, en lloc
  de dependre només d'un temporitzador en memòria que es perdia en reiniciar
  el servidor.

## [1.0.4] - 2026-09-19

### Seguretat

- Inici de sessió SSO real amb Authentik: s'ha llevat el paràmetre forçat
  `prompt=login`, de manera que els usuaris que ja havien iniciat sessió ja
  no es veuen obligats a tornar a introduir les credencials cada vegada.

## [1.0.3] - 2026-09-18

### Afegit

- Importació del catàleg de qüestionaris compartit des d'EduTicTac Commons.

### Corregit

- El botó d'inici de sessió amb Google ara s'amaga quan l'OAuth de Google no
  està configurat en la instància.

## [1.0.2] - 2026-09-15

Imatge Docker: `registry.edutictac.es/edutictac/eduhoot:1.0.2` — el tag
passa del prototip `0.1.0` a seguir la versió del paquet Node; no calia
migrar la base `kahootDB`.

### Afegit

- Integració amb EduTicTac Commons 0.1.1-alpha.
- Selectors d'idioma separats per a català/valencià/castellà/anglès
  (CA/VA/ES/EN), amb la preferència persistent entre sessions.
- Inici de sessió amb Authentik només per a professorat.
- Catàleg d'EduHoot exposat al mòdul de Recursos.
- 29 proves unitàries/d'integració més 26 comprovacions de navegador
  (escriptori i mòbil), executades automàticament en cada push i pull
  request via GitHub Actions.

### Canviat

- Els enllaços amb `?lang=` ara respecten un canvi d'idioma manual posterior
  de l'usuari, també després de recarregar o en passar a l'editor.
- Dependències actualitzades; retirada la llibreria `expect`, substituïda
  per proves basades en `node:assert`.

### Corregit

- Diverses correccions de valencià en el creador de qüestionaris i en els
  textos del joc.

## [1.0.1] - 2026-03-26

### Afegit

- Suport per a Docker, més una plantilla/script de desplegament segur per a
  producció.
- Servei de producció propi d'EduHoot (unitat systemd), vinculat a loopback
  per a usar-se darrere d'un proxy invers.
- Integració amb EduTicTac Commons: inici de sessió amb identitat d'alumnat
  basada en Commons, consum de tokens de llançament de Commons en el mode
  Solo, enviament de puntuacions d'EduHoot a Commons, icones d'avatar de
  Commons en unir-se l'alumnat, i importació d'activitats públiques de
  demostració.
- El valencià (`va`) ara és una variant d'idioma pròpia, separada del
  català.
- Tipografies de Google allotjades localment (Raleway, Tajawal, Inter,
  Poppins).
- Informe de partida per a l'amfitrió: exportació a CSV dels resultats, amb
  resum de participants, detall per pregunta i la resposta correcta
  ressaltada.
- Temps límit per pregunta, amb opció de l'amfitrió per a sobreescriure'l.
- Compte arrere en la pantalla de l'alumnat/aula abans de començar la
  partida.
- Suport per a preguntes de punts dobles a l'estil Kahoot, amb avís en
  pantalla.
- Avís legal en importar un qüestionari de Kahoot; les imatges importades de
  Kahoot ara es copien a l'emmagatzematge local en lloc d'enllaçar-se en
  calent, més una eina d'administració per a migrar imatges importades
  prèviament.
- Suite de proves automatitzades (el test runner natiu de Node, més proves
  de navegador d'i18n amb Playwright).
- Enllaç a la política de privacitat, enllaç al codi font i avís de
  llicència AGPL-3.0 afegits al peu de pàgina.

### Canviat

- Llicència del projecte canviada de CC BY-SA 4.0 a AGPL-3.0.
- Metadades del qüestionari ampliades amb idioma, llicència i descripció,
  més una imatge de portada determinista.
- Les activitats ara es poden organitzar en carpetes per etiqueta; el
  filtrat per etiqueta ignora majúscules/minúscules i accents, també quan ve
  donat per un paràmetre `?tag=` en el mode Solo.
- Botó d'inici de sessió amb Google amagat quan l'OAuth de Google no està
  configurat; corregit el tractament de la capçalera host darrere d'un proxy
  invers i de la cookie d'estat OAuth.
- Eliminats noms d'amfitrió interns, noms d'usuari i la denominació antiga
  «llixhoot» d'scripts i missatges visibles.
- `node_modules` ja no es rastreja en git.

### Corregit

- Estabilitat de reconnexió WebSocket en el mode aula.
- Jugadors duplicats després d'una recàrrega de la sala provocada per un
  canvi d'idioma.
- Problemes de sincronització de puntuació entre la vista de jugador i el
  rànquing.
- Diversos problemes de text/puntuació en la importació de Kahoot.
- L'informe de partida en CSV retornava un 404 després de reiniciar el
  servidor.

### Seguretat

- Reforç general de l'autenticació i la gestió de sessions, i de l'entorn de
  stage.
- Capçalera `Cross-Origin-Resource-Policy` afegida als recursos estàtics.

## [1.0.0] - 2025-12-13 a 2026-03-26

> Reconstruïda només a alt nivell. Este període cobreix al voltant de 140
> commits de la fase inicial de prototip del projecte, la majoria amb
> missatges curts i poc descriptius (`pin`, `qr`, `gong`, `nick`...). La
> llista següent resumeix la base funcional assolida al final d'este període;
> no és un registre línia a línia.

### Afegit

- Prototip inicial d'EduHoot: interfície de creació de qüestionaris,
  partides multijugador a l'estil Kahoot amb unió per PIN/QR, i mode Solo
  (un sol jugador).
- Tipus de pregunta bàsics: resposta múltiple, vertader/fals, resposta
  curta/numèrica.
- Importació de qüestionaris de Kahoot (anònima) i exportació a Moodle.
- Base inicial d'internacionalització, amb cadenes de text editables.
- Instal·labilitat com a PWA i caché amb service worker.
- Emmagatzematge amb MongoDB.
- Generació d'imatges SVG assistida per IA per a preguntes; suport
  d'imatge/vídeo en preguntes.
- Estadístiques bàsiques de partides i modes de joc preferits.

[1.1.0]: https://github.com/Edutictac/EduHoot/compare/v1.0.13...v1.1.0
[1.0.7]: https://github.com/Edutictac/EduHoot/compare/v1.0.5...v1.0.7
[1.0.2]: https://github.com/Edutictac/EduHoot/releases/tag/v1.0.2
