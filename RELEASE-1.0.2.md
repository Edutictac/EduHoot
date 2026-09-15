# EduHoot 1.0.2

Versió integrada amb EduTicTac Commons 0.1.1-alpha.

- Selectors CA, VA, ES i EN amb variants separades i preferència persistent.
- Els enllaços `?lang=` respecten un canvi posterior de l'usuari, també
  després de recarregar o passar a l'editor.
- Correccions valencianes del creador i del joc.
- 29 proves unitàries/integració i 26 comprovacions de navegador en
  escriptori i mòbil.
- Dependències compatibles actualitzades i retirada d'`expect`, que ja no
  s'usava en les proves basades en `node:assert`.

## Comprovacions

Des de `src/`, amb Node 20 o posterior i Python 3:

```bash
npm ci
npx playwright install --with-deps chromium
npm run lint
npm test
npm run test:i18n
npm audit
```

Les proves de navegador servixen els fitxers locals amb un servidor temporal
i simulen les API i Socket.IO; no es connecten a la producció ni creen
comptes. La integració real amb Commons es comprova en el repo del stack.

## Imatge

`registry.edutictac.es/edutictac/eduhoot:1.0.2`

El tag Docker passa del prototip `0.1.0` a la versió del paquet Node. El
manifest de digests de Commons fixa la imatge exacta usada en la prova
d'instal·lació i restauració. No cal migrar la base `kahootDB`.
