const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let httpServer;
let baseUrl;
let mongoClient;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  process.env.UPLOAD_CSV_RATE_LIMIT_DISABLED = 'true';
  let app;
  ({ app, mongoClient } = require('../../server/server.js'));
  httpServer = app.listen(0);
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
  delete process.env.UPLOAD_CSV_RATE_LIMIT_DISABLED;
});

function upload(filename, content) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'application/xml' }), filename);
  form.append('name', 'Prueba XML');
  return fetch(`${baseUrl}/api/upload-csv`, { method: 'POST', body: form });
}

const MOODLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <name><text>P1</text></name>
    <questiontext format="html"><text><![CDATA[<p>Capital de Francia</p>]]></text></questiontext>
    <single>true</single>
    <answer fraction="100"><text><![CDATA[Paris]]></text></answer>
    <answer fraction="0"><text><![CDATA[Roma]]></text></answer>
  </question>
  <question type="truefalse">
    <name><text>P2</text></name>
    <questiontext format="html"><text><![CDATA[<p>La Tierra es plana</p>]]></text></questiontext>
    <answer fraction="0"><text>Verdadero</text></answer>
    <answer fraction="100"><text>Falso</text></answer>
  </question>
  <question type="essay">
    <name><text>P3</text></name>
    <questiontext format="html"><text>Redacta</text></questiontext>
  </question>
</quiz>`;

test('POST /api/upload-csv acepta un XML de Moodle y omite lo que no admite', async () => {
  const res = await upload('repaso.xml', MOODLE_XML);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.count, 2);
  assert.equal(body.name, 'Prueba XML');
  // El docente ve qué se ha omitido y por qué.
  assert.deepEqual(body.skipped.map((s) => s.name), ['P3']);
  assert.equal(body.skipped[0].reason, 'tipo no compatible (essay)');
});

test('POST /api/upload-csv rechaza un XML que no es de Moodle', async () => {
  const res = await upload('otro.xml', '<html><body>nada</body></html>');
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /XML de Moodle/);
});

test('POST /api/upload-csv sigue aceptando el CSV de EduHoot', async () => {
  const csv = [
    'tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia',
    'quiz;¿Capital de Francia?;Paris;Roma;Londres;Berlín;20;1;;;;;'
  ].join('\n');
  const res = await upload('preguntas.csv', csv);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.count, 1);
});
