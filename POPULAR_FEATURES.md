# Funcionalidades populares para EduHoot

Listado unificado a partir de un análisis de 20 propuestas inspiradas en
Kahoot y 20 propuestas inspiradas en Wayground, fusionando las que
representan la misma idea de fondo aunque cada plataforma le dé un matiz
distinto (p. ej. "modo equipos" en Kahoot y "modo equipos con relay" en
Wayground se cuentan como una sola propuesta). Resultado: **31 propuestas
únicas** (de las 40 originales, 9 pares se fusionaron en 9 propuestas
"Ambas").

Cada propuesta indica su origen:
- 🟨 **Kahoot** — identificada solo en el análisis de Kahoot.
- 🟦 **Wayground** — identificada solo en el análisis de Wayground.
- 🟩 **Ambas** — identificada en los dos análisis y fusionada en una sola
  entrada.

Ordenadas por popularidad combinada (de mayor a menor) y mantienen la
misma escala de dificultad que los dos documentos de origen:
🟢 Baja / 🟡 Media / 🔴 Alta.

Cada propuesta indica además su **itinerario** (sección
[Roadmap de implementación](#roadmap-de-implementación) al final de este
documento): en qué fase se abordaría, o si queda descartada.

## Listado ordenado por popularidad

1. 🟩 **Ambas** — Modo "tarea"/deberes asíncronos con fecha límite — 🔴 Alta
   El caso de uso más valorado por el profesorado en ambas plataformas; en
   Wayground es además su modo fundacional.
   → **Itinerario: Fase 3** (depende de tener antes el modo autoritmo, propuesta 3).

2. 🟨 **Kahoot** — Podio final animado con confeti — 🟡 Media
   La imagen más icónica y reconocible del género.
   → **Itinerario: Fase 1.**

3. 🟦 **Wayground** — Modo autoritmo (self-paced) — 🔴 Alta
   El rasgo que más caracteriza a Wayground entre las plataformas
   educativas de referencia.
   → **Itinerario: Fase 3** (es la pieza base de la que dependen las propuestas 1, 10 y 27).

4. 🟩 **Ambas** — Power-ups variados (doble puntos manual, robar puntos,
   50/50, congelar racha, "borrador") — 🔴 Alta
   → **Itinerario: Fase 2.**

5. 🟩 **Ambas** — Avatares de personaje personalizables — 🟡 Media
   → **Itinerario: Fase 1.**

6. 🟩 **Ambas** — Modo equipos, con variante de turnos "relay" — 🔴 Alta
   → **Itinerario: Fase 2.**

7. 🟩 **Ambas** — Nuevos tipos de pregunta: ordenar (Jumble) y emparejar
   (Puzzle/Matching) — 🔴 Alta
   → **Itinerario: Fase 2.**

8. 🟦 **Wayground** — Memes y GIFs como feedback de acierto/fallo — 🟡 Media
   → **Itinerario: Fase 1.**

9. 🟨 **Kahoot** — Música/sonido de tensión por fases — 🟡 Media
   → **Itinerario: Fase 1.**

10. 🟦 **Wayground** — Modos de juego inmersivos tipo tablero/arcade
    (Battle Royale, Team Relay, Checkpoint) — 🔴 Alta
    → **Itinerario: Fase 3** (depende del modo autoritmo, propuesta 3; es la de mayor alcance de toda la lista).

11. 🟨 **Kahoot** — Bonificación por racha de aciertos consecutivos —
    🟢/🟡 Baja-Media
    → **Itinerario: Fase 1.**

12. 🟨 **Kahoot** — Generador de apodos aleatorios al unirse — 🟢 Baja
    → **Itinerario: Fase 1.**

13. 🟩 **Ambas** — Lectura en voz alta de la pregunta (TTS / Read Aloud) —
    🟢 Baja
    → **Itinerario: Fase 1.**

14. 🟨 **Kahoot** — Sonido de feedback individual al responder (ding/buzz) —
    🟢 Baja
    → **Itinerario: Fase 1.**

15. 🟦 **Wayground** — Generador de preguntas con IA nativo (desde texto/PDF,
    sin salir de la app) — 🔴 Alta
    → **Itinerario: Fase 4** (integración externa con una API de IA; coste y moderación a resolver antes de diseñarla).

16. 🟨 **Kahoot** — Reacciones en vivo (emoji) enviadas por el jugador —
    🟡 Media
    → **Itinerario: Fase 1.**

17. 🟦 **Wayground** — Tipos de pregunta adicionales (arrastrar y soltar,
    dibujo, respuesta de audio, rellenar huecos, "hotspot" sobre imagen) —
    🔴 Alta
    → **Itinerario: Fase 2** (misma familia de trabajo que la propuesta 7).

18. 🟩 **Ambas** — Informe de progreso del alumno a lo largo del tiempo
    (incluye variante por habilidad/estándar curricular) — 🔴 Alta
    → **Itinerario: ❌ Descartada.** No se llevará ningún histórico de
    resultados del alumnado entre partidas, por respeto a la normativa de
    protección de datos. Esta decisión es independiente de la dificultad
    técnica: no se retomará salvo que esa decisión de producto cambie.

19. 🟦 **Wayground** — Lecciones interactivas (diapositivas + preguntas
    intercaladas) — 🔴 Alta
    → **Itinerario: Fase 4.**

20. 🟩 **Ambas** — Modo de estudio "Flashcards" — 🟡 Media
    → **Itinerario: Fase 1.**

21. 🟦 **Wayground** — Integración con Google Classroom (asignar y
    autocalificar) — 🔴 Alta
    → **Itinerario: Fase 4** (esperar a que la migración de login docente a Authentik quede cerrada antes de construir encima otra integración de identidad).

22. 🟩 **Ambas** — Insignias y niveles de progreso persistentes entre
    partidas/asignaciones — 🔴 Alta
    → **Itinerario: ❌ Descartada.** Igual que la propuesta 18, requiere
    identidad de alumno persistente entre partidas; no se llevará ese
    histórico, por respeto a la normativa de protección de datos.

23. 🟨 **Kahoot** — Pantalla "¡Prepárate!" con cuenta atrás 3-2-1 — 🟢 Baja
    → **Itinerario: Fase 1.**

24. 🟦 **Wayground** — Vídeos integrados "aprende y luego responde" —
    🟡 Media
    → **Itinerario: Fase 1.**

25. 🟦 **Wayground** — Práctica adaptativa (repetir automáticamente las
    preguntas falladas) — 🟡 Media
    → **Itinerario: Fase 1.**

26. 🟨 **Kahoot** — Modo "fantasma"/mejor marca personal en Solo — 🟡 Media
    → **Itinerario: Fase 1.**

27. 🟦 **Wayground** — Modo "presentación" híbrido (proyección + ritmo
    individual) — 🟡 Media
    → **Itinerario: Fase 3** (depende del modo autoritmo, propuesta 3, para sentirse nativa).

28. 🟨 **Kahoot** — "Energizers"/pausas con vídeo entre bloques de
    preguntas — 🟡 Media
    → **Itinerario: Fase 1.**

29. 🟦 **Wayground** — Matchmaking de partidas en vivo contra otras
    clases/desconocidos — 🔴 Alta
    → **Itinerario: Fase 4** (baja prioridad: la base de usuarios docentes real hoy es muy pequeña — 20 cuentas — para justificar una cola de emparejamiento entre centros).

30. 🟨 **Kahoot** — Modo "Time Attack" (cronómetro único para todo el
    cuestionario) — 🟡 Media
    → **Itinerario: Fase 1.**

31. 🟦 **Wayground** — Modo "papel" (sin dispositivo por alumno) — 🟢 Baja
    → **Itinerario: Fase 1.**

## Resumen por origen

- 🟨 **Solo Kahoot**: 10 — podio, música por fases, racha, apodos
  aleatorios, sonido de feedback, reacciones, "¡Prepárate!" 3-2-1, modo
  fantasma, energizers, Time Attack.
- 🟦 **Solo Wayground**: 12 — autoritmo, modos arcade, memes/GIFs, IA
  nativa, tipos de pregunta adicionales, lecciones interactivas, Google
  Classroom, vídeos "aprende y responde", práctica adaptativa, modo
  presentación híbrido, matchmaking, modo papel.
- 🟩 **Ambas**: 9 — deberes asíncronos, power-ups, avatares, modo equipos,
  tipos de pregunta ordenar/emparejar, TTS, informe de progreso,
  flashcards, insignias.

(Estos recuentos son los de la comparativa original Kahoot/Wayground y no
descuentan la propuesta 18, descartada después por motivos de producto —
ver la sección de roadmap.)

## Resumen por dificultad

- 🟢 **Baja**: 5 — apodos aleatorios, TTS, sonido de feedback, "¡Prepárate!"
  3-2-1, modo papel.
- 🟡 **Media**: 13 — podio, música por fases, avatares, memes/GIFs, racha
  (límite baja/media), reacciones, flashcards, modo fantasma, energizers,
  Time Attack, vídeos "aprende y responde", práctica adaptativa, modo
  presentación híbrido.
- 🔴 **Alta**: 13 — deberes asíncronos, power-ups, modo equipos, tipos de
  pregunta ordenar/emparejar, autoritmo, modos arcade, IA nativa, tipos de
  pregunta adicionales, informe de progreso, lecciones interactivas, Google
  Classroom, insignias, matchmaking.

## Lectura de este resumen

Kahoot y Wayground son las dos
plataformas educativas más usadas del sector: su popularidad es una señal
fiable de qué funcionalidades valora de verdad el profesorado y el
alumnado. El objetivo es usar esa evidencia para decidir
dónde invertir esfuerzo con más probabilidad de aportar valor real a
EduHoot.

Las 9 propuestas marcadas como «Ambas» son, en principio, la mejor
inversión: están validadas por el uso real en las dos plataformas, así que
cualquier esfuerzo puesto en ellas tiene alta probabilidad de encajar bien
en el aula. Dentro de esas 9, las de dificultad 🟢/🟡 (avatares, TTS,
flashcards) son candidatas naturales para abordar primero; las de
dificultad 🔴 (deberes asíncronos, power-ups, equipos, tipos de pregunta
nuevos) requieren más diseño previo, pero son las que más enriquecerían la
propuesta pedagógica de EduHoot. Las dos restantes de ese grupo (informe de
progreso e insignias) quedan descartadas — ver más abajo.

## Roadmap de implementación

Esta sección cruza las 31 propuestas anteriores con el resto de la
documentación del repositorio (`PROXIMAS_MEJORAS_PLAN.md`,
`PLAN_ESTABILIDAD_SESION.md`, `REVISION_MEJORAS.md`, los documentos de
migración a Authentik, `FEATURES.md`, `TESTING.md`, `DOCKER_HOWTO.md`,
`docs/DOCKER.md`, `CHANGELOG.md`) para fijar un orden de trabajo realista,
no solo una lista de ideas.

### Hallazgos que condicionan el orden

- **Identidad de alumno no persistente, por decisión de producto.** Las
  propuestas 18 (informe de progreso) y 22 (insignias) quedan descartadas:
  ninguna de las dos necesita solo esfuerzo técnico, sino guardar un
  histórico de resultados del alumnado identificable entre partidas, lo
  cual no se hará por respeto a la normativa de protección de datos.
- **Login docente en transición activa.** La migración a Authentik
  (`docs/PLA-MIGRACIO-AUTHENTIK-2026-10.md`) sigue abierta: hubo un fallo
  real de detección del rol docente detectado el 12 de octubre de 2026, por
  lo que se desactivó la fecha de corte automática del 26 de octubre y no
  hay fecha de cierre nueva todavía. Mientras esto no se cierre, conviene no
  tocar el mismo código de login/sesión (`server.js`) para otra cosa, y
  posponer cualquier propuesta que dependa de una integración de identidad
  docente estable (21, Google Classroom).
- **El código del servidor ha crecido sin reorganizarse.**
  `src/server/server.js` ha pasado de 3.588 a 5.122 líneas desde la
  auditoría de abril (`REVISION_MEJORAS.md`), y `src/public/js/create.js`
  de 3.898 a 4.184. Antes de apilar varias propuestas de dificultad 🔴 ahí
  dentro, conviene ir separando responsabilidades en ficheros propios (p.
  ej. la lógica de tipos de pregunta, antes de añadir los tipos nuevos de
  la Fase 2) para no seguir agravando ese problema.
- **Base ya sólida para mecánicas de juego en vivo.** El plan de
  estabilidad de sesión (`PLAN_ESTABILIDAD_SESION.md`) está completo en el
  código (reconexión, grace period, Wake Lock), aunque el propio documento
  no lo refleje. Las propuestas de las Fases 2 y 3 pueden apoyarse en esa
  base sin preocuparse primero por la reconexión básica.
- **No hay entorno de desarrollo con recarga automática.** `DOCKER_HOWTO.md`
  sigue siendo solo una guía de diseño; hoy cada cambio exige reiniciar
  `node server/server.js` a mano. Implementarlo antes de empezar varias
  propuestas acelera la iteración de todas las fases siguientes.
- **El roadmap de biblioteca pública (`PROXIMAS_MEJORAS_PLAN.md`) es un eje
  aparte.** No compite por el mismo código que estas 31 propuestas (salvo
  parcialmente en "perfil de autor docente"), así que puede avanzar en
  paralelo sin necesidad de secuenciarlo con este documento.

### Fase 0 — Habilitadores (no son propuestas de esta lista)

- Entorno de desarrollo con recarga automática (`DOCKER_HOWTO.md`).
- Dejar que la migración a Authentik se cierre antes de tocar código de
  login/sesión por otro motivo.
- Limpiar los dos hallazgos de seguridad baratos que siguen abiertos desde
  `REVISION_MEJORAS.md` (token de reseteo en logs, logging excesivo),
  antes de que el código nuevo añada más ruido a esa misma zona.

### Fase 1 — Mejoras aisladas, sin tocar la arquitectura del bucle de partida

2 (podio), 5 (avatares), 8 (memes/GIFs), 9 (música por fases), 11 (racha),
12 (apodos aleatorios), 13 (TTS), 14 (sonido de feedback), 16 (reacciones
en vivo), 20 (flashcards), 23 (cuenta atrás 3-2-1), 24 (vídeos "aprende y
responde"), 25 (práctica adaptativa), 26 (modo fantasma), 28 (energizers),
30 (Time Attack), 31 (modo papel).

Son mejoras autocontenidas: tocan un fichero o una vista concreta, sin
cambiar cómo funciona el bucle de partida ni el modelo de datos.

### Fase 2 — Mecánicas de juego de mayor calado, pero autocontenidas

4 (power-ups), 6 (modo equipos), 7 (tipos de pregunta: ordenar/emparejar),
17 (tipos de pregunta adicionales).

Amplían el modelo de datos de la partida (equipos, power-ups, tipos de
pregunta nuevos), pero no cambian el ritmo compartido de la partida: sigue
siendo el host quien controla el avance.

### Fase 3 — Cambio de arquitectura del bucle de partida

3 (modo autoritmo, la pieza base), 1 (deberes asíncronos), 10 (modos
inmersivos tipo arcade), 27 (modo presentación híbrido).

Todas dependen de romper la asunción actual de que todos los jugadores
avanzan al mismo ritmo dirigidos por el host (confirmado en
`FEATURES.md → Avance de pregunta`). Conviene construir primero el modo
autoritmo (3) como primitiva reutilizable, y apoyar en él las otras tres.

### Fase 4 — Integraciones externas o de baja prioridad por escala

15 (generador de preguntas con IA nativo), 19 (lecciones interactivas), 21
(Google Classroom), 29 (matchmaking en vivo entre clases).

Comparten que dependen de factores externos al propio producto (una API de
IA, que la identidad docente de Authentik esté cerrada, o una base de
usuarios mayor a la actual — 20 cuentas docentes reales hoy) más que de
dificultad técnica pura.

### Descartadas

- **18 — Informe de progreso histórico: descartada.**
- **22 — Insignias y niveles persistentes: descartada.**

Ambas requieren guardar un histórico de resultados del alumnado
identificable entre partidas distintas. Es una decisión de producto, no de
dificultad técnica: no se retomarán salvo que esa decisión cambie, por
respeto a la normativa de protección de datos.
