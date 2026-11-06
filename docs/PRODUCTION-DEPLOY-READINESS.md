# Consulta de partides abans d'un desplegament

El desplegament de producció reinicia el contenidor i talla les connexions de
les partides en curs. Un desplegador automatitzat ha de consultar l'estat viu
de l'aplicació just abans del reinici.

`GET /api/internal/deploy-readiness` retorna `ready` i `activeGames`. La ruta
només respon si `EDUHOOT_DEPLOY_READINESS_TOKEN` està configurat i la petició
inclou el mateix valor en la capçalera `X-EduHoot-Deploy-Token`. Si falta la
configuració o la clau és incorrecta, retorna 404. La resposta no es guarda
en memòria cau.

La clau s'ha de generar aleatòriament i guardar només en la configuració
privada del contenidor i del desplegador. No s'ha de posar en el repositori,
en les ordres del shell, en els logs ni en GitHub Actions. Cal impedir que
nginx publique esta ruta; el desplegador l'ha de consultar directament en
`127.0.0.1:3000`.

Esta ruta és una peça prèvia al permís de desplegament. Encara cal preparar i
provar un desplegador que:

1. Promoga una imatge immutable que ja estiga desplegada i sana en stage.
2. Bloquege noves partides i comprove `ready` immediatament abans del canvi.
3. Faça còpia de MongoDB, imatges pujades i configuració de Docker.
4. Comprove la salut i l'HTTP després del canvi i restaure la imatge anterior
   si falla.
5. Registre el resultat i limite qui pot iniciar l'operació.

Fins que tot això estiga instal·lat i provat, esta ruta no autoritza ningú a
desplegar en producció.
