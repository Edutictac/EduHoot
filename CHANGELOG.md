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

## [1.2.0] - 2026-11-23

### Afegit
- **Flashcards: comprovació de respostes** («Comprobar respuestas», activada per defecte): l'alumnat contesta a la targeta (opció, text o número), es comprova i es marca sola com a sabuda o no sabuda. Passar sense comprovar compta com a no sabuda. El camp de resposta té nom accessible i el resultat s'anuncia als lectors de pantalla. Al final, resum amb les correctes, les incorrectes i les que cal repassar. En correspondència, cada element s'empareja amb una desplegable i es comprova que totes les parelles siguin correctes.
- **Deures asíncrons** (feature 1): el docent crea un deure des d'un quiz (botó 📚
  de la biblioteca) amb data límit, intents (1, 2, 3, 5 o il·limitats; compta el
  millor), temps per pregunta i opcions de resposta, i comparteix un enllaç
  (`/homework/?code=…`). L'alumnat entra sense compte, només amb un nom, i rep un
  **codi de recuperació** per a continuar des d'un altre dispositiu. Reutilitza el
  motor d'autoritme (`services/homework.js` sobre `services/selfPaced.js`): temps i
  puntuació els decidix el servidor, l'estat viu en MongoDB (col·leccions
  `homeworks` i `homeworkAttempts`) i es parla per HTTP (`/api/homework/:code/…`),
  sense sockets. Docent: llista, tancar/reobrir/ampliar el termini, eliminar,
  resultats per alumne i per pregunta i informe CSV (`/create/homework/`).
- **Mode autoritme** (feature 3) en «Jugar a l'aula»: en el lobby l'amfitrió
  tria «Al seu ritme» i cada alumne respon en el seu dispositiu, amb el seu
  propi rellotge, sense «Pregunta següent». El servidor porta l'estat i la
  puntuació de cada alumne (`services/selfPaced.js`,
  `sockets/selfPacedEvents.js`). Pantalles pròpies: `/player/self-paced/`
  (alumnat) i `/host/self-paced/` (progrés per alumne, expulsar i «Acabar
  partida» amb podi i informe CSV). El Top 10 (amfitrió en viu, alumne
  després de cada resultat) depén de la casella de puntuacions, com en el mode
  en directe. Lectura en veu alta i mà alçada en la pantalla de l'alumne. Qui
  entra tard comença en la primera pregunta. Peces comunes de l'alumnat en
  `js/playerCommon.js`. Per defecte continua el mode en directe.
- Nou tipus de pregunta **correspondència** (`matching`, feature 7,
  «emparellar»): fins a 8 elements entre parelles i impostores (només a la
  dreta). Puntuació parcial i proporcional, sense penalització. Funciona en
  l'editor, el CSV (columna `texto`: `a -> b | -> impostora`), «Jugar a
  l'aula», Solo, flashcards i multijugador local; s'exporta i s'importa en
  XML de Moodle i GIFT, i s'exporta a PDF, DOCX i ODT com a fitxa. En
  «Jugar a l'aula» a cegues, el professorat tria al lobby com respon el
  mòbil: tocs amb codis (per defecte), desplegables o pas a pas.
- Mode Solo: pausar, reprendre i cancel·lar la partida. La pausa congela el
  temps i tapa la pregunta; cancel·lar demana confirmació.
- Portada: en pantalles amples, els botons van en 2 columnes i ocupen la
  part de baix.
- `/dev/` (maquetes i proves de concepte: correspondència en
  `/dev/correspondencia/`, pantalla de l'amfitrió en `/dev/anfitrion/`):
  en desenvolupament, sense sessió; en stage, només amb rol admin; en
  producció, 404. `/dev/login` només existix en desenvolupament. Les
  maquetes es poden veure en ca, va, es i en (selector d'idioma o `?lang=`).
- Amfitrió (sala): caselles i botons d'opció més grans, sense els textos
  d'ajuda fixos (ara són tooltips); les opcions van en dos blocs, caselles i ajustos, amb
  títol; totes tenen un tooltip d'ajuda, també els controls de dalt de la
  partida. El títol del qüestionari ix en groc en la sala i en la partida de
  l'amfitrió, i també en les pantalles de l'alumnat.
- Correspondència: més temps (+25, +50, +75 o +100 %; per defecte +50 %),
  triat en la sala i canviable durant la partida.
- Portada: els botons no creixen en alt més del doble d'un botó normal.
- Pantalla completa a `/solo/` i «Jugar a l'aula»: la partida ocupa tota la
  finestra visible del navegador, en PC i en mòbil, amb un marge petit. La
  mida la llig `js/viewport-fit.js` (`visualViewport`), així que també
  s'adapta quan surt el teclat. Al mode individual s'oculta el peu de
  pàgina durante la partida.
- Lectura en veu alta de la pregunta i de les respostes (proposta 13), a
  «Jugar a l'aula» i a `/solo/`: un botó 🔊 a l'alumnat, a demanda, amb la
  síntesi de veu del propi navegador (sense serveis externs). No s'activa
  sol ni es llig en mode «a cegues». Provat amb navegadors automàtics; falta
  la prova en iPad i iPhone.
- La partida del mode individual (`/solo/`) té la mateixa estructura i
  grandàries que "Jugar a l'aula": franja amb el títol, el progrés i els
  punts, barra de temps i respostes grans amb forma i color, en 2x2 en
  l'ordinador i en una columna en el mòbil.
- El mode individual (`/solo/`) també mostra el compte arrere 3-2-1
  abans de cada pregunta, amb el mateix aspecte que "Jugar a l'aula".
- El CSV de preguntes d'un qüestionari es descarrega amb la data i l'hora
  en el nom (`<nom>-AAAAMMDD-HHMMSS.csv`), per a no confondre dos
  exportacions del mateix qüestionari.
- En el panell de logs, si hi ha més dels 100 més recents, la taula ho
  avisa i «Cargar más» mostra els següents, amb els mateixos filtres.
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
- Sala d'espera de l'alumnat: avatar i nom en gran, codi de la partida i
  nombre de jugadors en la sala, estat de la connexió i avís si no hi ha
  confirmació als 10 s. La pantalla no es bloqueja mentre s'espera.
- Partida: l'anfitrió pot pausar el temporitzador i ampliar-lo 15 s; veu
  per alumne si ha enviat la resposta, si ha alçat la mà i si és fora de la
  pestanya. L'alumnat pot alçar la mà.
- L'anfitrió pot expulsar un alumne (lobby i partida), amb confirmació en
  dos passos. L'alumne expulsat no pot tornar amb el mateix PIN fins que
  l'anfitrió li permeta l'entrada des de la llista d'expulsats del lobby.
- Nombres aleatoris per a l'alumnat: l'anfitrió pot triar que no escriguen
  el seu nom; reben un nom de la llista valenciana (una paraula, no es
  repeteix a la partida) i poden canviar-lo amb un dau.
- El panell de logs busca també per `hostId` i `playerId`.
- El distintiu d'entorn es veu al 50 % en les pantalles de partida de
  l'alumnat i de l'anfitrió.
- Alumnat: pot sortir de la partida amb un botó vermell flotant (baix a
  l'esquerra), amb confirmació. A l'anfitrió, qui ha sortit apareix a la
  mateixa llista d'estat que les respostes, amb el botó d'expulsar
  deshabilitat («Abandonó»), i no compta en el resum. Si torna, recupera el seu
  nom anterior sense poder triar-lo ni escriure'l; només pot triar de nou si és
  expulsat.
- Pantalla de l'anfitrió: «Saltar» i «Cancel·lar» a dalt de la pregunta; la
  llista d'alumnat i la d'expulsats, sota de les respostes; «Següent pregunta» i
  «Veure rànquing» com a botons de la fila superior; el botó de següent de la
  finestra de resultats queda fix a dalt.
- En prémer «Iniciar partida», el botó es bloqueja i apareix un avís mentre la
  partida arrenca. Si el servidor rebutja l'inici, el botó torna a estar disponible.
- Nombres aleatoris: el dau permet canviar el nom com a màxim 2 vegades per
  alumne i partida (el comptador és al navegador; el servidor no el comprova).
- Nom de l'alumnat al lobby: en groc i un 40 % més gran que el títol d'estat.
- Opció «Mostrar respuestas» al lobby (activada per defecte): si es desactiva,
  l'alumnat no rep la resposta correcta. El filtre és al servidor
  (`services/showAnswers.js`); l'anfitrió rep sempre el resultat complet.
- Resultat a l'alumnat: «Correcte» en groc sobre verd i «Incorrecte» en blanc
  sobre vermell, un 40 % més grans. La barra de temps s'amaga mentre es veu.
- Icona de l'alumnat assignada a l'atzar en validar el PIN (queda marcada).
- Portada i lobby de l'anfitrió: ample ajustat, text i botons centrats al 70 %
  a la portada, i opcions en 2 columnes al lobby.
- Pantalla de partida de l'anfitrió: «Puntuacions i rànquing» es pot canviar
  en qualsevol moment (el botó Top 10 s'amaga a l'instant). Saltar, Cancel·lar,
  Top 10 i Descarregar informe van a la mateixa fila, de la mateixa mida.
  En acabar: Cancel·lar passa a Tornar i torna a la biblioteca; s'amaguen
  l'avanç automàtic, la casella de puntuacions i els botons d'expulsar (es
  manté «Abandonament»). Les opcions de resposta van en 2 columnes en pantalla
  ampla i en 1 en mòbil.
- Lobby de l'anfitrió i unió de l'alumnat: el logo queda a l'esquerra i el QR a
  la dreta, alineats amb el recuadre d'opcions; el logo i «EduHoot» van en una
  línia a la unió, i en dev/stage la fila baixa el mateix alt que el distintiu.
- Ample del contingut a les pantalles d'entrada, anfitrió i alumnat: amb espai,
  un 10 % de marge a cada costat; en mòbil, un marge mínim de 12 px (`css/page-fit.css`).
- Avanç automàtic entre preguntas: desplegable al lobby i durant la partida
  («Manual» per defecte, o de 3 a 20 s; el mínim era de 5 s). Després de cada pas de resultats
  (gràfica, classificació) compta enrere i avança sol. Es pot pausar en
  qualsevol moment, també durant els resultats, i la compte enrere es veu a
  l'anfitrió i a l'alumnat.
- Durant la partida, l'anfitrió pot pausar-la (es congela el temps, no hi ha
  respostes ni avanç fins a reprendre-la) i cancel·lar-la, amb confirmació.
  Cancel·lar tanca la sala per a l'alumnat i torna a `/create/`.
- Opcions avançades al lobby: l'anfitrió pot ampliar, només per a la seua
  partida, el marge de reconnexió de l'anfitrió i de l'alumnat, el temps de
  neteja després de acabar i el d'inactivitat (fins a 60 min). Els valors
  normals no canvien.
- Racha de aciertos (ratxa d'encerts): a partir de la tercera resposta
  correcta seguida, +50 punts per resposta (tope +250). L'alumnat veu la seua
  racha; l'anfitrió la veu amb un 🔥 al costat del nom. Opció del lobby,
  activada per defecte; també al mode individual.
- Importació de qüestionaris en XML de Moodle, des de la mateixa pantalla
  que el CSV: opció múltiple, verdader/fals, resposta curta i numèrica. Les
  preguntes d'altres tipus (p. ex. redacció) s'ometen, i el docent veu quines
  s'han omès i el motiu.
- Importació de qüestionaris en GIFT de Moodle (fitxers `.gift`), amb els
  mateixos tipus que el XML: opció múltiple, verdader/fals, resposta curta i
  numèrica (també rangs). Les preguntes no admeses s'indiquen amb el motiu.
- Els fitxers `.txt` es detecten pel contingut: CSV de EduHoot, GIFT o XML de
  Moodle, sense que el docent haja d'indicar el format.

### Canviat

- **Biblioteca**: valoració amb estrelles (1 a 5) per als quizzes públics, igual que al mode solo; la mitjana i els vots es mostren a la targeta.
- **Flashcards**: el resum final va en una fila pròpia, a sota de la informació i de les opcions.
- **Biblioteca**: 6, 12, 24, 48 o 96 quizzes per pàgina (per defecte 6). Amb sessió, la paginació s'emmagatzema al compte de l'usuari (`/api/auth/preferences`); sense sessió, al navegador.
- **Partida**: el marge per a que el professorat reconnecte si es desconnecta passa de 30 s a 120 s per defecte, i es pot ampliar fins a 5 minuts a la configuració de la partida (abans el màxim era 120 s). Els clients del professorat reintenten la connexió durant més temps perquè el marge siga efectiu.
- **Flashcards**: les opcions de resposta tenen la forma i el color de les respostes del joc, en dues columnes sempre que hi càpien. La marca de les escollides és un anell i una ✓. La imatge de la pregunta va ara damunt de les opcions en pantalla estreta; en pantalla ampla, les opcions van centrades si no hi ha imatge i a la dreta de la imatge si n'hi ha. En correspondència, amb la casella «Mostrar opcions de resposta» activada, l'anvers mostra les dues columnes en una taula sense vores (la dreta barajada). En vertader/fals amb imatge, les opcions van una sota l'altra. En preguntes de quiz (1 correcta) i de resposta múltiple, les opcions van sempre en dues columnes (2×2 amb quatre): al costat de la imatge si la pantalla és ampla, i sota la imatge si no. Si una paraula no cap en el botó, les opcions passen a una columna i la targeta creix en alçada per encabir-les. En vertader/fals, els dos botons tenen la mateixa amplària (la del text més llarg) i les etiquetes es mostren traduïdes a l'idioma de la interfície.
- **Biblioteca**: cada quiz mostra la data de creació i la de la darrera modificació, en una línia discreta sota les estadístiques.
- **Biblioteca**: el paginador també apareix damunt de les targetes, i hi ha un selector de qüestionaris per pàgina (5, 10, 20, 30, 50 o 100; 10 per defecte; 5 és útil en mòbil) que es recorda al navegador. Els botons de pàgina s'amaguen si hi ha una sola pàgina, però el selector continua.
- **Solo**: nou botó «Passar» (entre «Pausar» i «Cancel·lar la partida») per a saltar a la pregunta següent sense respondre: no suma punts ni encerts, talla la ratxa i no mostra la finestra de resultat. Es pot usar mentre corre el temps o el compte enrere, no en pausa.
- **Quiz-creator**: una barra fixa a la part inferior amb només els botons (Guardar, Jugar sense guardar, Cancel·lar) apareix quan no es veu ni el bloc de dalt ni el de baix; s'amaga mentre s'escriu amb teclat virtual (pantalles tàctils) i en mòbil els botons són compactes, només amb icona.
- **Quiz-creator**: l'avís de connexió en temps real i l'error en carregar un quiz per a editar-lo es mostren traduïts (es, en, ca, va); s'han eliminat estils CSS sense ús d'una finestra antiga d'importació.
- **Registre (admin)**: els logs relacionats amb un quiz guarden ara el seu nom i identificador; el botó «Ver» els mostra («Nom (id)»). Els logs antics amb identificador resolen el nom actual si el quiz encara existeix, i si no, mostren només l'id. També es pot cercar per nom i l'exportació inclou les columnes `quizId` i `quizName`.
- **Quiz-creator**: el bloc de botons («Guardar», «Jugar sin guardar», «Cancelar») i el seu text informatiu es repeteix damunt de les preguntes, idèntic al de baix.
- **Biblioteca**: en importar un qüestionari des d'un fitxer, a més de «Jugar» s'ofereix «Editar qüestionari», amb la tipografia de la pàgina (també en els botons d'IA i Kahoot).
- **Solo**: en acabar cada pregunta (encert, encert parcial o errada) s'obri una finestra al centre amb el resultat («✓», «◐» o «✕»; botó verd, taronja o roig). Mostra una barra i els segons que queden, i es tanca sola als segons indicats (5 per defecte, configurable de 1 a 30 al formulari d'inici i recordat al navegador) o abans amb «OK»; les enquestes no la mostren.
- **Solo**: si s'arriba des de la biblioteca (enllaç amb `from=library`), la part superior mostra els botons «Inici» i «Biblioteca»; si s'arriba des d'Inici, només «Inici».
- **Solo i Flashcards (pantalla de joc)**: els botons i camps usen la mateixa tipografia (Inter) que la resta de la pantalla, en lloc de la per defecte del navegador.
- **Flashcards**: botons de la targeta amb colors propis: «No la sé» en roig, «Anterior» i «Següent» en grocs corporatius, «Mostrar resposta» en blanc amb text rosa i «Ocultar resposta» al revés, en rosa amb text blanc (text amb contrast ≥ 4,5:1).
- **Biblioteca**: la casella «Només els meus qüestionaris» es recorda durant la sessió del navegador (en recarregar o tornar d'editar o jugar); en iniciar sessió continua marcada per defecte, i en tancar-la s'oblida.
- **Accessibilitat (respostes)**: el text blanc dels botons de resposta (alumnat, anfitrió i Solo) i de les barres de resultats té un contrast de com a mínim 4,5:1 (colors més foscos). En Solo, la resposta encertada i la fallada es marquen també amb «✓» i «✕», no només amb el color de la vora.
- **Preferències (biblioteca)**: el quadre té fons opac, nom accessible, espai per al botó «Tancar», la casella «Reemplaçar tot» alineada amb el text, i queda per baix del distintiu DEV/STAGE; en tancar, el focus torna al botó «Preferències».
- **Deures (docent)**: el requadre principal té l'ample de Solo i Flashcards (70 % en pantalles grans, més ample en estrényer-se, 5 % de marge en mòbil); el formulari de nou deure va en dos columnes en pantalles amples. «Biblioteca» i el títol queden al costat esquerre del requadre; el xip de compte i «Mis deberes», al dret.
- **Solo i Flashcards**: el requadre principal baixa uns píxels perquè no s'arrime al xip de compte (amb els distintius DEV/STAGE ocults).
- **Create**: en guardar els permisos automàticament, el check «✓» es veu 3 segons.
- **Sala d'espera de l'alumne**: avís «La partida començarà aviat, mantín-te atent/a!» (en els quatre idiomes). **Lobby de l'amfitrió**: el PIN es dibuixa més gran.
- **Música de l'amfitrió**: en acabar, cancel·lar o tancar una partida «Al seu ritme» (vista incrustada al lobby), la música de la sala s'atura i l'eixida es fa a la finestra principal; en cancel·lar des del lobby també s'atura.
- **Lobby de l'amfitrió**: per davall de 1200 px el logo, el PIN i el QR van centrats en una sola columna (abans, entre 720 i 1200 px, el QR quedava a l'esquerra).
- **Solo**: la música de fons es pausa en pausar la partida (i torna en reprendre si sonava) i s'atura en cancel·lar-la. Amb els distintius DEV/STAGE ocults, la targeta de la portada deixa un xicotet buit sobre el peu comú.
- Botons de tornada: ara diuen on porten. «Inici» (biblioteca, Solo,
  Multijugador i entrada de l'alumnat) i «Biblioteca» (editor de
  qüestionaris, deures del docent i final de la partida de l'amfitrió), en
  lloc de «Tornar» a seques.
- Distintius DEV i STAGE: en la segona línia, l'usuari actual a l'esquerra
  (en tots dos entorns) i l'ample × alt de la finestra a la dreta (s'actualitza
  només en redimensionar; en stage, l'etiqueta de la imatge va davall) i es poden ocultar i mostrar amb **F9**
  (o **Alt+B**) per a veure com queda tot en producció; l'elecció es recorda
  entre pantalles.
- Solo i Flashcards (inici): si el quiz té imatge, el logo ix xicotet al seu
  costat; si no, ix gran, com en el llistat de quizzes. Deures del docent: el
  logo va junt al títol «Els meus deures».
- Biblioteca (`/create/`): el logo d'EduHoot va davant del títol «Crea i llança
  el teu EduHoot».
- Deures: el temps per pregunta pot arribar als **180 s** (3 minuts); amb
  diversos intents, el docent tria si compta el **millor intent** (per defecte)
  la **mitjana**, el **primer** o l'**últim** intent (`options.attemptScoring`: `best`, `average`, `first`, `last`); l'alumnat veu «Mitjana dels teus
  intents» i els resultats parlen de «Puntuació mitjana». La pantalla
  d'assignació queda centrada, el botó «Tornar a la biblioteca» passa a dir-se
  «Tornar» i hi ha un enllaç a «Els meus deures».
- Flashcards: la pantalla d'entrada s'assembla a la d'inici de Solo (dues
  columnes, logo i imatge del quiz) amb tons rosats foscos.
- `/solo/`: el compte arrere 3-2-1 de la partida queda centrat en vertical en
  l'espai lliure.
- Panell de deures del docent (`/create/homework/`): corregida la maquetació
  (en l'ordinador el panell s'encongia al seu contingut i el text eixia del
  recuadre; en el mòbil els resultats es tallaven pels costats). Ara té el
  fons blau, targetes blaves fosques, títols en groc, controls en píndola,
  els botons de cada deure en una sola fila i el mateix marge lateral que la
  biblioteca. La taula d'alumnes s'ordena en prémer l'encapçalament.
- L'entrada de l'alumnat als deures és ara una app de Vue (abans, HTML estàtic
  i DOM a mà) amb el logo, una targeta amb el títol, la data límit i els
  intents, i el camp del nom en píndola. Durant el deure es veu «Intent 2 de
  3» (i «Últim intent»).
- Alumnat «Al seu ritme» i deures: les respostes tornen a ser blocs grans (eren
  tires primes), la capçalera i les respostes tenen el mateix ample, i el
  resum final és una targeta amb la puntuació en gran i la barra d'encerts.
- Alumnat en l'aula: les pantalles intermèdies («Resposta enviada», resultat,
  «Partida acabada») duen una icona gran i una línia de detall (punts guanyats
  en la pregunta, puntuació final, o l'avís que el professorat comentarà la
  resposta quan no es mostra). La capçalera és més compacta en el mòbil, i
  «Eixir» i «Alçar la mà» reserven el seu espai a baix: ja no tapen la
  quarta resposta.
- Sala d'espera de l'amfitrió: en una finestra estreta, el logo, el PIN i el
  QR es mostren en una columna centrada (abans, el QR quedava a l'esquerra).
- `/solo/`: l'inici té dos columnes (imatge i dades a l'esquerra, opcions a la
  dreta), les imatges del catàleg són més baixes i, en la partida, el logo
  va dins de la franja del títol en lloc d'una fila pròpia.
- Biblioteca (`/create/`) redissenyada: els botons de cada quiz van en l'orde
  Jugar, Solo, Flashcards, Multijugador, Deures, CSV, Moodle, Editar, Clonar i
  Eliminar; el botó «Jugar a l'aula» passa a dir-se **«Jugar»** (també en
  els botons que apareixen en importar o generar un quiz). Els recuadres
  tenen el mateix marge lateral que la portada (10 % de l'ample) i mostren
  els quizzes en 1, 2 o 3 columnes segons l'ample; targetes amb vora blanca i
  títols en el groc del logo, títols de secció en groc suau i controls
  (filtres, ordre, etiquetes, formularis) amb l'estil de píndola fosca.
- Els permisos d'un quiz (visibilitat i clonació) es **guarden sols** en
  canviar-los: desapareix el botó «Desar permisos». Si el servidor els
  rebutja, es torna al valor anterior.
- El xip de compte, «Tornar» i el distintiu DEV/STAGE s'alineen amb el
  recuadre inferior en la portada, `/create/` i `/solo/`; el distintiu ja no
  tapa cap text en carregar la pàgina.
- `/solo/` redissenyada sense canviar els colors: logo d'EduHoot sota el
  títol del quiz amb la seua imatge representativa, controls i botons amb la
  seua amplada natural, i panell del 70 % de l'ample de la finestra en
  pantalles grans que s'eixampla fins al 90 % en el mòbil.
- L'encert parcial es mostra en taronja (abans àmbar o verd) en tots els
  modes i tipus de pregunta.
- Els textos d'importació de cuestionaris ja no parlen només de CSV: diuen
  «fitxer» i accepten CSV o XML de Moodle.
- La casella «Puntuacions entre preguntes i ranking» també controla el Top 10
  de l'alumnat i el podi final: desmarcada, no es mostra la posició ni el
  ranking.
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
- **Privacitat**: un quiz privat només es llegeix, es descarrega o s'inicia una partida amb ell des del seu dueño, l'administració o el dispositiu que el va crear (abans, qualsevol podia llegir-lo per id). Els públics i els per enllaç segueixen igual. Els quizzes locals del dispositiu reben una cookie `eduh_owner`.
- **Autoritme**: en reconnectar l'anfitrió, una partida ja acabada no es reobri.
- Flashcards: el anverso de les preguntes de resposta única i de vertader/fals
  no mostrava les opcions. Ara hi ha una casella a l'inici, «Mostrar opcions de
  resposta» (activada per defecte, guardada al dispositiu), que les mostra o
  les oculta en totes les preguntes de opcions.
- En reconnectar-se a mitja pregunta, l'alumnat rebia la pregunta completa
  encara que l'amfitrió haguera triat el mode a cegues.
- El text llarg sense espais (enunciats, respostes, finestres de correcció)
  ja no se n'ix del seu requadre.
- Mode Solo: «Tornar» s'estirava a tot l'ample durant la partida.
- La sala d'espera de l'alumnat tradueix els missatges de connexió i de
  reconnexió, que quedaven en castellà en canviar d'idioma.
- En "Jugar a l'aula", en el mòbil la barra de temps de l'alumnat es
  quedava sense alçada i quasi no es veia.
- En "Jugar a l'aula", dos alumnes podien unir-se a la mateixa partida
  amb el mateix nom. Ara el segon rep l'avís «Ese nombre ya está en uso en
  esta partida. Elige otro.» i en tria un altre (issue #28).
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

[1.2.0]: https://github.com/Edutictac/EduHoot/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Edutictac/EduHoot/compare/v1.0.13...v1.1.0
[1.0.7]: https://github.com/Edutictac/EduHoot/compare/v1.0.5...v1.0.7
[1.0.2]: https://github.com/Edutictac/EduHoot/releases/tag/v1.0.2
