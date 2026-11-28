const { test } = require('node:test');
const assert = require('node:assert/strict');

const { detectImportFormat } = require('../../server/services/importFormat');

const CSV = 'tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia\nquiz;Capital;Paris;Roma;;;20;1;;;;;';
const GIFT = '::P1:: Capital de Francia? {=Paris ~Roma}\n\n::P2:: La Tierra es plana {F}';
const GIFT_NO_TITLE = 'Capital de Francia? {=Paris ~Roma}';
const XML = '<?xml version="1.0"?>\n<quiz></quiz>';

test('la extensión decide cuando es .gift o .xml, sea cual sea el contenido', () => {
  assert.equal(detectImportFormat('a.gift', CSV), 'gift');
  assert.equal(detectImportFormat('a.xml', GIFT), 'xml');
});

test('un .txt se detecta por su contenido', () => {
  assert.equal(detectImportFormat('preguntas.txt', CSV), 'csv');
  assert.equal(detectImportFormat('preguntas.txt', GIFT), 'gift');
  assert.equal(detectImportFormat('preguntas.txt', GIFT_NO_TITLE), 'gift');
  assert.equal(detectImportFormat('preguntas.txt', XML), 'xml');
});

test('una cabecera de CSV gana aunque el texto contenga llaves', () => {
  const tricky = 'tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia\nquiz;Escribe {=x};A;B;;;20;1;;;;;';
  assert.equal(detectImportFormat('datos.txt', tricky), 'csv');
});

test('un CSV sin cabecera se toma como CSV, y un BOM no molesta', () => {
  assert.equal(detectImportFormat('datos.txt', '﻿' + 'quiz;Capital;Paris;Roma;;;20;1;;;;;'), 'csv');
});

test('un .txt sin marcas conocidas cae a CSV, que es el formato de siempre', () => {
  assert.equal(detectImportFormat('nota.txt', 'hola mundo'), 'csv');
});
