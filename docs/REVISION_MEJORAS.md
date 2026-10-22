# Revision de la aplicacion y propuestas de mejora

Fecha: 2026-04-29
Proyecto: EduHoot

## Resumen ejecutivo
Se ha realizado una revision tecnica de frontend, backend, dependencias y calidad del proyecto.
El resultado principal: hay oportunidades claras de mejora en seguridad, mantenibilidad y testing.

## Hallazgos prioritarios

### 1) Alta - Dependencias con vulnerabilidades conocidas
- Evidencia: `src/package.json` usa versiones antiguas de Express y Socket.IO.
- Verificacion: `npm audit --omit=dev --json` reporta 10 vulnerabilidades (2 altas, 5 moderadas, 3 bajas).
- Riesgo: ReDoS y problemas de estabilidad/seguridad en canal realtime.

### 2) Alta - Riesgo de XSS por uso de innerHTML con datos dinamicos
- Evidencia en frontend:
  - `src/public/js/hostGame.js` (question y otros campos renderizados con `innerHTML`)
  - `src/public/js/playerGame.js` (mensajes con concatenacion HTML)
  - `src/public/js/create.js` (estado de importaciones con `innerHTML`)
- Riesgo: inyeccion de scripts via contenido de quiz/jugador.

### 3) Alta - Endpoints de auth sin rate limiting especifico
- Endpoints afectados:
  - `POST /api/auth/login`
  - `POST /api/auth/request-reset`
  - `POST /api/auth/reset`
- Existe rate limiter para subida CSV, pero no para login/reset.
- Riesgo: fuerza bruta y abuso de recuperacion de cuenta.

### 4) Media-Alta - Sesiones en memoria sin expiracion/persistencia
- Evidencia: sesiones guardadas en `Map` en backend.
- Riesgo:
  - no escala horizontalmente,
  - se pierden sesiones en reinicio,
  - potencial crecimiento de memoria.

### 5) Media - Token de reseteo mostrado en logs
- Evidencia: ruta de request-reset imprime token en logs.
- Riesgo: toma de cuenta por acceso a logs.

### 6) Media - Posible fuga de memoria en mapa de tokens de jugadores
- Evidencia: `src/server/utils/players.js` guarda token->player, pero en `removePlayer` no elimina token asociado.
- Riesgo: crecimiento del mapa con partidas largas/muchas reconexiones.

### 7) Media - Logging excesivo en produccion
- Hay muchos `console.log` y `console.error` con detalle operativo.
- Riesgo: ruido, coste de observabilidad y exposicion de datos de contexto.

### 8) Media - Sin suite de tests automatizados
- Evidencia: `npm test` devuelve "Error: no test specified".
- Riesgo: regresiones al tocar auth, juego y parser CSV.

### 9) Media - Complejidad alta por archivos monoliticos
- Archivos muy grandes:
  - `src/server/server.js` (3588 lineas)
  - `src/public/js/create.js` (3898 lineas)
  - `src/public/js/multiplayer.js` (2380 lineas)
  - `src/public/js/solo.js` (2201 lineas)
- Impacto: mantenimiento dificil, onboarding mas lento y mayor riesgo en cambios.

## Propuestas de mejora (prioridad por impacto)

### Fase 1 (1-3 dias) - Seguridad inmediata
1. Actualizar dependencias criticas (Express + Socket.IO y transitivas vulnerables).
2. Sustituir `innerHTML` por `textContent` donde no sea imprescindible HTML.
3. Donde si haga falta HTML, sanitizar (por ejemplo con DOMPurify).
4. Aplicar rate limiting en login y recuperacion de password.
5. Añadir cabeceras de seguridad (Helmet).

### Fase 2 (2-4 dias) - Endurecer autenticacion y sesiones
1. Mover sesiones a almacenamiento con TTL (Redis o Mongo con expiracion).
2. Definir expiracion por inactividad y expiracion absoluta de sesion.
3. Guardar hash del reset token en BD (no token en claro).
4. Eliminar log de reset token en produccion.

### Fase 3 (1-2 dias) - Estabilidad realtime
1. Corregir limpieza de tokens en `Players.removePlayer`.
2. Añadir validacion de payloads de Socket.IO.
3. Limitar tamaño/frecuencia de eventos cliente->servidor.

### Fase 4 (1 semana inicial) - Calidad continua
1. Configurar ESLint real (no solo chequeo sintactico).
2. Crear base de tests:
   - unitarios para `importCsv` y `questionUtils`,
   - integracion para auth,
   - humo de flujo host/player.
3. Activar CI para lint + tests.

### Fase 5 (continuo) - Refactor incremental
1. Separar backend por modulos (auth, quizzes, stats, realtime, admin).
2. Separar frontend por vistas y utilidades compartidas.
3. Objetivo: reducir tamaño de archivos y facilitar PRs pequeños.

## Quick wins recomendados (orden propuesto)
1. Corregir XSS en host/player/create.
2. Rate limit en auth/reset.
3. Parche de token leak en `Players`.
4. Bloquear log de reset token en entorno productivo.
5. Actualizar Socket.IO y validar compatibilidad de cliente.

## Estado de verificaciones ejecutadas
- `npm run lint`: OK (sintaxis valida en 20 archivos)
- `npm test`: falla (no hay tests definidos)
- `npm audit --omit=dev`: 10 vulnerabilidades reportadas

## Nota
Este documento es una revision diagnostica; no aplica cambios de codigo por si mismo.
