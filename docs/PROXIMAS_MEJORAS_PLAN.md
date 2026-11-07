# Próximas mejoras de EduHoot

## Objetivo
Convertir EduHoot en una biblioteca pública útil para más profesorado, mejorando descubrimiento de quizzes, calidad del contenido y facilidad para reutilizar materiales.

## Principios de producto
- Priorizar impacto en aula por encima de complejidad técnica.
- Hacer fácil compartir, más fácil reutilizar y seguro moderar.
- Medir uso real para decidir qué iterar.

## Hoja de ruta por fases

### Fase 1 (0-2 semanas): base pública usable

#### 1) Visibilidad y descubrimiento
- Mejorar listados públicos con filtros rápidos por etapa, materia, idioma y duración.
- Añadir orden por popularidad reciente y mejor valorados.
- Incorporar sección de "Destacados" en la biblioteca pública.

#### 2) Publicación guiada
- Añadir checklist de publicación:
  - Nivel educativo
  - Materia
  - Idioma
  - Tiempo estimado
  - Etiquetas mínimas
- Bloquear publicación pública si faltan metadatos clave.

#### 3) Métricas mínimas de uso
- Registrar para quizzes públicos:
  - Partidas iniciadas
  - Partidas completadas
  - Jugadores totales
- Mostrar estas métricas en tarjetas de quiz.

#### Entregables Fase 1
- Biblioteca pública mejor filtrada y ordenable.
- Formulario de publicación pública con validación.
- Métricas básicas visibles en el frontend.

#### KPIs Fase 1
- +30% quizzes públicos publicados por semana.
- +20% sesiones en biblioteca pública.
- Tasa de rebote en biblioteca < 40%.

---

### Fase 2 (3-6 semanas): confianza y reutilización

#### 4) Perfil de autor docente
- Crear perfil público con nombre visible y quizzes publicados.
- Mostrar autor en cada ficha de quiz.

#### 5) Clonado con atribución
- Mejorar flujo de clonado de quizzes públicos.
- Guardar referencia de origen ("adaptado de...").
- Mostrar cadena de adaptación básica.

#### 6) Señales de calidad comunitaria
- Añadir valoración + comentario breve opcional.
- Marcar quizzes con alta aceptación (por ejemplo, media >= 4 y mínimo de votos).

#### Entregables Fase 2
- Perfiles públicos de autor.
- Clonado con trazabilidad de origen.
- Sistema de valoración visible en biblioteca.

#### KPIs Fase 2
- +25% clones de quizzes públicos.
- +15% reutilización (quiz clonado y jugado al menos una vez).
- Al menos 40% de quizzes públicos con valoración.

---

### Fase 3 (7-12 semanas): escala y comunidad

#### 7) Colecciones colaborativas
- Permitir crear colecciones temáticas (por etapa/departamento).
- Compartición por enlace de colección.
- Permisos simples: propietario/colaborador/lector.

#### 8) Moderación y seguridad de contenido
- Botón "Reportar" en quizzes públicos.
- Cola de revisión para administradores.
- Estados de contenido: publicado, revisado, oculto.

#### 9) Difusión e integración educativa
- Botones de compartir (Classroom, Teams, Moodle mediante enlace).
- URL pública consistente y amigable.

#### Entregables Fase 3
- Colecciones compartibles con permisos.
- Moderación mínima operativa.
- Integraciones de compartición educativa.

#### KPIs Fase 3
- +50% uso de quizzes públicos por usuarios no autores.
- Tiempo medio de resolución de reportes < 72h.
- +20% tráfico entrante desde enlaces compartidos.

---

## Plan técnico resumido

### Backend
- Extender modelo de quiz con metadatos pedagógicos obligatorios para público.
- Añadir endpoints para:
  - perfiles de autor
  - colecciones
  - reportes de moderación
- Mantener control de permisos por rol en operaciones sensibles.

### Frontend
- Biblioteca pública con filtros y orden avanzado.
- Ficha de quiz con autor, métricas y acciones (jugar, clonar, compartir).
- Flujo de publicación guiada con validaciones claras.

### Datos y analítica
- Definir eventos base:
  - `quiz_publicado`
  - `quiz_clonado`
  - `quiz_jugado`
  - `quiz_completado`
  - `quiz_reportado`
- Dashboard interno de adopción para priorizar iteraciones.

## Riesgos y mitigación
- Riesgo: baja calidad de contenido público.
  - Mitigación: checklist obligatorio + señales de calidad + reportes.
- Riesgo: crecimiento de contenido difícil de navegar.
  - Mitigación: filtros sólidos, destacados y colecciones.
- Riesgo: carga operativa de moderación.
  - Mitigación: reglas simples, estado de revisión y cola priorizada.

## Priorización recomendada
1. Fase 1 completa (base pública sólida).
2. Clonado con atribución (alto impacto y bajo coste relativo).
3. Perfiles y valoraciones.
4. Colecciones y moderación.

## Siguientes pasos inmediatos (esta semana)
1. Definir metadatos mínimos para quiz público (producto + backend).
2. Diseñar wireframe de biblioteca pública mejorada (frontend).
3. Implementar eventos de analítica base.
4. Publicar primera versión de filtros + destacados.
