# Changelog

Tots els canvis notables d'EduHoot es documenten en este fitxer.

El format es basa en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
i este projecte segueix, de manera flexible, el
[Versionat Semàntic](https://semver.org/).

Les versions de l'1.0.0 a l'1.0.7 són una reconstrucció retroactiva a partir
de l'historial de Git (missatges de commit i el camp `version` de
`src/package.json`), ja que este fitxer no existia abans d'ara. Quan ja
existia una nota `RELEASE-X.Y.Z.md` pròpia per a una versió (1.0.2, 1.0.5), el
seu contingut es resumeix ací i s'hi enllaça; el fitxer original es manté
intacte com la nota de versió més detallada.

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

Consulta també [RELEASE-1.0.5.md](RELEASE-1.0.5.md) per a la nota de versió
original, basada en feedback real d'ús a l'aula.

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

Consulta també [RELEASE-1.0.2.md](RELEASE-1.0.2.md) per a la nota de versió
original, amb les comprovacions i el tag d'imatge Docker.

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

[Sense publicar]: https://github.com/Edutictac/EduHoot/compare/v1.0.7...HEAD
[1.0.7]: https://github.com/Edutictac/EduHoot/compare/v1.0.5...v1.0.7
[1.0.2]: https://github.com/Edutictac/EduHoot/releases/tag/v1.0.2
