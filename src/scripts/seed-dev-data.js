#!/usr/bin/env node

const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/';
const dbName = process.env.MONGO_DB || 'kahootDB';
const remove = process.argv.includes('--remove') || process.env.REMOVE === '1';
const SEED_KEY_PREFIX = 'eduhoot-seed-demo-';
const USER_SEED_KEY_PREFIX = 'eduhoot-seed-user-';
const DEV_USER_PASSWORD = 'exemple1234';

const GLOBAL_OWNER_ID = 'global-anon-owner';
const GLOBAL_OWNER_EMAIL = 'anon@local';

function quizDefaults(devSeedKey, name) {
  return {
    devSeedKey,
    name,
    tags: ['exemple'],
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

const SAMPLE_QUIZZES = [
  {
    ...quizDefaults(`${SEED_KEY_PREFIX}1`, 'Cultura general'),
    questions: [
      quizQuestion({ question: 'Quina és la capital de França?', answers: ['París', 'Roma', 'Berlín', 'Lisboa'], correct: 1, type: 'quiz' }),
      quizQuestion({ question: 'Quants continents hi ha a la Terra?', answers: ['5', '6', '7', '8'], correct: 3, type: 'quiz' }),
      quizQuestion({ question: 'Quin oceà és el més gran?', answers: ['Atlàntic', 'Pacífic', 'Índic', 'Àrtic'], correct: 2, type: 'quiz' }),
      quizQuestion({
        question: 'Quins d\'estos són colors primaris?',
        answers: ['Roig', 'Verd', 'Blau', 'Taronja'],
        type: 'multiple',
        correctAnswers: [1, 3],
        correct: 1
      }),
      quizQuestion({
        question: 'Quins d\'estos són instruments musicals?',
        answers: ['Violí', 'Martell', 'Flauta', 'Clau anglesa'],
        type: 'multiple',
        correctAnswers: [1, 3],
        correct: 1
      })
    ]
  },
  {
    ...quizDefaults(`${SEED_KEY_PREFIX}2`, 'Música bàsica'),
    questions: [
      quizQuestion({ question: 'El piano és un instrument de corda.', answers: ['Veritat', 'Mentida', '', ''], correct: 2, type: 'true-false' }),
      quizQuestion({ question: 'Un pentagrama té 5 línies.', answers: ['Veritat', 'Mentida', '', ''], correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'La guitarra és un instrument de vent.', answers: ['Veritat', 'Mentida', '', ''], correct: 2, type: 'true-false' }),
      quizQuestion({ question: 'Un compàs 4/4 és el més habitual en música popular.', answers: ['Veritat', 'Mentida', '', ''], correct: 1, type: 'true-false' }),
      quizQuestion({ question: 'El silenci també té valor rítmic en una partitura.', answers: ['Veritat', 'Mentida', '', ''], correct: 1, type: 'true-false' })
    ]
  },
  {
    ...quizDefaults(`${SEED_KEY_PREFIX}3`, 'Informàtica bàsica'),
    questions: [
      quizQuestion({ question: 'Quin és l\'acrònim de "Unitat Central de Processament"?', type: 'short-answer', acceptedAnswers: ['CPU'] }),
      quizQuestion({ question: 'Com es diu la memòria que es perd en apagar l\'ordinador?', type: 'short-answer', acceptedAnswers: ['RAM', 'ram'] }),
      quizQuestion({ question: 'Quin llenguatge s\'usa típicament per a donar estil a una pàgina web?', type: 'short-answer', acceptedAnswers: ['CSS', 'css'] }),
      quizQuestion({ question: 'Com es diu el sistema que trasllada noms de domini a adreces IP?', type: 'short-answer', acceptedAnswers: ['DNS', 'dns'] }),
      quizQuestion({ question: 'Quin terme designa un programa maliciós?', type: 'short-answer', acceptedAnswers: ['malware', 'virus'] })
    ]
  },
  {
    ...quizDefaults(`${SEED_KEY_PREFIX}4`, 'Matemàtiques ràpides'),
    questions: [
      quizQuestion({ question: 'Quant és 12 + 7?', type: 'numeric', numericAnswer: 19, tolerance: 0 }),
      quizQuestion({ question: 'Quant és 9 x 6?', type: 'numeric', numericAnswer: 54, tolerance: 0 }),
      quizQuestion({ question: 'Quant és l\'arrel quadrada de 81?', type: 'numeric', numericAnswer: 9, tolerance: 0 }),
      quizQuestion({ question: 'Quant és 100 / 4?', type: 'numeric', numericAnswer: 25, tolerance: 0 }),
      quizQuestion({ question: 'Aproxima el valor de pi (dos decimals).', type: 'numeric', numericAnswer: 3.14, tolerance: 0.05 })
    ]
  },
  {
    ...quizDefaults(`${SEED_KEY_PREFIX}5`, 'Sondeig: hàbits d\'estudi'),
    questions: [
      quizQuestion({ question: 'A quina hora del dia estudies millor?', answers: ['Matí', 'Vesprada', 'Nit', 'Depén del dia'], type: 'poll' }),
      quizQuestion({ question: 'On prefereixes estudiar?', answers: ['A casa', 'A la biblioteca', 'En grup', 'Depén'], type: 'poll' }),
      quizQuestion({ question: 'Quant de temps estudies cada dia, de mitjana?', answers: ['Menys d\'1 hora', '1-2 hores', '2-4 hores', 'Més de 4 hores'], type: 'poll' }),
      quizQuestion({ question: 'Quin recurs uses més per a estudiar?', answers: ['Apunts propis', 'Llibre de text', 'Vídeos', 'Jocs tipus EduHoot'], type: 'poll' }),
      quizQuestion({ question: 'Prefereixes estudiar sol o acompanyat?', answers: ['Sol', 'Acompanyat', 'Depén de la matèria', 'Depén del moment'], type: 'poll' })
    ]
  }
];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

const SAMPLE_USERS = [
  { devSeedKey: `${USER_SEED_KEY_PREFIX}1`, email: 'admin@exemple.local', nickname: 'Admin de prova', role: 'admin' },
  { devSeedKey: `${USER_SEED_KEY_PREFIX}2`, email: 'docent1@exemple.local', nickname: 'Docent de prova 1', role: 'editor' },
  { devSeedKey: `${USER_SEED_KEY_PREFIX}3`, email: 'docent2@exemple.local', nickname: 'Docent de prova 2', role: 'editor' },
  { devSeedKey: `${USER_SEED_KEY_PREFIX}4`, email: 'docent3@exemple.local', nickname: 'Docent de prova 3', role: 'editor' },
  { devSeedKey: `${USER_SEED_KEY_PREFIX}5`, email: 'docent4@exemple.local', nickname: 'Docent de prova 4', role: 'editor' }
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
      console.log(`[seed-dev-data] "${quiz.name}" ja existix, s'omet.`);
      skipped += 1;
      continue;
    }
    const id = await nextGameId(collection);
    await collection.insertOne({ id, ...quiz });
    console.log(`[seed-dev-data] Inserit "${quiz.name}" (id=${id}).`);
    inserted += 1;
  }
  console.log(`[seed-dev-data] Sembrats: ${inserted}. Ja existien: ${skipped}.`);
}

async function removeSeed(collection) {
  const result = await collection.deleteMany({
    devSeedKey: { $regex: new RegExp(`^${SEED_KEY_PREFIX}`) }
  });
  console.log(`[seed-dev-data] Eliminats: ${result.deletedCount}.`);
}

async function seedUsers(collection) {
  let inserted = 0;
  let skipped = 0;
  for (const user of SAMPLE_USERS) {
    const existing = await collection.findOne({ devSeedKey: user.devSeedKey });
    if (existing) {
      console.log(`[seed-dev-data] usuari "${user.email}" ja existix, s'omet.`);
      skipped += 1;
      continue;
    }
    const { salt, hash } = hashPassword(DEV_USER_PASSWORD);
    await collection.insertOne({
      devSeedKey: user.devSeedKey,
      email: user.email,
      passwordSalt: salt,
      passwordHash: hash,
      role: user.role,
      nickname: user.nickname,
      createdAt: new Date()
    });
    console.log(`[seed-dev-data] Inserit usuari "${user.email}" (rol ${user.role}).`);
    inserted += 1;
  }
  console.log(`[seed-dev-data] Usuaris sembrats: ${inserted}. Ja existien: ${skipped}.`);
}

async function removeSeedUsers(collection) {
  const result = await collection.deleteMany({
    devSeedKey: { $regex: new RegExp(`^${USER_SEED_KEY_PREFIX}`) }
  });
  console.log(`[seed-dev-data] Usuaris eliminats: ${result.deletedCount}.`);
}

function assertDevelopmentEnvironment() {
  if (process.env.NODE_ENV === 'development') return;
  throw new Error(
    "Este script només s'executa amb NODE_ENV=development (ja fixat a docker-compose.yml). " +
    "Insereix qüestionaris públics i un usuari admin amb contrasenya coneguda " +
    "(exemple1234) — mai l'executes contra una base de dades real."
  );
}

async function main() {
  assertDevelopmentEnvironment();
  const client = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 3000 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const quizzes = db.collection('kahootGames');
    const users = db.collection('users');
    if (remove) {
      await removeSeed(quizzes);
      await removeSeedUsers(users);
    } else {
      await seed(quizzes);
      await seedUsers(users);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[seed-dev-data] Error:', err && err.message ? err.message : err);
  process.exit(1);
});
