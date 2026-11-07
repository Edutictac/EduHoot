# Plan: Estabilidad de sesión en modo aula

**Objetivo:** Reducir al mínimo las caídas de alumnos durante una partida en modo aula.  
**Estimación total:** ~3-4 horas de desarrollo.

---

## Diagnóstico

Cuando un alumno "se cae" de la partida pueden ocurrir dos cosas distintas:

- **A) Desconexión temporal** (WiFi inestable, cambio de celda, móvil en reposo) → el socket se corta pero el alumno puede volver.
- **B) Eliminación definitiva** → el servidor borra al jugador porque no reconectó a tiempo.

El problema actual es que el margen entre A y B es demasiado pequeño (15 s) y la app no hace nada para evitar que A ocurra.

---

## Cambios a implementar

### 1 — Ampliar el periodo de gracia del jugador (servidor)
**Archivo:** `src/server/server.js`  
**Impacto:** Alto | **Complejidad:** Mínima (1 línea)

El servidor elimina al jugador 15 s después de que se desconecte. El host tiene 30 s. Igualarlos o ir más allá.

```js
// Buscar la constante o el valor hardcodeado (aprox. línea 3034)
// Cambiar de 15 000 ms a 40 000 ms
const PLAYER_RECONNECT_GRACE_MS = 40 * 1000;
```

- Extraer el valor a una constante con nombre (actualmente es un número literal).
- Usar esa constante en el `setTimeout` de desconexión de jugador.
- Enviar el valor al cliente en el evento de desconexión para que pueda mostrar la cuenta atrás.

---

### 2 — Aumentar intentos de reconexión del cliente
**Archivo:** `src/public/js/playerGame.js`  
**Impacto:** Alto | **Complejidad:** Mínima (2 líneas)

Con 15 intentos y hasta 2 s de pausa, el cliente puede tardar ~20-30 s en agotar los intentos, pero el servidor ya eliminó al jugador a los 15 s.

```js
// Líneas 1-6 — configuración de Socket.IO cliente
var socket = io({
    reconnection: true,
    reconnectionAttempts: 30,       // antes: 15
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000      // antes: 2000
});
```

---

### 3 — Reconectar activamente cuando vuelve la red
**Archivo:** `src/public/js/playerGame.js`  
**Impacto:** Alto | **Complejidad:** Pequeña

Cuando el WiFi cae y vuelve, el navegador emite el evento `online`. Actualmente la app no lo escucha y depende solo del backoff automático de Socket.IO.

```js
window.addEventListener('online', function () {
    if (!socket.connected) {
        socket.connect();
    }
});
```

Opcionalmente mostrar un mensaje diferente cuando se detecta que hay red pero el socket aún no está conectado:

```js
window.addEventListener('offline', function () {
    // mostrar "Sin conexión — esperando red..."
});
```

---

### 4 — Reconectar al volver a la pestaña o desbloquear el móvil
**Archivo:** `src/public/js/playerGame.js`  
**Impacto:** Alto | **Complejidad:** Pequeña

Cuando el alumno bloquea el móvil o cambia de app, el navegador oculta la pestaña (`visibilitychange → hidden`). Al volver (`visible`) el socket puede haber expirado. Detectarlo y forzar reconexión:

```js
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !socket.connected) {
        socket.connect();
    }
});
```

---

### 5 — Mostrar cuenta atrás durante la reconexión
**Archivos:** `src/public/js/playerGame.js`, `src/server/server.js`  
**Impacto:** Medio | **Complejidad:** Media

El alumno ve "Reconectando…" sin saber si ya fue eliminado o cuánto tiempo le queda. Esto provoca que salgan y rompan su token de reconexión.

**Servidor:** al desconectar un jugador, emitir al propio socket (antes de que se cierre) el tiempo de gracia:
```js
socket.emit('playerGracePeriod', { ms: PLAYER_RECONNECT_GRACE_MS });
```

**Cliente:** guardar el valor en localStorage, mostrar una cuenta atrás en el UI:
```
Reconectando... te hemos guardado el sitio durante 35 s
[barra de progreso o contador]
```

Si la cuenta llega a 0 → mostrar "Has salido de la partida" y limpiar estado.

---

### 6 — Wake Lock: evitar que la pantalla se apague durante una pregunta
**Archivo:** `src/public/js/playerGame.js`  
**Impacto:** Medio | **Complejidad:** Pequeña

Solicitar al navegador que mantenga la pantalla encendida mientras hay una pregunta activa. La API es estándar en Chrome/Edge/Android; en iOS Safari no está soportada (se degrada silenciosamente).

```js
var wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
    }
}

function releaseWakeLock() {
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
}

// Llamar requestWakeLock() al recibir una nueva pregunta
// Llamar releaseWakeLock() al mostrar resultados o al salir
```

Reactivar el wake lock cuando la pestaña vuelve a ser visible (se libera automáticamente al ocultarse):
```js
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') requestWakeLock();
});
```

---

## Orden de implementación recomendado

```
Día 1 (1-2 h) — Cambios de bajo riesgo, alto impacto
  [x] #1 Grace period 40 s + constante con nombre
  [x] #2 Aumentar intentos de reconexión cliente
  [x] #3 Listener online/offline
  [x] #4 Listener visibilitychange

Día 2 (1-2 h) — Mejora de UX
  [ ] #5 Cuenta atrás de gracia en el cliente
  [ ] #6 Wake Lock durante preguntas
```

---

## Archivos afectados

| Archivo | Cambios |
|---------|---------|
| `src/server/server.js` | Constante `PLAYER_RECONNECT_GRACE_MS`, emitir tiempo de gracia al desconectar |
| `src/public/js/playerGame.js` | Opciones Socket.IO, listeners `online`/`offline`/`visibilitychange`, Wake Lock, UI cuenta atrás |

---

## Notas

- Estos cambios no afectan al modo multijugador libre ni al modo solo.
- El sistema de tokens en `localStorage` ya está implementado — los cambios propuestos lo aprovechan, no lo reemplazan.
- En iOS Safari el Wake Lock no está soportado; la única mitigación posible es mostrar un aviso ("Mantén la pantalla encendida durante la partida").
