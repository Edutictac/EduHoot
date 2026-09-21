# EduHoot 1.0.5

Lot de millores basat en feedback real d'ús a l'aula (Daniel Sàez Buedo i el
seu alumnat), més un reforç de seguretat i una millora visual.

- Pantalla neta a l'instant entre preguntes, sense restes de la pregunta
  anterior.
- Noms de jugador de fins a 40 caràcters en multijugador.
- Icones de forma (triangle, rombe, cercle, quadrat) a cada resposta, a més
  del color, per a distingir-les millor i per accessibilitat davant el
  daltonisme. Dibuixades amb CSS pur (`clip-path`), no amb caràcters
  Unicode, per a un traç nítid i consistent entre dispositius.
- Botó de pantalla completa a la vista del professor.
- Celebració quan tota la classe encerta una pregunta, i avís quan la falla
  tota.
- Petita animació a la insígnia de punts dobles de les preguntes especials.
- Animació de moviments al rànquing entre preguntes.
- Informe de partida (`report.csv`) més segur: només el host real de la
  partida el pot descarregar (abans qualsevol valor de `hostId` no buit
  servia), i neteja automàtica dels fitxers en disc encara que el servidor
  es reinicie (abans depenia només d'un temporitzador en memòria).

## Comprovacions

Des de `src/`, amb Node 24 i Python 3:

```bash
npm ci
npm run lint
npm test
npm run test:i18n
npm audit
```
