# Migració d’EduHoot al compte únic EduTicTac

Data del pla: 12 d’octubre de 2026. Estat: doble accés actiu i avís inicial enviat; recordatori i retirada automàtica desactivats després de les incidències de la prova real.

Este pla substituïx la convivència permanent de Google i Authentik prevista en `PLAN-AUTHENTIK.md`: hi haurà 14 dies de convivència i, després, només Authentik. Google continuarà disponible dins d’Authentik.

## Situació comprovada

- El 12 d’octubre, els endpoints públics de configuració indiquen Google actiu i Authentik desactivat en EduHoot.
- El repositori ja incorpora el flux Authentik amb PKCE, botó «Entrar amb EduTicTac» i comprovació de grup docent.
- El codi actual enllaça comptes pel correu i conserva el registre existent. Cal reforçar-lo abans de la migració: requerir correu verificat explícitament, identificar comptes ja vinculats per issuer/sub i impedir substitucions de vinculacions o duplicats.
- La memòria operativa d’EduTicTac Prompt documenta Google com a font d’Authentik i una prova real satisfactòria. Cal repetir la prova per a EduHoot i per a un compte docent nou.

## Preparació abans del dia 0

1. Consultar la memòria operativa vigent abans d’actuar sobre producció. Confirmar el servei real d’EduHoot i una restauració viable de la base de dades i configuració.
2. Fer inventari privat dels usuaris registrats: correus normalitzats, proveïdors, rols, propietat dels qüestionaris i possibles col·lisions. No guardar dades personals al repositori. Preparar destinataris únics i comptatges agregats; no inventar el nombre d’usuaris.
3. Configurar l’aplicació OIDC d’EduHoot en Authentik, callback HTTPS exacte, grups docents i secrets en el magatzem segur. Reutilitzar la font Google d’Authentik. Verificar alta, correu verificat i assignació del perfil docent; no donar permisos d’administració automàticament.
4. Assegurar la vinculació segura: mateix correu verificat en el primer accés, mateix identificador intern d’EduHoot i conservació de qüestionaris i permisos. Resoldre manualment correus diferents o conflictes, després de comprovar la titularitat. No importar contrasenyes d’EduHoot.
5. Provar en preproducció comptes existents de Google, comptes locals, comptes ja presents en Authentik i comptes nous. Comprovar creació/edició de qüestionaris, partides, permisos i tancament de sessió. Comprovar que alumnat, accés per PIN i mode Solo continuen funcionant.
6. Validar amb un compte docent ordinari les ferramentes i els permisos que s’anunciaran. La memòria i el tauler documenten Banc de recursos, Wikimanuals i Forja; Prompt té sincronització OIDC documentada. La comprovació pública de l’arrel de prompts.edutictac.es ha retornat un error HTTP: cal comprovar la ruta del frontend i el flux real abans de prometre eixe accés. Afegir Nextcloud, Collabora, Forms o blogs només si se’n comprova la disponibilitat amb eixe perfil.
7. Tancar data i hora exactes del canvi, canal de suport i text del correu. Preparar un enviament de prova i una llista privada de destinataris revisada.

## Dia 0: doble accés i avís

- Activar i provar Authentik en producció abans d’iniciar el còmput dels 14 dies.
- Mantindre Google directe i «Entrar amb EduTicTac» disponibles. Prioritzar visualment EduTicTac i indicar la data de retirada de Google directe.
- Enviar l’avís en valencià als usuaris registrats actuals, amb lliurament individual i sense exposar adreces d’altres destinataris. Registrar enviaments i rebots en un registre privat per evitar duplicats.
- Explicar que Google continuarà funcionant dins de l’accés EduTicTac i que cal utilitzar el mateix correu del compte anterior.

## Dies 1–13: transició

- Revisar errors, rebots i vinculacions amb comptatges agregats, sense registrar credencials.
- Atendre incidències de correus diferents, grup docent absent o comptes duplicats.
- Enviar un recordatori tres dies abans del canvi, preferentment a qui encara no haja vinculat el compte.
- Si apareix una incidència que impedix l’accés, corregir-la i comunicar una nova data abans de retirar l’accés anterior.

## Dia 14: Authentik com a únic accés docent

- Desactivar Google directe en EduHoot, tant el botó com els endpoints. Google es conserva com a opció dins d’Authentik.
- Retirar l’entrada ordinària amb contrasenya local i tancar qualsevol altra via d’autenticació docent que eludisca Authentik, inclosa l’alta inicial. Revisar explícitament els usuaris locals inventariats.
- Definir la vigència de les sessions locals ja obertes i comprovar que no perpetuen una via antiga d’accés. Fer el canvi fora de partides actives.
- Provar l’accés EduTicTac → Google → qüestionaris anteriors, i l’accés amb compte EduTicTac propi. Comprovar rols, alumnat, PIN i Solo.
- Deshabilitar el client OAuth directe d’EduHoot només després de confirmar que no és el client compartit de la font Google d’Authentik.
- Actualitzar documentació i tauler docent. Comunicar la finalització.

## Reversió i criteris de finalització

Si falla l’accés docent o es perd la vinculació amb contingut, restaurar temporalment les vies anteriors mitjançant la configuració preparada i anunciar l’ajornament. No eliminar usuaris, qüestionaris ni vinculacions per a revertir el canvi.

La migració acaba quan Authentik és l’única entrada docent, Google funciona dins d’Authentik, els comptes existents conserven contingut i permisos i s’han resolt les incidències de vinculació conegudes. No confondre «correu enviat» amb «compte migrat».

## Esborrany de correu inicial en valencià

**Assumpte:** EduHoot: accés amb el compte EduTicTac a partir del [DATA]

Hola,

T’escrivim perquè tens un compte registrat en EduHoot. Unifiquem l’accés amb el compte EduTicTac perquè pugues utilitzar diverses ferramentes amb una mateixa sessió.

Durant 14 dies, del [DATA INICI] al [DATA I HORA DEL CANVI], podràs entrar tant amb el botó actual de Google com amb el nou botó **«Entrar amb EduTicTac»**.

A partir del [DATA DEL CANVI], l’entrada serà únicament amb **«Entrar amb EduTicTac»**. Dins d’esta pantalla continuaràs tenint l’opció d’entrar amb Google.

**Què has de fer?**

1. Visita https://eduhoot.edutictac.es/create/ i prem «Entrar amb EduTicTac».
2. Si ja tens un compte EduTicTac, utilitza’l. També pots triar Google dins de la pantalla d’accés.
3. Utilitza el mateix correu amb què estàs registrat en EduHoot i completa els passos que et demane la pantalla.
4. Comprova que veus els teus qüestionaris. Si no apareixen o el teu compte EduTicTac té un altre correu, contacta amb nosaltres en info@sasogu.es.

El canvi està preparat per a conservar els teus qüestionaris i els permisos del teu compte. L’alumnat continuarà entrant a les partides amb el procediment habitual.

Amb el compte EduTicTac podràs accedir, segons els permisos del teu perfil, a estes ferramentes:

- **[EduHoot](https://eduhoot.edutictac.es/):** crear qüestionaris i organitzar partides a l’aula.
- **[Banc de recursos](https://recursos.edutictac.es/):** guardar favorits, valorar recursos i preparar activitats de classe.
- **[Wikimanuals](https://edutictac.es/wikimanuals):** consultar i col·laborar en la documentació comunitària.
- **[Forja EduTicTac](https://git.edutictac.es/):** col·laborar en projectes i comunicar incidències.
- **[EduTicTac Prompt](https://pages.edutictac.es/Edutictac/edutictac-prompt/):** guardar i sincronitzar els teus prompts educatius.

També tens a la teua disposició **[Blocs](https://blocs.edutictac.es/)** per a crear projectes de programació visual.

Pots consultar els serveis en https://edutictac.es/.

Et recomanem provar el nou accés abans del [DATA DEL CANVI]. Si necessites ajuda, contacta amb nosaltres en info@sasogu.es.

Gràcies per formar part d’EduTicTac.

Samuel · Comunitat EduTicTac

**Nota interna abans d’enviar:** substituir tots els marcadors, comprovar cada ferramenta amb el perfil destinatari i retirar de la llista qualsevol servei no validat. Confirmar que les proves de conservació de contingut i accés d’alumnat han passat. Este esborrany no s’ha enviat.

## Referència tècnica

Documentació oficial d’Authentik sobre OIDC, PKCE i callbacks: https://docs.goauthentik.io/add-secure-apps/providers/oauth2/.


## Execució del 12 d’octubre de 2026

- Còpia privada de MongoDB, configuració i codi d’EduHoot i base de dades d’Authentik feta abans dels canvis. No guardar-la en este repositori.
- Aplicació OIDC d’EduHoot creada. Google continua com a font d’Authentik. Secrets guardats de manera segura.
- Vinculació per correu verificat en el primer accés i per issuer/sub en els següents. Índex únic per identitat, comprovació obligatòria de cookie d’estat i conservació d’identificador, propietat i rol.
- Verificació de correu: mapping de la font Google que registra l’adreça verificada, i flux de confirmació per correu per als comptes sense verificació. El provider només afirma verificació si l’adreça actual coincidix amb l’adreça verificada.
- Incidència durant la prova de l’usuari: «Request has been denied / Unknown error». Corregit el pas de pending_user al context del pla real d’Authentik.
- Prova OIDC amb una identitat docent sintètica autenticada: retorn a EduHoot, sessió HTTP 200 i qüestionari privat anterior HTTP 200. Prova separada de confirmació per correu i restauració del flux: sessió i qüestionari HTTP 200, verificació registrada. La prova tècnica ha recuperat l’enllaç de confirmació de manera interna; no equival a una prova humana nova de Google.
- Identitat i contingut sintètics eliminats. Reinicis només amb l’última instantània d’activitat sense partides.
- 41 proves automàtiques superades; lint i comprovacions de sintaxi superades. Afegida prova de desactivació de vies locals i Google i invalidació de sessions HTTP antigues en arribar a la data límit.
- Doble accés actiu el 12 d’octubre. Data límit: **26 d’octubre de 2026, 19:00 Europe/Madrid** (`2026-10-26T18:00:00Z`). L’aplicació desactiva les vies antigues automàticament segons esta data, sense reiniciar partides.
- **20 avisos individuals acceptats pel servidor SMTP**, des de info@sasogu.es. Acceptació SMTP no garantix recepció en la safata d’entrada. Text enviat: `CORREU-MIGRACIO-AUTHENTIK.md`.
- Recordatori del **23 d’octubre, 19:00 Europe/Madrid**, amb el mateix text i assumpte de recordatori, només als destinataris originals que encara no tinguen vinculació Authentik. Timer d’usuari persistent `eduhoot-authentik-reminder-20261023.timer` en debiandesktop; linger actiu. Si la màquina està apagada, s’executarà en tornar a arrancar sempre que no haja acabat el termini.
- En arribar al termini, es desactiven Google directe, contrasenya local, bootstrap i reset/creació local d’usuaris; les sessions HTTP anteriors requerixen tornar a entrar amb Authentik. Google dins d’Authentik es conserva.
- Encara cal seguiment de rebots/incidències i comprovació humana del nou accés després de la correcció. Els comptes amb correus diferents requerixen suport; no s’han fusionat manualment.
- Rollback: llevar `AUTHENTIK_MIGRATION_END` de l’entorn remot i mantindre `AUTHENTIK_ONLY=false`, reiniciar només sense partides actives, i desactivar el timer del recordatori si s’ajorna la migració. Això restaura les vies antigues sense eliminar dades ni vinculacions.


## Correcció de Google i estat actual (12 d’octubre de 2026)

- El flux d’autenticació de comptes Google ja existents no té UserWriteStage; el mapping retornava el correu verificat però no el guardava. Ara el mapping de la font Google persistix l’adreça confirmada en el compte vinculat, sense canviar correu canònic ni rols. També cobreix el primer enllaç per correu a un compte natiu existent. Les dues claims reals de Google (`verified_email` i `email_verified`) estan provades.
- La confirmació addicional de correu s’omet quan Google ha verificat la mateixa adreça del perfil. Les claims falses, absents o de tipus string no generen verificació, i una adreça distinta no verifica el perfil canònic.
- El segon error real, petició `015fc1ca87ed4c0599e9beb65c46a17b`, era un ValueError en AuthorizationCode.user: després de confirmar el correu des d’un navegador sense sessió, request.user era AnonymousUser. S’ha afegit UserLoginStage després de confirmar i registrar l’adreça, abans de l’emissió del codi OAuth.
- Proves executades amb el SourceMapper real d’Authentik: comptes existents, dues claims de Google, negatives i primer enllaç natiu. Script `scripts/test-authentik-google-verification.py`; les dades de prova es revertixen en una transacció.
- Prova de navegador amb una identitat de prova verificada pel mapping Google: retorn a EduHoot i `/api/auth/me` HTTP 200; no apareix EmailStage. La resposta de Google és de prova, no s’han utilitzat credencials personals per a un login interactiu a Google. Identitat i compte sintètics eliminats; queden 20 comptes registrats.
- **Estat actual que substituïx el calendari anterior:** s’ha llevat `AUTHENTIK_MIGRATION_END` de l’entorn en producció i s’ha desactivat `eduhoot-authentik-reminder-20261023.timer`. Google directe i Authentik continuen actius. El correu inicial ja enviat als 20 usuaris conserva el calendari anunciat, però la retirada automàtica i el recordatori no estan armats. Cal validar l’accés real corregit abans de reactivar-los o comunicar noves dates.


## Vinculació real i botó d’eixida (12 d’octubre de 2026)

- La prova real del propietari no creava sessió d’EduHoot perquè el seu compte Google antic d’Authentik no pertanyia a professorat. El journal ho confirmava: «La cuenta de Authentik no tiene rol docente». La verificació del correu ja era correcta.
- Restaurada la pertinença a professorat només per als comptes registrats amb role editor/admin, Google ID coincident amb la connexió Google d’Authentik, correu canònic coincident i googleVerifiedEmail True. Tres coincidències; dos comptes antics sense grup corregits.
- Vinculada la identitat Authentik del propietari al registre original amb el perfil OIDC real i una comprovació addicional del Google ID. Es conserva el mateix _id, rol admin i 34 qüestionaris; no s’han mogut qüestionaris ni creat comptes duplicats. Total: 20 usuaris.
- La capçalera mostra «Salir» / «Eixir» quan hi ha una sessió, i executa logout real en clicar. «Cuenta» / «Compte» manté l’accés al perfil. Sense sessió, torna a «Entrar».
- Quatre proves de navegador superades, es/va en desktop/mobile, inclòs logout POST i recàrrega després de l’eixida. Lint OK. Publicats només els dos fitxers estàtics; no s’ha reiniciat el servei.
- Recordatori i retirada automàtica continuen desactivats.
