# Sistema de logging del servidor

*Afegit: 10-11-2026.* Detall tècnic complet, amb referències exactes de
codi, en `ARCHITECTURE.md` → "Logs del servidor (/admin/logs)"; este
document resumix què es va afegir, per què, i l'estat de la fase 2
(alertes per correu, encara no implementada).

## Índex

- [Motivació](#motivació)
- [Què s'ha afegit](#què-sha-afegit)
- [Esdeveniments que ja es registren](#esdeveniments-que-ja-es-registren)
- [Configuració](#configuració)
- [Fase 2 (pendent): alertes per correu](#fase-2-pendent-alertes-per-correu)

## Motivació

Fins ara, depurar una partida després del fet era impossible: tot el
logging eren `console.log`/`console.error` solts, sense persistència
(només stdout del contenidor, perdut si ningú mirava
`docker compose logs` en eixe moment). Es va detectar en viu arrel del
cas de jugadors duplicats a la pantalla de l'amfitrió, jugant des de
stage (vore l'historial d'issues del projecte).

## Què s'ha afegit

- **Llibreria**: Winston, amb eixida a consola (igual que abans) + un
  *transport* propi que persistix cada entrada a MongoDB.
- **Persistència circular**: col·lecció `appLogs`, creada com a
  **capped** (mida fixa en bytes, sobreescriu sola les entrades més
  antigues). Mida per defecte: 10MB.
- **Configuració en calent**: nivell mínim de log i mida de la
  col·lecció, guardats en una col·lecció `appSettings` i editables
  sense redesplegar, des del propi visor o per API
  (`GET`/`POST /api/admin/settings/logging`).
- **Visor web**: `/admin/logs` (app de Vue, com `/admin/stats`,
  protegit amb rol `admin`), amb filtres per nivell, `tag` (filtra en
  triar-lo) i text lliure (cerca a `message`, `tag` i `meta`). Mostra els
  100 més recents; si n'hi ha més, ho avisa i «Cargar más» porta els 100
  següents (`GET /api/admin/logs?before=…&beforeId=…`, la data i l'`_id`
  de l'última fila; la resposta du `hasMore`).
- **Descàrrega**: botons CSV i NDJSON al visor
  (`GET /api/admin/logs/export`), amb els mateixos filtres, per a
  analitzar els logs fora de l'aplicació.
- **Cas especial `uncaughtException`**: el *transport* normal no
  bloqueja el servidor (escriu en segon pla), però ahí el procés es
  tanca just després de l'error; eixe log concret s'intenta persistir
  amb un marge curt abans d'eixir, perquè no es perga.

## Esdeveniments que ja es registren

Abans només hi havia 3 punts de log (`logGames`, sense persistència).
Ara, a més de substituir tots els `console.log`/`console.error`
dispersos pel logger nou, es registren explícitament:

- Creació, inici i fi de partida (`host-join`, `game-start`,
  `game-end`).
- Unió, reconnexió i eixida de jugador (`player-join`,
  `player-rejoin`, `player-rejoin-stale` quan es reutilitza una fila
  pel nom perquè el token no va resoldre, `player-leave`).
- Errors no controlats de cada mòdul (sockets, rutes, Express,
  `uncaughtException`/`unhandledRejection`).

Cada entrada guarda camps de correlació (`pin`, `hostId`, `playerId`,
`tag`) per a compatibilitat amb entrades anteriors; el visor busca a
`message`, `tag` i `meta`.

## Configuració

| Paràmetre | Per defecte | On es canvia |
|---|---|---|
| Nivell mínim de log | `info` | `/admin/logs` o `POST /api/admin/settings/logging` |
| Mida de la col·lecció (circularitat) | 10MB | Mateix lloc; redimensiona en calent (`collMod`) |

## Fase 2 (pendent): alertes per correu

No implementat. La idea, ajornada expressament, és enviar un correu
quan es produïsca un error crític (`uncaughtException` o equivalent),
com a capa opcional per damunt d'este sistema (un *transport* més de
Winston), no com a part del disseny inicial. Queden pendents, entre
altres coses: confirmar si el SMTP que ja usa Authentik es pot
reaprofitar, decidir llindar/*throttling* per no inundar el correu si
l'error es repetix en bucle, i decidir destinataris.
