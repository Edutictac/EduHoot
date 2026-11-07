#!/usr/bin/env node

const { MongoClient } = require('mongodb');

const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/';
const dbName = process.env.MONGO_DB || 'kahootDB';
const remove = process.argv.includes('--remove') || process.env.REMOVE === '1';
const STAGE_SEED_KEY_PREFIX = 'eduhoot-seed-stage-';

const GLOBAL_OWNER_ID = 'global-anon-owner';
const GLOBAL_OWNER_EMAIL = 'anon@local';

function quizDefaults(devSeedKey, name, tags) {
  return {
    devSeedKey,
    name,
    tags,
    language: '',
    license: '',
    description: '',
    visibility: 'public',
    allowClone: true,
    playsCount: 0,
    playersCount: 0,
    ownerId: GLOBAL_OWNER_ID,
    ownerEmail: GLOBAL_OWNER_EMAIL,
    ownerNickname: '',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function quizQuestion({ question, answers, correct, correctAnswers, type = 'quiz', time = 20, acceptedAnswers, numericAnswer, tolerance }) {
  const base = {
    question,
    answers: answers || ['', '', '', ''],
    correct: correct || 1,
    correctAnswers: correctAnswers || (correct ? [correct] : []),
    type,
    time,
    pointsMultiplier: 1,
    image: '',
    video: ''
  };
  if (type === 'short-answer') {
    base.acceptedAnswers = acceptedAnswers || [];
  }
  if (type === 'numeric') {
    base.numericAnswer = numericAnswer ?? null;
    base.tolerance = tolerance || 0;
  }
  if (type === 'poll') {
    base.correct = 1;
    base.correctAnswers = [];
  }
  return base;
}

const TF = ['Veritat', 'Mentida', '', ''];

const SAMPLE_QUIZZES = [
  // --- Música, primària (1-4) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}1`, 'Música: instruments bàsics', ['primaria', 'musica']),
    questions: [
      quizQuestion({ question: 'Quin instrument es toca pinçant les cordes amb els dits?', answers: ['Guitarra', 'Flauta', 'Tambor', 'Trompeta'], correct: 1 }),
      quizQuestion({ question: 'El tambor és un instrument de percussió.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’aquests instruments són de corda?', answers: ['Violí', 'Tambor', 'Guitarra', 'Flauta'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'El piano es toca amb un arc, com el violí.', answers: TF, correct: 2, type: 'true-false' }),
      quizQuestion({ question: 'Quina veu infantil és, en general, la més aguda?', answers: ['Tiple', 'Baix', 'Tenor', 'Contralt'], correct: 1 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}2`, 'Música: el ritme', ['primaria', 'musica']),
    questions: [
      quizQuestion({ question: 'El ritme és la part de la música relacionada amb el temps.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quina d’aquestes figures musicals dura més temps?', answers: ['Negra', 'Blanca', 'Corxera', 'Semicorxera'], correct: 2 }),
      quizQuestion({ question: 'Quins d’aquests són instruments de percussió?', answers: ['Tambor', 'Violí', 'Xilòfon', 'Flauta'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Aplaudir seguint una cançó és una manera de treballar el ritme.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quin d’aquests és un instrument de vent?', answers: ['Flauta', 'Guitarra', 'Piano', 'Tambor'], correct: 1 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}3`, 'Música: cançons i veu', ['primaria', 'musica']),
    questions: [
      quizQuestion({ question: 'Cantar en grup es diu cantar en cor.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es diu la persona que dirigix un cor o una orquestra?', answers: ['Director', 'Compositor', 'Cantant', 'Oient'], correct: 1 }),
      quizQuestion({ question: 'Com es diu la part d’una cançó que es repetix sovint?', type: 'short-answer', acceptedAnswers: ['tornada', 'estribillo', 'estribill'] }),
      quizQuestion({ question: 'Quines d’aquestes són maneres de fer música amb el cos?', answers: ['Aplaudir', 'Picar de peus', 'Xiular', 'Conduir'], type: 'multiple', correctAnswers: [1, 2, 3], correct: 1 }),
      quizQuestion({ question: 'Xiuxiuejar és el mateix que cantar fort.', answers: TF, correct: 2, type: 'true-false' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}4`, 'Música: sons de l’entorn', ['primaria', 'musica']),
    questions: [
      quizQuestion({ question: 'Quin d’aquests sons sol ser agut?', answers: ['Xiulet', 'Tro', 'Terratrèmol', 'Trontoll'], correct: 1 }),
      quizQuestion({ question: 'Tots els sons tenen la mateixa intensitat.', answers: TF, correct: 2, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’aquests són sons de la natura?', answers: ['Pluja', 'Trons', 'Clàxon', 'Vent'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Quin tipus de música t’agrada més escoltar?', answers: ['Pop', 'Clàssica', 'Flamenc', 'Altres'], type: 'poll' }),
      quizQuestion({ question: 'Com s’anomena un so molt fort i sobtat?', answers: ['Soroll', 'Silenci', 'Melodia', 'Harmonia'], correct: 1 })
    ]
  },
  // --- Música, secundària (5-8) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}5`, 'Música: elements del llenguatge musical', ['secundaria', 'musica']),
    questions: [
      quizQuestion({ question: 'Quantes línies té un pentagrama?', answers: ['4', '5', '6', '7'], correct: 2 }),
      quizQuestion({ question: 'La clau de sol se situa en la segona línia del pentagrama.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es diu el conjunt ordenat de set notes musicals consecutives?', type: 'short-answer', acceptedAnswers: ['escala'] }),
      quizQuestion({ question: 'Quines d’aquestes són figures musicals?', answers: ['Negra', 'Corxera', 'Compàs', 'Blanca'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'En un compàs de 4/4, quantes negres caben en cada compàs?', type: 'numeric', numericAnswer: 4 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}6`, 'Música: història i estils', ['secundaria', 'musica']),
    questions: [
      quizQuestion({ question: 'A quin període pertany Mozart?', answers: ['Clàssic', 'Barroc', 'Romàntic', 'Modern'], correct: 1 }),
      quizQuestion({ question: 'El jazz va nàixer als Estats Units.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es diu el període musical en què va destacar Bach?', type: 'short-answer', acceptedAnswers: ['barroc'] }),
      quizQuestion({ question: 'Quins d’aquests estils es consideren música popular urbana?', answers: ['Hip-hop', 'Òpera', 'Reggaeton', 'Simfonia'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Quin instrument és típic del flamenc?', answers: ['Guitarra espanyola', 'Arpa', 'Oboè', 'Tuba'], correct: 1 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}7`, 'Música: instruments i famílies', ['secundaria', 'musica']),
    questions: [
      quizQuestion({ question: 'Quins instruments pertanyen a la família de corda?', answers: ['Violí', 'Violoncel', 'Trompeta', 'Contrabaix'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'El saxofon és un instrument de vent-metall.', answers: TF, correct: 2, type: 'true-false' }),
      quizQuestion({ question: 'Quants integrants sol tindre un quartet de corda?', answers: ['2', '3', '4', '5'], correct: 3 }),
      quizQuestion({ question: 'Com es diu la persona que marca el tempo amb la batuta?', type: 'short-answer', acceptedAnswers: ['director'] }),
      quizQuestion({ question: 'Si una orquestra té 60 músics i un terç toca corda, quants músics toquen corda?', type: 'numeric', numericAnswer: 20 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}8`, 'Música: tecnologia i producció', ['secundaria', 'musica']),
    questions: [
      quizQuestion({ question: 'Un sintetitzador pot imitar el so d’altres instruments.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quin format d’àudio es comprimix amb pèrdua de qualitat?', answers: ['MP3', 'WAV', 'FLAC', 'AIFF'], correct: 1 }),
      quizQuestion({ question: 'Quins programes s’usen per a produir música digitalment?', answers: ['Editor d’àudio (DAW)', 'Full de càlcul', 'Seqüenciador MIDI', 'Navegador web'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Com s’anomena l’equip que amplifica el so en un concert?', type: 'short-answer', acceptedAnswers: ['altaveu', 'altaveus', 'amplificador'] }),
      quizQuestion({ question: 'Quina ferramenta prefereixes per a crear música?', answers: ['Instrument acústic', 'Ordinador/DAW', 'Veu', 'Altres'], type: 'poll' })
    ]
  },
  // --- Informàtica, secundària (9-18) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}9`, 'Informàtica: maquinari bàsic', ['secundaria', 'informatica']),
    questions: [
      quizQuestion({ question: 'Quin és l’acrònim de "Unitat Central de Processament"?', type: 'short-answer', acceptedAnswers: ['CPU', 'cpu'] }),
      quizQuestion({ question: 'El disc dur emmagatzema dades de manera permanent.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’aquests són dispositius d’entrada?', answers: ['Teclat', 'Impressora', 'Ratolí', 'Monitor'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Quina unitat mesura la velocitat d’un processador?', answers: ['Hertz', 'Litres', 'Watts', 'Metres'], correct: 1 }),
      quizQuestion({ question: 'Quants bytes té un kilobyte, en binari (2^10)?', type: 'numeric', numericAnswer: 1024 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}10`, 'Informàtica: programari i sistemes operatius', ['secundaria', 'informatica']),
    questions: [
      quizQuestion({ question: 'Quin d’aquests és un sistema operatiu?', answers: ['Windows', 'Word', 'Excel', 'Chrome'], correct: 1 }),
      quizQuestion({ question: 'Linux és un sistema operatiu de codi obert.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’estos són exemples de programari ofimàtic?', answers: ['Processador de text', 'Full de càlcul', 'Sistema operatiu', 'Presentacions'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Com es diu el programa que permet navegar per internet?', type: 'short-answer', acceptedAnswers: ['navegador'] }),
      quizQuestion({ question: 'Quin d’aquests és un sistema operatiu mòbil?', answers: ['Android', 'Photoshop', 'Spotify', 'Zoom'], correct: 1 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}11`, 'Informàtica: xarxes i internet', ['secundaria', 'informatica']),
    questions: [
      quizQuestion({ question: 'Com es diu el sistema que trasllada noms de domini a adreces IP?', type: 'short-answer', acceptedAnswers: ['DNS', 'dns'] }),
      quizQuestion({ question: 'El Wi-Fi permet connectar-se a internet sense cables.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Què vol dir la sigla "URL"?', answers: ['Localitzador uniforme de recursos', 'Unitat de registre lògic', 'Llenguatge unificat de xarxa', 'Protocol d’usuari remot'], correct: 1 }),
      quizQuestion({ question: 'Quins d’aquests són navegadors web?', answers: ['Chrome', 'Firefox', 'Windows', 'Edge'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Quants grups de números té una adreça IPv4?', type: 'numeric', numericAnswer: 4 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}12`, 'Informàtica: seguretat digital', ['secundaria', 'informatica']),
    questions: [
      quizQuestion({ question: 'Quin terme designa un programa maliciós?', type: 'short-answer', acceptedAnswers: ['malware', 'virus'] }),
      quizQuestion({ question: 'Usar la mateixa contrasenya en tots els llocs és segur.', answers: TF, correct: 2, type: 'true-false' }),
      quizQuestion({ question: 'Quines són bones pràctiques de seguretat digital?', answers: ['Contrasenyes fortes', 'Compartir la contrasenya', 'Verificació en dos passos', 'Clicar en qualsevol enllaç'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Com es diu l’intent d’enganyar algú per a robar-li dades per correu?', answers: ['Phishing', 'Backup', 'Streaming', 'Hosting'], correct: 1 }),
      quizQuestion({ question: 'Com protegixes normalment els teus comptes?', answers: ['Contrasenya forta', 'Verificació en dos passos', 'Gestor de contrasenyes', 'No em preocupa'], type: 'poll' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}13`, 'Informàtica: programació bàsica', ['secundaria', 'informatica']),
    questions: [
      quizQuestion({ question: 'Quin d’aquests és un llenguatge de programació?', answers: ['Python', 'HTML pur', 'Excel', 'Word'], correct: 1 }),
      quizQuestion({ question: 'Un algorisme és una sèrie de passos per a resoldre un problema.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es diu l’error en un programa que impedix que funcione bé?', type: 'short-answer', acceptedAnswers: ['bug', 'error'] }),
      quizQuestion({ question: 'Quines d’aquestes són estructures de control en programació?', answers: ['Bucle', 'Condicional', 'Base de dades', 'Variable'], type: 'multiple', correctAnswers: [1, 2], correct: 1 }),
      quizQuestion({ question: 'En la majoria de llenguatges, quin és el primer índex d’un vector/array?', type: 'numeric', numericAnswer: 0 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}14`, 'Informàtica: internet i la web', ['secundaria', 'informatica']),
    questions: [
      quizQuestion({ question: 'Quin llenguatge s’usa típicament per a donar estil a una pàgina web?', type: 'short-answer', acceptedAnswers: ['CSS', 'css'] }),
      quizQuestion({ question: 'HTML és el llenguatge que definix l’estructura d’una pàgina web.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Què signifiquen les sigles "HTTP"?', answers: ['Protocol de transferència d’hipertext', 'Alt rendiment de xarxa', 'Programa de text d’hipervincles', 'Transferència de dades personals'], correct: 1 }),
      quizQuestion({ question: 'Quins d’aquests elements poden formar part d’una pàgina web?', answers: ['Text', 'Imatges', 'Vídeos', 'Discos durs'], type: 'multiple', correctAnswers: [1, 2, 3], correct: 1 }),
      quizQuestion({ question: 'Quin navegador uses més sovint?', answers: ['Chrome', 'Firefox', 'Safari', 'Altres'], type: 'poll' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}15`, 'Informàtica: emmagatzematge i dades', ['secundaria', 'informatica']),
    questions: [
      quizQuestion({ question: 'Com es diu la memòria que es perd en apagar l’ordinador?', type: 'short-answer', acceptedAnswers: ['RAM', 'ram'] }),
      quizQuestion({ question: 'El núvol (cloud) permet guardar dades en servidors d’internet.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quina d’aquestes unitats és més gran?', answers: ['1 GB', '1 MB', '1 KB', '1 byte'], correct: 1 }),
      quizQuestion({ question: 'Quins són dispositius d’emmagatzematge?', answers: ['Disc dur', 'Memòria USB', 'Targeta gràfica', 'SSD'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Quants bits formen un byte?', type: 'numeric', numericAnswer: 8 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}16`, 'Informàtica: ofimàtica i productivitat', ['secundaria', 'informatica']),
    questions: [
      quizQuestion({ question: 'Quin programa s’usa típicament per a fer fulls de càlcul?', answers: ['Excel', 'Word', 'Paint', 'Reproductor de vídeo'], correct: 1 }),
      quizQuestion({ question: 'Es pot fer una presentació de diapositives amb PowerPoint.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quines accions es poden fer en un processador de text?', answers: ['Escriure text', 'Canviar la font', 'Editar vídeo', 'Corregir ortografia'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Com es diu la combinació de tecles habitual per a copiar un text?', type: 'short-answer', acceptedAnswers: ['Ctrl+C', 'ctrl+c'] }),
      quizQuestion({ question: 'Quina ferramenta ofimàtica uses més sovint?', answers: ['Processador de text', 'Full de càlcul', 'Presentacions', 'Correu electrònic'], type: 'poll' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}17`, 'Informàtica: intel·ligència artificial', ['secundaria', 'informatica']),
    questions: [
      quizQuestion({ question: 'La intel·ligència artificial pot aprendre patrons a partir de dades.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quin d’aquests és un exemple d’ús de la IA?', answers: ['Reconeixement de veu', 'Tallar amb tisores', 'Regar una planta', 'Pintar una paret'], correct: 1 }),
      quizQuestion({ question: 'Com es diu el camp de la IA centrat en aprendre a partir de dades?', type: 'short-answer', acceptedAnswers: ['aprenentatge automàtic', 'machine learning'] }),
      quizQuestion({ question: 'Quins d’aquests són usos habituals de la IA hui en dia?', answers: ['Traductors automàtics', 'Recomanacions de vídeos', 'Reparar una bici', 'Assistents de veu'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Com valores l’ús de la IA en l’educació?', answers: ['Molt útil', 'Útil amb precaucions', 'Poc útil', 'No ho sé'], type: 'poll' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}18`, 'Informàtica: ètica i ús responsable', ['secundaria', 'informatica']),
    questions: [
      quizQuestion({ question: 'Compartir contingut sense permís de l’autor pot vulnerar drets d’autor.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com s’anomena la petjada que deixem a internet amb la nostra activitat?', answers: ['Petjada digital', 'Petjada de carboni', 'Petjada dactilar', 'Petjada ecològica'], correct: 1 }),
      quizQuestion({ question: 'Quines pràctiques formen part d’un bon ús d’internet?', answers: ['Respectar la privacitat dels altres', 'Difondre rumors falsos', 'Citar les fonts', 'Ciberassetjar'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Com s’anomena assetjar algú a través d’internet o les xarxes socials?', type: 'short-answer', acceptedAnswers: ['ciberassetjament', 'ciberbullying'] }),
      quizQuestion({ question: 'Si veus un bulo a internet, què fas normalment?', answers: ['El comparteixo igual', 'No el comparteixo i l’ignoro', 'Verifico la font abans', 'Ho denuncio'], type: 'poll' })
    ]
  },
  // --- Matemàtiques, primària (19-21) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}19`, 'Matemàtiques: sumes i restes', ['primaria', 'matematiques']),
    questions: [
      quizQuestion({ question: 'Quant és 12 + 7?', type: 'numeric', numericAnswer: 19 }),
      quizQuestion({ question: 'Quant és 20 - 8?', type: 'numeric', numericAnswer: 12 }),
      quizQuestion({ question: 'Quin és el resultat de 5 + 5 + 5?', answers: ['15', '10', '20', '25'], correct: 1 }),
      quizQuestion({ question: 'Restar és el contrari de sumar.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quant és 9 + 9?', type: 'numeric', numericAnswer: 18 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}20`, 'Matemàtiques: multiplicar i dividir', ['primaria', 'matematiques']),
    questions: [
      quizQuestion({ question: 'Quant és 9 x 6?', type: 'numeric', numericAnswer: 54 }),
      quizQuestion({ question: 'Quant és 100 / 4?', type: 'numeric', numericAnswer: 25 }),
      quizQuestion({ question: 'Quant és 2 x 3?', answers: ['6', '4', '8', '5'], correct: 1 }),
      quizQuestion({ question: 'Dividir és repartir en parts iguals.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quant és 7 x 8?', type: 'numeric', numericAnswer: 56 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}21`, 'Matemàtiques: figures geomètriques', ['primaria', 'matematiques']),
    questions: [
      quizQuestion({ question: 'Quants costats té un triangle?', answers: ['3', '4', '5', '6'], correct: 1 }),
      quizQuestion({ question: 'Un quadrat té els quatre costats iguals.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quines d’estes figures tenen quatre costats?', answers: ['Quadrat', 'Triangle', 'Rectangle', 'Cercle'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Quants costats té un pentàgon?', type: 'numeric', numericAnswer: 5 }),
      quizQuestion({ question: 'Quina figura no té costats rectes?', answers: ['Cercle', 'Triangle', 'Quadrat', 'Rectangle'], correct: 1 })
    ]
  },
  // --- Llengua Valenciana, primària (22-24) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}22`, 'Llengua: les lletres i les paraules', ['primaria', 'llengua-valenciana']),
    questions: [
      quizQuestion({ question: 'Quantes vocals té l’alfabet valencià?', answers: ['5', '6', '7', '4'], correct: 1 }),
      quizQuestion({ question: '"Casa" és un nom.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es diu la paraula que indica una acció, com "córrer" o "menjar"?', type: 'short-answer', acceptedAnswers: ['verb'] }),
      quizQuestion({ question: 'Quines d’estes paraules són noms?', answers: ['Gos', 'Córrer', 'Taula', 'Ràpid'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Les preguntes sempre acaben amb un punt.', answers: TF, correct: 2, type: 'true-false' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}23`, 'Llengua: lectura i comprensió', ['primaria', 'llengua-valenciana']),
    questions: [
      quizQuestion({ question: 'Llegir en veu alta ajuda a millorar la pronunciació.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es diu la part d’un conte on comencen els fets?', answers: ['Introducció', 'Conclusió', 'Índex', 'Pròleg'], correct: 1 }),
      quizQuestion({ question: 'Com s’anomena la persona que escriu un llibre?', type: 'short-answer', acceptedAnswers: ['autor', 'escriptor'] }),
      quizQuestion({ question: 'Quins d’estos són tipus de textos?', answers: ['Conte', 'Notícia', 'Poema', 'Partitura'], type: 'multiple', correctAnswers: [1, 2, 3], correct: 1 }),
      quizQuestion({ question: 'Quin tipus de llibre t’agrada més llegir?', answers: ['Aventures', 'Misteri', 'Humor', 'Altres'], type: 'poll' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}24`, 'Llengua: ortografia bàsica', ['primaria', 'llengua-valenciana']),
    questions: [
      quizQuestion({ question: 'La lletra "qu" s’escriu davant de "e" i "i" en paraules com "quet" o "qui".', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com s’escriu correctament la paraula que nomena l’edifici on es viu?', type: 'short-answer', acceptedAnswers: ['casa'] }),
      quizQuestion({ question: 'Quina d’estes formes verbals és correcta en valencià?', answers: ['Jo vaig', 'Jo vach', 'Nosaltres anem', 'Ells venen'], correct: 1 }),
      quizQuestion({ question: 'Quines d’estes paraules porten accent?', answers: ['Café', 'Casa', 'Música', 'Taula'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Els noms propis s’escriuen amb majúscula inicial.', answers: TF, correct: 1, type: 'true-false' })
    ]
  },
  // --- Lengua Castellana, primaria (25-27) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}25`, 'Lengua: las letras y las palabras', ['primaria', 'llengua-castellana']),
    questions: [
      quizQuestion({ question: '¿Cuántas vocales tiene el alfabeto castellano?', answers: ['5', '6', '4', '7'], correct: 1 }),
      quizQuestion({ question: '"Perro" es un sustantivo.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: '¿Cómo se llama la palabra que indica una acción, como "correr" o "comer"?', type: 'short-answer', acceptedAnswers: ['verbo'] }),
      quizQuestion({ question: '¿Cuáles de estas palabras son sustantivos?', answers: ['Gato', 'Correr', 'Mesa', 'Rápido'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Las preguntas siempre terminan con un punto.', answers: TF, correct: 2, type: 'true-false' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}26`, 'Lengua: lectura y comprensión', ['primaria', 'llengua-castellana']),
    questions: [
      quizQuestion({ question: 'Leer en voz alta ayuda a mejorar la pronunciación.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: '¿Cómo se llama la persona que escribe un libro?', answers: ['Autor', 'Lector', 'Editor', 'Librero'], correct: 1 }),
      quizQuestion({ question: '¿Cómo se llama el resumen breve al final de una lectura?', type: 'short-answer', acceptedAnswers: ['resumen'] }),
      quizQuestion({ question: '¿Cuáles de estos son tipos de textos?', answers: ['Cuento', 'Noticia', 'Poema', 'Partitura'], type: 'multiple', correctAnswers: [1, 2, 3], correct: 1 }),
      quizQuestion({ question: '¿Qué tipo de libro te gusta más leer?', answers: ['Aventuras', 'Misterio', 'Humor', 'Otros'], type: 'poll' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}27`, 'Lengua: ortografía básica', ['primaria', 'llengua-castellana']),
    questions: [
      quizQuestion({ question: 'Los nombres propios se escriben con mayúscula inicial.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: '¿Cómo se escribe correctamente la palabra que nombra el lugar donde vives?', type: 'short-answer', acceptedAnswers: ['casa'] }),
      quizQuestion({ question: '¿Cuál de estas palabras se escribe con "b"?', answers: ['Bola', 'Vamos', 'Ventana', 'Vivir'], correct: 1 }),
      quizQuestion({ question: '¿Cuáles de estas palabras llevan tilde?', answers: ['Café', 'Casa', 'Árbol', 'Mesa'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Las palabras agudas nunca llevan tilde.', answers: TF, correct: 2, type: 'true-false' })
    ]
  },
  // --- Ciències Naturals, primària (28-30) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}28`, 'Ciències Naturals: els animals', ['primaria', 'ciencies-naturals']),
    questions: [
      quizQuestion({ question: 'Quin d’estos animals és un mamífer?', answers: ['Gos', 'Peix', 'Ocell', 'Serp'], correct: 1 }),
      quizQuestion({ question: 'Els peixos respiren per brànquies.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’estos animals ponen ous?', answers: ['Gallina', 'Gos', 'Tortuga', 'Gat'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Com es diu l’animal que es menja plantes?', type: 'short-answer', acceptedAnswers: ['herbívor', 'herbivor'] }),
      quizQuestion({ question: 'Tots els animals tenen quatre potes.', answers: TF, correct: 2, type: 'true-false' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}29`, 'Ciències Naturals: les plantes', ['primaria', 'ciencies-naturals']),
    questions: [
      quizQuestion({ question: 'Quina part de la planta absorbix l’aigua del sòl?', answers: ['Arrel', 'Fulla', 'Flor', 'Fruit'], correct: 1 }),
      quizQuestion({ question: 'Les plantes necessiten llum del sol per a créixer.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quines parts té normalment una planta?', answers: ['Arrel', 'Tija', 'Fulles', 'Rodes'], type: 'multiple', correctAnswers: [1, 2, 3], correct: 1 }),
      quizQuestion({ question: 'Com es diu el procés amb què les plantes produeixen el seu propi aliment?', type: 'short-answer', acceptedAnswers: ['fotosíntesi'] }),
      quizQuestion({ question: 'Si una planta creix 2 cm cada setmana, quant creixerà en 3 setmanes?', type: 'numeric', numericAnswer: 6 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}30`, 'Ciències Naturals: el cos humà', ['primaria', 'ciencies-naturals']),
    questions: [
      quizQuestion({ question: 'Quin òrgan bomba la sang pel cos?', answers: ['Cor', 'Pulmó', 'Fetge', 'Estómac'], correct: 1 }),
      quizQuestion({ question: 'Els pulmons servixen per a respirar.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’estos són sentits del cos humà?', answers: ['Vista', 'Oïda', 'Gust', 'Memòria'], type: 'multiple', correctAnswers: [1, 2, 3], correct: 1 }),
      quizQuestion({ question: 'Quants ossos té, aproximadament, l’esquelet d’un adult?', type: 'numeric', numericAnswer: 206 }),
      quizQuestion({ question: 'Com es diu l’òrgan on es digerixen principalment els aliments?', type: 'short-answer', acceptedAnswers: ['estómac'] })
    ]
  },
  // --- Ciències Socials, primària (31-33) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}31`, 'Ciències Socials: el nostre poble', ['primaria', 'ciencies-socials']),
    questions: [
      quizQuestion({ question: 'Un mapa ajuda a situar llocs i carrers.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es diu la persona que governa un ajuntament?', answers: ['Alcalde', 'Rei', 'President del govern', 'Jutge'], correct: 1 }),
      quizQuestion({ question: 'Quins d’estos són servicis públics d’una ciutat?', answers: ['Hospital', 'Escola', 'Piscina privada', 'Biblioteca'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Com es diu el document que mostra els carrers d’una ciutat?', type: 'short-answer', acceptedAnswers: ['mapa', 'plànol'] }),
      quizQuestion({ question: 'Quin servici públic del teu poble o ciutat uses més?', answers: ['Biblioteca', 'Poliesportiu', 'Parc', 'Altres'], type: 'poll' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}32`, 'Ciències Socials: el temps i la història', ['primaria', 'ciencies-socials']),
    questions: [
      quizQuestion({ question: 'Com es diu un període de 100 anys?', answers: ['Segle', 'Dècada', 'Mil·lenni', 'Any'], correct: 1 }),
      quizQuestion({ question: 'El passat ja ha ocorregut i el futur encara no.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es diu la línia que ordena fets històrics per data?', type: 'short-answer', acceptedAnswers: ['línia del temps', 'cronologia'] }),
      quizQuestion({ question: 'Quines d’estes coses canvien amb el temps?', answers: ['La moda', 'La tecnologia', 'Les muntanyes en un dia', 'Els mitjans de transport'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Quants anys té una dècada?', type: 'numeric', numericAnswer: 10 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}33`, 'Ciències Socials: mapes i orientació', ['primaria', 'ciencies-socials']),
    questions: [
      quizQuestion({ question: 'Quants punts cardinals principals hi ha?', answers: ['4', '3', '5', '6'], correct: 1 }),
      quizQuestion({ question: 'El nord sempre apareix dalt en els mapes habituals.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’estos són punts cardinals?', answers: ['Nord', 'Sud', 'Dalt', 'Est'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Com es diu l’aparell que ajuda a orientar-se indicant el nord?', type: 'short-answer', acceptedAnswers: ['brúixola'] }),
      quizQuestion({ question: 'Si vas 2 km cap al nord i després 2 km cap al sud, a quants km del punt d’inici acabes?', type: 'numeric', numericAnswer: 0 })
    ]
  },
  // --- Anglés, primària (34-36) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}34`, 'English: colours and numbers', ['primaria', 'angles']),
    questions: [
      quizQuestion({ question: 'What colour is the sky on a clear day?', answers: ['Blue', 'Red', 'Green', 'Yellow'], correct: 1 }),
      quizQuestion({ question: '"Three" comes after "two".', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Which of these are colours?', answers: ['Red', 'Jump', 'Blue', 'Table'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'How much is two plus two?', type: 'numeric', numericAnswer: 4 }),
      quizQuestion({ question: 'What is the English word for "gos"?', type: 'short-answer', acceptedAnswers: ['dog'] })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}35`, 'English: animals and food', ['primaria', 'angles']),
    questions: [
      quizQuestion({ question: 'Which animal says "moo"?', answers: ['Cow', 'Cat', 'Dog', 'Duck'], correct: 1 }),
      quizQuestion({ question: 'An apple is a vegetable.', answers: TF, correct: 2, type: 'true-false' }),
      quizQuestion({ question: 'Which of these are fruits?', answers: ['Apple', 'Banana', 'Carrot', 'Orange'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'What is the English word for "peix"?', type: 'short-answer', acceptedAnswers: ['fish'] }),
      quizQuestion({ question: 'What is your favourite food?', answers: ['Pizza', 'Pasta', 'Fruit', 'Other'], type: 'poll' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}36`, 'English: family and school', ['primaria', 'angles']),
    questions: [
      quizQuestion({ question: 'Who is your mother’s mother?', answers: ['Grandmother', 'Sister', 'Aunt', 'Cousin'], correct: 1 }),
      quizQuestion({ question: 'A teacher works at a school.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Which of these are school items?', answers: ['Pencil', 'Book', 'Spoon', 'Backpack'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'What is the English word for "mestre"?', type: 'short-answer', acceptedAnswers: ['teacher'] }),
      quizQuestion({ question: 'A classroom is a place where students study.', answers: TF, correct: 1, type: 'true-false' })
    ]
  },
  // --- Educació Física, primària (37-39) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}37`, 'Educació Física: l’escalfament', ['primaria', 'educacio-fisica']),
    questions: [
      quizQuestion({ question: 'Escalfar abans d’un esport ajuda a evitar lesions.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quin d’estos exercicis és habitual en l’escalfament?', answers: ['Córrer suau', 'Dormir', 'Menjar', 'Mirar la tele'], correct: 1 }),
      quizQuestion({ question: 'Quins beneficis té l’exercici físic?', answers: ['Millora la salut', 'Augmenta el cansament sense descans', 'Ajuda a dormir millor', 'Enforteix els músculs'], type: 'multiple', correctAnswers: [1, 3, 4], correct: 1 }),
      quizQuestion({ question: 'Com s’anomena l’estirament dels músculs abans o després de fer esport?', type: 'short-answer', acceptedAnswers: ['estirament', 'estiraments'] }),
      quizQuestion({ question: 'Si fas 10 flexions i després 10 més, quantes has fet en total?', type: 'numeric', numericAnswer: 20 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}38`, 'Educació Física: esports d’equip', ['primaria', 'educacio-fisica']),
    questions: [
      quizQuestion({ question: 'Quants jugadors formen un equip de futbol en el camp, sense suplents?', answers: ['11', '9', '13', '7'], correct: 1 }),
      quizQuestion({ question: 'El bàsquet es juga llançant una pilota a una cistella.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’estos són esports d’equip?', answers: ['Futbol', 'Natació individual', 'Bàsquet', 'Voleibol'], type: 'multiple', correctAnswers: [1, 3, 4], correct: 1 }),
      quizQuestion({ question: 'Com es diu la persona que arbitra un partit?', type: 'short-answer', acceptedAnswers: ['àrbitre', 'arbitre'] }),
      quizQuestion({ question: 'Quants jugadors té un equip de voleibol en pista, habitualment?', type: 'numeric', numericAnswer: 6 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}39`, 'Educació Física: jocs i moviment', ['primaria', 'educacio-fisica']),
    questions: [
      quizQuestion({ question: 'Saltar a la corda és un exercici cardiovascular.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quin sentit s’usa principalment per a mantindre l’equilibri?', answers: ['Oïda interna', 'Gust', 'Olfacte', 'Tacte'], correct: 1 }),
      quizQuestion({ question: 'Quins d’estos són tipus de desplaçament?', answers: ['Caminar', 'Córrer', 'Saltar', 'Dormir'], type: 'multiple', correctAnswers: [1, 2, 3], correct: 1 }),
      quizQuestion({ question: 'Si fas 3 voltes a una pista de 100 metres, quants metres has recorregut?', type: 'numeric', numericAnswer: 300 }),
      quizQuestion({ question: 'Quin esport t’agrada més practicar?', answers: ['Futbol', 'Bàsquet', 'Natació', 'Altres'], type: 'poll' })
    ]
  },
  // --- Matemàtiques, secundària (40-41) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}40`, 'Matemàtiques: àlgebra bàsica', ['secundaria', 'matematiques']),
    questions: [
      quizQuestion({ question: 'Si x + 5 = 12, quant val x?', type: 'numeric', numericAnswer: 7 }),
      quizQuestion({ question: 'Quin és el resultat de simplificar 3x + 2x?', answers: ['5x', '6x', 'x', '5x²'], correct: 1 }),
      quizQuestion({ question: 'Una equació de primer grau té, en general, com a màxim una solució.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quant és 2 elevat a 4 (2⁴)?', type: 'numeric', numericAnswer: 16 }),
      quizQuestion({ question: 'Com es diu el valor desconegut en una equació?', type: 'short-answer', acceptedAnswers: ['incògnita'] })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}41`, 'Matemàtiques: geometria i àrees', ['secundaria', 'matematiques']),
    questions: [
      quizQuestion({ question: 'Quina és l’àrea d’un rectangle de 4 cm per 5 cm?', type: 'numeric', numericAnswer: 20 }),
      quizQuestion({ question: 'Quants graus té un angle recte?', answers: ['90', '180', '45', '360'], correct: 1 }),
      quizQuestion({ question: 'La suma dels angles d’un triangle és 180 graus.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’estos són tipus de triangle segons els seus costats?', answers: ['Equilàter', 'Isòsceles', 'Escalé', 'Rectangle'], type: 'multiple', correctAnswers: [1, 2, 3], correct: 1 }),
      quizQuestion({ question: 'Quina és l’àrea d’un quadrat de costat 6 cm?', type: 'numeric', numericAnswer: 36 })
    ]
  },
  // --- Llengua i Literatura, secundària (42-43) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}42`, 'Llengua: gramàtica avançada', ['secundaria', 'llengua-literatura']),
    questions: [
      quizQuestion({ question: 'Quin tipus de paraula és "ràpidament"?', answers: ['Adverbi', 'Adjectiu', 'Nom', 'Pronom'], correct: 1 }),
      quizQuestion({ question: 'El subjecte i el verb han de concordar en nombre i persona.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es diu la part de l’oració que indica l’acció?', type: 'short-answer', acceptedAnswers: ['predicat'] }),
      quizQuestion({ question: 'Quines d’estes paraules són adjectius?', answers: ['Bonic', 'Córrer', 'Ràpid', 'Taula'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'Un sinònim és una paraula amb significat contrari.', answers: TF, correct: 2, type: 'true-false' })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}43`, 'Literatura: gèneres literaris', ['secundaria', 'llengua-literatura']),
    questions: [
      quizQuestion({ question: 'A quin gènere literari pertany una novel·la?', answers: ['Narratiu', 'Líric', 'Dramàtic', 'Didàctic'], correct: 1 }),
      quizQuestion({ question: 'La poesia pertany al gènere líric.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es diu una obra literària escrita per a ser representada en un escenari?', type: 'short-answer', acceptedAnswers: ['teatre', 'obra de teatre'] }),
      quizQuestion({ question: 'Quins d’estos són recursos literaris?', answers: ['Metàfora', 'Rima', 'Equació', 'Comparació'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Quin gènere literari prefereixes llegir?', answers: ['Narrativa', 'Poesia', 'Teatre', 'Còmic'], type: 'poll' })
    ]
  },
  // --- Geografia i Història, secundària (44-45) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}44`, 'Geografia: el relleu i el clima', ['secundaria', 'geografia-historia']),
    questions: [
      quizQuestion({ question: 'Com es diu una elevació del terreny més alta que un turó?', answers: ['Muntanya', 'Vall', 'Plana', 'Illa'], correct: 1 }),
      quizQuestion({ question: 'El clima mediterrani es caracteritza per estius secs i hiverns suaus.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’estos són accidents geogràfics?', answers: ['Muntanya', 'Riu', 'Capital', 'Vall'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Com es diu la línia imaginària que dividix la Terra en hemisferi nord i sud?', type: 'short-answer', acceptedAnswers: ['equador'] }),
      quizQuestion({ question: 'Quants continents hi ha a la Terra?', type: 'numeric', numericAnswer: 7 })
    ]
  },
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}45`, 'Història: edat mitjana i moderna', ['secundaria', 'geografia-historia']),
    questions: [
      quizQuestion({ question: 'Quin esdeveniment marca tradicionalment l’inici de l’Edat Moderna?', answers: ['Descobriment d’Amèrica', 'Caiguda de l’Imperi Romà', 'Primera Guerra Mundial', 'Revolució Industrial'], correct: 1 }),
      quizQuestion({ question: 'L’Edat Mitjana va precedir l’Edat Moderna.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Com es deien els senyors que posseïen terres en el feudalisme?', type: 'short-answer', acceptedAnswers: ['senyors feudals', 'nobles'] }),
      quizQuestion({ question: 'Quins d’estos van ser regnes de la península ibèrica en l’Edat Mitjana?', answers: ['Castella', 'Aragó', 'Portugal', 'Prússia'], type: 'multiple', correctAnswers: [1, 2, 3], correct: 1 }),
      quizQuestion({ question: 'En quin segle es va produir el descobriment d’Amèrica?', type: 'numeric', numericAnswer: 15 })
    ]
  },
  // --- Biologia i Geologia, secundària (46) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}46`, 'Biologia i Geologia: la cèl·lula', ['secundaria', 'biologia-geologia']),
    questions: [
      quizQuestion({ question: 'Quina és la unitat bàsica de tots els éssers vius?', answers: ['Cèl·lula', 'Molècula', 'Teixit', 'Òrgan'], correct: 1 }),
      quizQuestion({ question: 'Les cèl·lules animals tenen paret cel·lular.', answers: TF, correct: 2, type: 'true-false' }),
      quizQuestion({ question: 'Quines d’estes estructures pot tindre una cèl·lula?', answers: ['Nucli', 'Membrana', 'Citoplasma', 'Arrel'], type: 'multiple', correctAnswers: [1, 2, 3], correct: 1 }),
      quizQuestion({ question: 'Com es diu l’orgànul on es produïx l’energia de la cèl·lula?', type: 'short-answer', acceptedAnswers: ['mitocondri'] }),
      quizQuestion({ question: 'Quants tipus bàsics de cèl·lules es distingixen (procariotes i...)?', type: 'numeric', numericAnswer: 2 })
    ]
  },
  // --- Física i Química, secundària (47) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}47`, 'Física i Química: estats de la matèria', ['secundaria', 'fisica-quimica']),
    questions: [
      quizQuestion({ question: 'Quants estats bàsics de la matèria s’estudien habitualment?', answers: ['3', '2', '4', '5'], correct: 1 }),
      quizQuestion({ question: 'L’aigua en estat gasós s’anomena vapor.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quins d’estos són canvis d’estat?', answers: ['Fusió', 'Evaporació', 'Combustió', 'Solidificació'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Com es diu el pas de líquid a gas?', type: 'short-answer', acceptedAnswers: ['evaporació', 'vaporització'] }),
      quizQuestion({ question: 'A quants graus centígrads bull l’aigua a nivell del mar?', type: 'numeric', numericAnswer: 100 })
    ]
  },
  // --- Anglés, secundària (48) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}48`, 'English: tenses and vocabulary', ['secundaria', 'angles']),
    questions: [
      quizQuestion({ question: 'Which sentence is in the past simple tense?', answers: ['She walked to school yesterday', 'She walks to school every day', 'She will walk to school tomorrow', 'She is walking to school now'], correct: 1 }),
      quizQuestion({ question: '"Have" is an auxiliary verb used in the present perfect.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Which of these are irregular verbs in English?', answers: ['Go', 'Play', 'Eat', 'Walk'], type: 'multiple', correctAnswers: [1, 3], correct: 1 }),
      quizQuestion({ question: 'What is the English word for "encara que"?', type: 'short-answer', acceptedAnswers: ['although', 'though'] }),
      quizQuestion({ question: 'How many letters does the word "English" have?', type: 'numeric', numericAnswer: 7 })
    ]
  },
  // --- Educació Física, secundària (49) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}49`, 'Educació Física: sistema cardiovascular i esport', ['secundaria', 'educacio-fisica']),
    questions: [
      quizQuestion({ question: 'L’exercici aeròbic millora la capacitat cardiovascular.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quin òrgan bombeja la sang durant l’exercici?', answers: ['Cor', 'Fetge', 'Ronyó', 'Pàncrees'], correct: 1 }),
      quizQuestion({ question: 'Quins factors influïxen en la freqüència cardíaca durant l’esport?', answers: ['Intensitat de l’exercici', 'Edat', 'Color dels ulls', 'Nivell de forma física'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Si la teua freqüència cardíaca en repòs és 70 i puges 30 ppm en fer exercici, quina freqüència tens ara?', type: 'numeric', numericAnswer: 100 }),
      quizQuestion({ question: 'Com es diu la capacitat de mantindre un esforç físic durant un temps prolongat?', type: 'short-answer', acceptedAnswers: ['resistència'] })
    ]
  },
  // --- Tecnologia, secundària (50) ---
  {
    ...quizDefaults(`${STAGE_SEED_KEY_PREFIX}50`, 'Tecnologia: materials i estructures', ['secundaria', 'tecnologia']),
    questions: [
      quizQuestion({ question: 'Quin d’estos és un material metàl·lic?', answers: ['Alumini', 'Fusta', 'Plàstic', 'Vidre'], correct: 1 }),
      quizQuestion({ question: 'Un pont és un exemple d’estructura.', answers: TF, correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'Quines d’estes són propietats dels materials?', answers: ['Duresa', 'Elasticitat', 'Color favorit', 'Conductivitat'], type: 'multiple', correctAnswers: [1, 2, 4], correct: 1 }),
      quizQuestion({ question: 'Com es diu la ferramenta que servix per a unir peces de fusta amb cargols?', type: 'short-answer', acceptedAnswers: ['tornavís', 'destornillador'] }),
      quizQuestion({ question: 'Si una biga ha de suportar 4 càrregues de 50 kg cada una, quin és el pes total en kg?', type: 'numeric', numericAnswer: 200 })
    ]
  }
];

async function nextGameId(collection) {
  const doc = await collection.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).next();
  const maxId = doc && doc.id ? doc.id : 0;
  return maxId + 1;
}

async function seed(collection) {
  let inserted = 0;
  let skipped = 0;
  for (const quiz of SAMPLE_QUIZZES) {
    const existing = await collection.findOne({ devSeedKey: quiz.devSeedKey });
    if (existing) {
      console.log(`[seed-stage-data] "${quiz.name}" ja existix, s'omet.`);
      skipped += 1;
      continue;
    }
    const id = await nextGameId(collection);
    await collection.insertOne({ id, ...quiz });
    console.log(`[seed-stage-data] Inserit "${quiz.name}" (id=${id}).`);
    inserted += 1;
  }
  console.log(`[seed-stage-data] Sembrats: ${inserted}. Ja existien: ${skipped}.`);
}

async function removeSeed(collection) {
  const result = await collection.deleteMany({
    devSeedKey: { $regex: new RegExp(`^${STAGE_SEED_KEY_PREFIX}`) }
  });
  console.log(`[seed-stage-data] Eliminats: ${result.deletedCount}.`);
}

function assertStagingEnvironment() {
  if (process.env.NODE_ENV !== 'staging') {
    throw new Error(
      "Este script només s'executa amb NODE_ENV=staging (ja fixat a install-files/stage.env.example). " +
      "Insereix qüestionaris públics d'exemple — mai l'executes contra una base de dades real."
    );
  }
  if (process.env.MONGO_DB === 'kahootDB') {
    throw new Error(
      "MONGO_DB apunta a 'kahootDB', el nom de la base de dades de producció. " +
      "Stage ha d'usar la seua pròpia base (per exemple, 'eduhoot_stage'); revisa MONGO_DB abans de continuar."
    );
  }
}

async function main() {
  assertStagingEnvironment();
  const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 3000 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const quizzes = db.collection('kahootGames');
    if (remove) {
      await removeSeed(quizzes);
    } else {
      await seed(quizzes);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[seed-stage-data] Error:', err && err.message ? err.message : err);
  process.exit(1);
});
