# Historial de entregas — Seguimiento de Indicadores

Cada entrega de esta app, en orden cronológico: qué se pidió, qué se decidió y por qué, qué
se verificó y contra qué base, y cómo se desplegó.

**Esto es el relato, no la referencia.** Lo que hace falta para trabajar —arquitectura,
endpoints, cómo correrlo, las invariantes que no hay que "arreglar", migraciones y
despliegue— vive en `CLAUDE.md`, que es el archivo que se carga en contexto. Acá está el
detalle completo de cada entrega para cuando haga falta reconstruir por qué algo quedó como
quedó: hashes de bundle, comandos de rollback de cada despliegue, conteos de verificación.

Se separó de `CLAUDE.md` el 2026-09-11, cuando ese archivo pasó las 900 líneas y el relato
de ocho entregas empezó a tapar lo que se necesita para trabajar.

---

## Verificado el 2026-08-28

Contra `rrhh_bd_dev`: las 4 queries de `alertas_service.py` corren sin error (119
inactividad, 6 turnos, 32 reincidencia, 105 producción MTD — los números no van a coincidir
con los que documenta Lab 001 para una fecha puntual, dev es un clon que cambia con el
tiempo). `POST /llamadas` + historial + enriquecimiento de "última llamada" probados
end-to-end vía HTTP real. Frontend: `npm run build` compila sin errores (3007 módulos). No
se pudo probar visualmente en navegador esta sesión (la automatización de Chrome no
respondía) — falta un recorrido manual en el navegador antes de darlo por completo.

## Contacto por WhatsApp + motivo de bajo rendimiento (2026-08-28)

Pedido del usuario: un botón que facilite el contacto por WhatsApp, y que el formulario de
registro capture el motivo que da el afiliador para su bajo rendimiento (la información que
esta app existe para recopilar), no solo si contestó o no.

- **Botón de WhatsApp** (`frontend/src/lib/whatsapp.js`, `armarLinkWhatsapp()`): arma un link
  `wa.me` con el teléfono (anteponiendo `591`, los números de `empleado_unidad.telefono` son
  locales de 8 dígitos) y un saludo inicial editable — **simplificado a `Hola, <Nombre>` el
  2026-08-31** a pedido del usuario (antes tenía un mensaje largo predefinido explicando el
  motivo del contacto; se acortó porque la conversación real la lleva quien llama, no un
  texto enlatado). Es un `<a target="_blank">` renderizado vía el prop `render` de
  `@base-ui/react` sobre el componente `Button` — abre el chat en una pestaña nueva, **no
  registra nada por sí solo**.
- **"Registrar" queda separado del botón de WhatsApp a propósito**: la respuesta de la
  persona llega después de la conversación, no en el momento de abrir el chat, así que
  acoplar los dos hubiera forzado a llenar el formulario antes de tener qué contar.
- **Dos columnas nuevas en `seguimiento_llamada`** (`migrations/002_add_medio_y_motivo.sql`,
  aplicada en `rrhh_bd_dev` y en `rrhh_bd` prod el 2026-08-31):
  - `medio_contacto` (`LLAMADA` · `WHATSAPP` · `OTRO`, default `WHATSAPP` en el formulario —
    es el canal que se está empujando)
  - `motivo_bajo_rendimiento`, categorizado con "Otro" de escape (`SALUD`,
    `PERSONAL_FAMILIAR`, `OTRO_TRABAJO`, `NO_LE_GUSTA_TURNO`, `PAGO_COMISIONES`,
    `DIFICULTAD_SISTEMA`, `SIN_MOTIVO_CLARO`, `OTRO`) — decisión tomada con el usuario para
    poder reportar "cuántos se van por X motivo" sin leer notas de texto libre a mano.
  - Aplicada en `rrhh_bd_dev` y en `rrhh_bd` (prod, 2026-08-31).
- Se muestran en la celda "Último contacto" de la tabla (ícono de WhatsApp + motivo) y en el
  historial completo por persona.

Verificado end-to-end vía HTTP contra `rrhh_bd_dev` (POST con `medio_contacto`+
`motivo_bajo_rendimiento`, enriquecimiento en `/alertas/inactividad`). El `render` prop del
`Button` sobre un `<a>` se probó con SSR (`renderToStaticMarkup`) antes de confiar en él, ya
que la automatización de Chrome no funcionaba esta sesión.

## Filtros y orden en Inactividad (2026-08-31)

Pedido del usuario tras probar la app en local: poder filtrar la lista de Inactividad por
Unidad, Supervisor y Tramo, y ordenarla por fecha de última afiliación de menor a mayor.

- **`frontend/src/hooks/useAlertaListState.js`**: el hook genérico (antes solo filtro de
  texto + paginación) ahora también soporta `camposFiltro` (array de nombres de campo → un
  `SelectField` por campo, con opciones calculadas sobre el total sin filtrar para que no se
  achiquen entre sí) y `sort`/`onSortChange` (un solo campo ordenable a la vez, tres estados
  por click: asc → desc → sin orden). Genérico a propósito para poder reusarse en las otras
  3 pestañas si hace falta más adelante, aunque por ahora solo se activó en Inactividad.
- **`frontend/src/components/seguimiento/TablaAlertas.jsx`**: las columnas pueden declarar
  `sortKey` — si lo tienen, el header se renderiza como botón clickeable con flecha
  (`ArrowUp`/`ArrowDown` de lucide-react) indicando el sentido actual.
- **`frontend/src/pages/SeguimientoPage.jsx`**: la pestaña Inactividad pasa
  `filtroCampos={[unidad_negocio, supervisor, tramo]}` y la columna "Última afiliación"
  lleva `sortKey: 'fecha_ultima_afiliacion'`. Las otras 3 pestañas quedaron sin filtros
  adicionales — no se pidieron ahí.
- Se sacó además la bajada descriptiva bajo el título "Seguimiento de indicadores" (pedido
  explícito del usuario, sin reemplazo).

Todo esto es client-side (arrays ya traídos por `useQuery`) — no hay cambios de backend ni
de query SQL para esta parte.

## Vista de teléfono: una tarjeta por persona (2026-09-01)

Pedido del usuario tras usar la app desde el celular: cada persona más alta, con los 3
botones en una segunda línea, para no tener que desplazarse a la derecha a buscarlos.

- **`TablaAlertas.jsx` ahora tiene dos vistas del mismo dato, elegidas por CSS** (`md:hidden`
  / `hidden md:block`), no por `useIsMobile()` — así no parpadea en la primera pintura ni
  depende de `matchMedia`. Debajo de `md` (768px) se renderiza una tarjeta por persona
  (nombre + CI, datos en dos columnas, último contacto) y, separados por un `border-t`, los
  3 botones en un `grid grid-cols-3` con `size="touch"` (44px, el mínimo táctil) y su
  etiqueta visible: WhatsApp · Registrar · Historial. En escritorio, la tabla de siempre sin
  cambios de layout.
- **`Acciones` y `CeldaUltimoContacto` son componentes compartidos por las dos vistas** — no
  hay dos copias de la lógica de los botones ni del enriquecimiento de última llamada.
- **`BarraOrden`**: en la tarjeta no hay encabezado de tabla donde clickear, así que las
  columnas con `sortKey` se exponen como chips arriba de la lista (mismo ciclo asc → desc →
  sin orden). Sin esto, ordenar era imposible desde el teléfono.
- **`SeguimientoPage.jsx`**: los filtros pasan a `grid grid-cols-2` en teléfono (un select
  por línea era demasiado alto) y vuelven a la fila de siempre desde `sm`; la fila de
  pestañas se desplaza en horizontal sangrando el padding de la página (`-mx-4 px-4`) porque
  las 4 no entran en un teléfono, con `h-11` táctil.
- Se sumó `tabular-nums` a CI, teléfono, fechas y columnas de métrica: son números que
  cambian entre filas y al reordenar, y con dígitos proporcionales la columna "baila".

⚠️ **No verificado visualmente en un navegador**: la automatización de Chrome de esta sesión
no llega a `localhost` (carga `https://example.com` sin problema, pero `127.0.0.1:5177` da
página de error). Sí se verificó que `npm run build` compila. Falta un recorrido real en un
teléfono antes de darlo por cerrado.

## Disponibilidad horaria de la persona (2026-09-01)

Pedido del usuario: que desde la página se sepa si una persona es de **medio tiempo, tiempo
completo o turno mañana/tarde** — para saber a qué hora tiene sentido llamarla y con qué
expectativa medir su producción.

**El dato no existía completo en ninguna tabla de Lab 001** (verificado en `rrhh_bd_dev`):

| Fuente | Cobertura |
|---|---|
| `empleado_unidad.disponibilidad_tiempo` | La columna existe pero está **100% NULL** (436 activos, 0 con dato) |
| `proceso_reclutamiento.disponibilidad_tiempo` | Sí tiene dato, texto libre del formulario de reclutamiento, pero sólo cubre a quien entró por ahí: **24 de 119** en alerta de Inactividad (~20%). El resto es personal legado que nunca llenó ese formulario |

Por eso la solución tiene dos niveles, y el de más arriba pisa al de abajo:

1. **`seguimiento_disponibilidad`** (tabla propia, `migrations/003`) — lo que confirmó quien
   contactó a la persona desde esta app. Origen `REGISTRADA`.
2. **Heredado de Lab 001** — `empleado_unidad.disponibilidad_tiempo` y, si no, la última
   `proceso_reclutamiento` de esa persona. Origen `RECLUTAMIENTO`.

Sin nada de eso, la fila viaja igual con `disponibilidad: null` y label `"Sin dato"` — a
propósito, para que el filtro de la UI tenga una opción con la que encontrar justamente a
quienes falta preguntarles.

- **`backend/app/services/disponibilidad_service.py`**: resuelve los dos niveles en **una
  consulta por lista** (mismo criterio que el enriquecimiento de "última llamada" — no una
  query por fila) y **normaliza** el texto libre de reclutamiento a códigos propios
  (`TIEMPO_COMPLETO` · `MEDIO_TIEMPO` · `TURNO_MANANA` · `TURNO_TARDE` · `NO_DEFINIDO`)
  comparando sin acentos, porque el formulario mezcla `"Turno Mañana"` con `"Tarde"`. Lo que
  no se reconoce (visto en dev: `"Tiempo Imparcial"`) cae en `NO_DEFINIDO` en vez de
  descartarse — "vino algo raro" no es lo mismo que "no hay dato".
- **Las 4 listas de alerta** salen enriquecidas con `disponibilidad`, `disponibilidad_label`,
  `disponibilidad_origen`, `disponibilidad_registrado_por` y `disponibilidad_actualizada`
  (`_enriquecer_con_ultima_llamada` en `alertas_service.py`, ahora hace las dos cosas).
- **Se escribe desde el formulario de "Registrar contacto"**, no desde un endpoint aparte:
  el momento en que se averigua la disponibilidad es justamente la conversación. `LlamadaIn`
  acepta un `disponibilidad` opcional que el router saca del payload y guarda con upsert en
  `seguimiento_disponibilidad`, **en el mismo commit que la llamada** (o se guardan las dos
  cosas, o ninguna). No es una columna de `seguimiento_llamada` porque es un atributo de la
  persona, no del contacto: una fila por empleado, la última confirmación pisa a la anterior.
  El campo llega **precargado** con lo que ya se sabe, así sirve tanto para confirmar como
  para corregir.
- **UI**: columna fija "Disponibilidad" en **las 4 pestañas** (es dato de la persona, no
  métrica de una fuente) — badge con la etiqueta y, debajo, el origen (`confirmado` vs.
  `de reclutamiento`), presente tanto en la tabla de escritorio como en la tarjeta de
  teléfono. Y un filtro por `disponibilidad_label` en las 4 pestañas, reusando el
  `camposFiltro` genérico de `useAlertaListState` sin tocarlo.

Verificado end-to-end contra `rrhh_bd_dev` vía HTTP: las 4 rutas devuelven la distribución
esperada, un `POST /llamadas` con `disponibilidad` la deja `REGISTRADA`, y un `POST`
posterior **sin** ese campo no la pisa. Las filas de prueba se borraron.

### Por qué el 79% queda en "Sin dato" (diagnosticado contra prod, 2026-09-01)

Pregunta del usuario al ver la app desplegada. **No es un bug de la app ni un cruce mal
hecho** — es de dónde nace el dato. Diagnóstico sobre `rrhh_bd` (449 afiliadores activos):

| | Cuántos |
|---|---|
| Tienen dato en `empleado_unidad.disponibilidad_tiempo` | 8 |
| Tienen dato heredado de `proceso_reclutamiento` | 87 |
| **Sin ningún proceso de reclutamiento → sin dato posible** | **354 (79%)** |

El formulario de reclutamiento **funciona perfecto**: 2.502 procesos en 2026, los 2.502 con
`disponibilidad_tiempo` cargada. El problema es que la mayoría de los afiliadores activos
nunca lo llenó.

- **Descartado que sea un problema de join o de personas duplicadas**: se buscó, para esos
  354, si existía un proceso a nombre del **mismo CI** con otro `id_persona` → **0
  recuperables**. Realmente no tienen proceso. (Por eso tampoco sirve cambiar el join a CI.)
- **La causa está en `fecha_creacion`: 292 de los 354 se crearon el mismo día, el
  2026-07-20** — la carga masiva de la nómina que ya trabajaba cuando se puso en marcha el
  sistema. Entraron directo a `empleado_unidad` sin pasar por el módulo de reclutamiento
  porque ya estaban contratados; para ellos el dato **nunca pudo existir**.
- Los ~62 restantes son altas posteriores que tampoco pasaron por el módulo, pero **eso
  mejora mes a mes**: de las altas de 2026-01, 3 de 19 entraron por reclutamiento; de las de
  2026-08, 24 de 54 (16% → 44%). El hueco se cierra solo para la gente nueva; los 292 de la
  carga inicial no.

**Decisión del usuario (2026-09-01): no agregar todavía una edición directa de la
disponibilidad.** Se evaluó un `PUT /disponibilidad` con un select editable en la fila —para
cargar en lote lo que los supervisores ya saben, sin fingir un contacto— y se prefirió que
se vaya llenando sola a través del formulario de "Registrar contacto", así cada dato queda
respaldado por una conversación real. El filtro "Sin dato" existe justamente para ir
encontrando a quiénes falta preguntarles. La otra vía posible, si algún día urge, es que
RRHH/Lab 001 llenen `empleado_unidad.disponibilidad_tiempo` en el origen: esta app ya la lee
**con prioridad sobre reclutamiento**, así que aparecería sola sin tocar código.

## Los 4 turnos en la pestaña de Turnos (2026-09-01)

Pregunta del usuario: *"¿por qué no veo a los que no subieron más de 5 personas en la
mañana?"*. No era un problema de datos — la alerta existía en Lab 001 y esta app la
filtraba.

`config_umbral_turno` tiene umbrales para los 4 turnos, con **dos operadores distintos**:

| Turno | Regla | Qué detecta |
|---|---|---|
| NOCHE, MADRUGADA | `> 10` | Carga sospechosa fuera de horario |
| MAÑANA, TARDE | `< 5` | **Bajo rendimiento** |

`_TURNOS_SQL` traía hardcodeado `turno IN ('NOCHE','MADRUGADA')`, heredado de replicar la
hoja "alerta" de `15_actividad_por_turno.py` — así que MAÑANA/TARDE nunca llegaban al
frontend. En `rrhh_bd_dev` eso escondía **349 personas en alerta de MAÑANA y 338 de TARDE**
(contra 2 de MADRUGADA y 4 de NOCHE).

- **`alertas_service.get_turnos`** ya no filtra por turno: el CTE `ultima_fecha` agrupa por
  turno y cada uno entra con **su propia última fecha calculada** (Lab 001 no siempre cierra
  los 4 el mismo día — visto en dev: MAÑANA/MADRUGADA al 21/08, NOCHE/TARDE al 20/08).
- **El orden depende del operador**: `CASE WHEN operador = '<' THEN cantidad ELSE -cantidad
  END`, para que "lo peor" quede primero en los dos sentidos (la cantidad más baja con `<`,
  la más alta con `>`). El `ORDER BY cantidad DESC` anterior habría puesto último al que
  produjo 0 en la mañana.
- **La UI no necesitó nada nuevo**: la pestaña de Turnos ya tenía el filtro por `turno` del
  `camposFiltro` genérico. Sólo se actualizó la bajada y se sumó `sortKey` a las columnas
  Cantidad y Fecha, porque con ~700 filas ordenar dejó de ser opcional.

⚠️ **Dos filtros siguen a propósito en NOCHE/MADRUGADA, y no hay que "arreglarlos":**

1. **Reincidencia** (`_TURNOS_REINCIDENCIA`, la constante que quedó): ese indicador existe
   para detectar el *hábito* de cargar fuera de horario. Sumarle MAÑANA/TARDE cambiaría en
   silencio el `veces_en_alerta` de cada persona y sus números dejarían de cuadrar con el
   Excel de `17_exportar_alerta_turnos.py`.
2. **La exclusión de Producción MTD** (literal dentro de `_PRODUCCION_MTD_SQL`): es uno de
   los 4 filtros de `18b`. Con `< 5` alertando a ~90% de los medidos, sumarlo ahí dejaría la
   pestaña de Producción MTD prácticamente vacía.

⚠️ **El umbral `< 5` marca a casi todo el mundo** (349 de 384 medidos en el último cálculo
de dev, 91%). Como lista de trabajo es poco accionable tal cual; si JP la va a usar en
serio, conviene revisar ese número con Lab 001 (vive en `config_umbral_turno`, cambiarlo
recolorea toda la historia sin recalcular nada). Se deja como está porque el criterio es de
Lab 001, no de esta app.

Verificado contra `rrhh_bd_dev` llamando a los 4 servicios: turnos pasa de 6 a **693**
(2 MADRUGADA + 349 MAÑANA + 4 NOCHE + 338 TARDE), con el orden correcto en los dos sentidos;
**inactividad (119), reincidencia (32) y producción MTD (105) quedan idénticos**, que era el
punto. `npm run build` compila.

## Contacto al supervisor: la alerta agrupada por líder a cargo (2026-09-01)

Pedido del usuario: que el llamado de atención vaya **al supervisor / líder a cargo**, no
sólo al afiliador — "podemos agruparlos por supervisor y que así sea como se vea, y el
mensaje debería pasar la info de cada supervisor por sus afiliadores que no están saliendo".

Decisiones tomadas con el usuario antes de escribir código: **una 5ta pestaña
"Supervisores"** (las 4 existentes quedan intactas, siguen sirviendo para hablar con la
persona); el mensaje lleva la lista **del indicador seleccionado**, uno a la vez; el
contacto se registra en una **tabla nueva, una fila por contacto** (no por afiliador); y
los afiliadores sin supervisor asignado se muestran igual, agrupados aparte.

### El teléfono del supervisor: se resuelve sin tocar Lab 001

Las 3 vistas exponen `supervisor` **sólo como texto** (el nombre armado con `CONCAT_WS`),
ni el id ni el teléfono. Pero el camino existe y la app lo recorre sola:

`empleado_unidad.id_empleado` → `eu.id_persona_supervisor` → `persona.teléfono`

Se usa `persona.teléfono` y no la fila `empleado_unidad` del propio supervisor por dos
razones medidas: cubre más (108 vs. 104 en dev sobre Inactividad) y `persona` es una fila
por `id_persona`, mientras que `empleado_unidad` tiene 4 personas con más de una fila
activa. **El nombre que muestra la vista sale de esa misma fila de `persona`** (las 3
vistas hacen `LEFT JOIN persona sup ON sup.id_persona = eu.id_persona_supervisor`), así que
no hay riesgo de escribirle a uno mientras la pantalla dice otro, y no hace falta traer el
nombre de nuevo.

Cobertura verificada el 2026-09-01: en `rrhh_bd` (prod) 423 de 449 activos tienen supervisor
y 384 de 405 filas de Turnos resuelven teléfono; en `rrhh_bd_dev`, 109/119 y 108/119.

- **`backend/app/services/supervisores_service.py`**: `datos_supervisor_por_empleado()`,
  **una consulta por lista** (mismo criterio que última llamada y disponibilidad).
- **`_enriquecer_con_ultima_llamada` pasó a llamarse `_enriquecer_filas`** — ya hacía dos
  cosas y ahora hace tres.
- ⚠ **Ninguna de las 4 queries SQL de alerta se tocó**: el dato se agrega en el
  enriquecimiento, no en el `SELECT`. Por eso los criterios de Lab 001 quedan intactos y la
  cantidad de filas no puede cambiar por un JOIN nuevo (verificado: 119 / 693 / 32 / 105,
  idénticos al baseline).

### `seguimiento_contacto_supervisor` (migración 004)

Tabla propia, aplicada en `rrhh_bd_dev` el 2026-09-01 y en `rrhh_bd` (prod) el
2026-09-02, con `aplicar_migracion.py` y confirmación explícita del usuario — igual que las
3 anteriores.

- **Una fila por contacto, no por afiliador**: un mensaje habla de N personas a la vez.
  Meter una fila por afiliador en `seguimiento_llamada` habría llenado el historial de cada
  persona con contactos que nunca fueron a ella.
- **`afiliadores` es JSONB, no un `BIGINT[]` de ids**: con sólo ids, dentro de una semana el
  historial no puede reconstruir el mensaje — la métrica que lo motivaba ("45 días sin
  afiliar") ya no existe en ninguna vista, porque la alerta se recalcula todos los días. Se
  guarda `[{id_empleado, nombre, metrica}]`, mismo criterio que `snapshot_metrica`.
  `cantidad_afiliadores` la **deriva el backend** con `len(afiliadores)`, no llega del
  cliente: son dos vistas del mismo hecho y no tiene sentido que se desincronicen.
- **`id_persona_supervisor` va sin FK**, a diferencia del `REFERENCES empleado_unidad(...)`
  de las migraciones 001 y 003. Lab 001 la declara como referencia blanda y su propia
  validación *cuenta* los huérfanos como métrica esperada; con una FK, registrar un contacto
  a un supervisor huérfano fallaría con un 500 justo al usarlo. Hoy no hay ninguno
  (verificado en dev y prod), pero el origen permite que aparezcan, y `supervisor_nombre`
  desnormalizado cubre la trazabilidad.
- Endpoints (`routers/supervisores.py`): `POST /contactos-supervisor`,
  `GET /contactos-supervisor/ultimos?fuente=...` (el último de cada supervisor en una sola
  consulta, acotado al indicador — "ya le escribí por su gente de Turnos" no contesta
  "¿le escribí por sus inactivos?") y
  `GET /contactos-supervisor/historial/{id_persona_supervisor}`.

### Frontend

- **`lib/supervisores.js`**: `agruparPorSupervisor()` agrupa por `id_persona_supervisor` y
  **no por el nombre** (dos homónimos colapsarían y se le mandaría a uno la gente del otro).
  Orden: el que más gente en alerta tiene primero; el grupo sin líder **siempre ultimo**,
  porque no es una lista de trabajo sino el pendiente de asignarle supervisor a esa gente en
  Lab 001. `metricaDeFila()` formatea la métrica de cada indicador como texto — se congela
  así en el snapshot.
- **`lib/whatsapp.js` `armarLinkWhatsappSupervisor()`**: a diferencia del mensaje al
  afiliador (un saludo corto a propósito), este sí lleva contenido. Corta por **dos**
  condiciones (12 nombres **y** 1200 caracteres ya encodeados), porque cada una falla sola:
  12 nombres cortos entran, 12 con métrica larga no. En Turnos el corte se va a notar
  (~700 filas sobre ~40 supervisores ≈ 17 por cabeza) — por eso la pestaña tiene filtros
  propios: el mensaje accionable sale de filtrar, no de mandar la lista entera.
- **`components/ui/accordion.jsx`**: wrapper de `@base-ui/react/accordion`, mismo patrón que
  `tabs.jsx`/`dialog.jsx`. Se usó la primitiva y no un `useState` a mano por lo que trae
  gratis: `aria-expanded`, `role="region"`, navegación con flechas y
  `--accordion-panel-height` para animar sin medir.
- **`hooks/useSupervisoresState.js`**: monta **su propia instancia** de `useAlertaListState`,
  no reusa las 4 de las otras pestañas — compartirlas haría que un filtro puesto en la
  pestaña de Turnos apareciera aplicado acá sin que nadie lo tocara. No cuesta una consulta
  extra: TanStack Query dedupea por `queryKey` y las 4 ya están en caché. Agrupa sobre
  `filtradas` (la lista completa, agregada al retorno del hook) y no sobre `items` (la
  página de 25), que daría equipos parciales.
- **`lib/contacto.js`**: `RESULTADO_LABEL`/`_VARIANT`/`RESULTADOS`/`MEDIOS`/`FUENTE_LABEL`,
  que estaban **triplicados** entre `TablaAlertas`, `RegistrarLlamadaDialog` e
  `HistorialLlamadasDialog`; con los dos diálogos nuevos habrían sido cinco copias.
- **Tres estados distintos en la cabecera del grupo**, que no hay que confundir:

  | Caso | WhatsApp | Registrar / Historial |
  |---|---|---|
  | Sin `id_persona_supervisor` | ✗ | ✗ — grupo de sólo lectura, "hay que asignarle líder" |
  | Con id, sin teléfono | ✗ (deshabilitado) | ✓ (se registra igual, por llamada) |
  | Con id y teléfono | ✓ | ✓ |

- El diálogo de registro **no tiene** `disponibilidad` ni `motivo_bajo_rendimiento`: los dos
  son datos del afiliador, y meter acá el motivo que supone el supervisor ensuciaría el
  reporte de "cuántos se van por X motivo".

### Verificado el 2026-09-01

Contra `rrhh_bd_dev`: las 4 rutas devuelven `id_persona_supervisor`/`supervisor_telefono`
con **la misma cantidad de filas que antes**; `POST /contactos-supervisor` por HTTP real
deriva `cantidad_afiliadores` sin que el cliente lo mande, el JSONB va y vuelve intacto, y
`?fuente=` acota (1 en INACTIVIDAD, 0 en TURNOS). Filas de prueba borradas.

El render se verificó con **SSR sobre los datos reales de la API** (`renderToStaticMarkup`,
mismo recurso que se usó para el `render` prop del Button): 119 filas → 34 grupos, la suma
por grupo da exactamente 119 (no se pierde ni duplica nadie), el grupo sin líder queda
último, el mensaje de WhatsApp sale con nombres y métricas reales, el botón queda
deshabilitado en el supervisor sin teléfono y el grupo sin líder no tiene botones.
`npm run build` compila.

⚠ **Sigue sin haber un recorrido visual en navegador**: la automatización de Chrome de esta
sesión llega a `example.com` pero da página de error en `localhost` y `127.0.0.1` (mismo
bloqueo de las dos sesiones anteriores). Falta un recorrido manual, sobre todo del acordeón
en teléfono.

⚠ **Ojo con los servidores viejos al probar**: había un uvicorn de una sesión anterior
escuchando en el 8010 (arrancado horas antes, con el código viejo) y el nuevo no pudo
bindear. La primera pasada de SSR dio "1 solo grupo, sin teléfono" por eso, no por un bug —
antes de creerle a una prueba local, verificar con `netstat -ano` + `Get-Process` qué proceso
tiene el puerto, igual que ya dice la nota de `--reload` más arriba.

### Despliegue del contacto al supervisor (2026-09-02)

✅ **En producción.** Mismo orden seguro de siempre: migración 004 en `rrhh_bd` primero,
después `deploy-backend.ps1`, después `deploy-frontend.ps1`.

⚠ **La migración en prod no la pudo correr el agente**: el comando
(`echo APLICAR | ... --prod`) lo bloqueó el clasificador de permisos de auto mode por ser
DDL contra la base compartida. No se intentó rodearlo por otra vía — lo corrió el usuario a
mano con el prefijo `!` en el chat. Si vuelve a pasar, ese es el camino: pedirlo en vez de
buscarle la vuelta. Ojo que ese prompt es **bash**, así que las barras van `venv/Scripts/`,
no `venv\Scripts\`.

Verificado contra la URL pública con `Cache-Control: no-cache`:

- `/api/health` → `ok` / `database conectado`.
- Las 4 rutas de alerta devuelven `id_persona_supervisor` y `supervisor_telefono`:
  **turnos 752 filas / 714 con supervisor / 710 con teléfono, sobre 41 supervisores
  distintos**; reincidencia 58/56/56 (17 supervisores); producción MTD 73/72/72 (26).
  **Inactividad devuelve 0 filas** — no es un error del despliegue: ese día los 387 medidos
  estaban todos en tramo `AL DIA`.
- `GET /api/contactos-supervisor/ultimos` → 200 `[]` (la tabla existe y `bex_app` la lee).
- `POST /api/contactos-supervisor` con un supervisor real insertó una fila en `rrhh_bd`
  — la prueba de fuego del `GRANT INSERT`, igual que se hizo con la 001/002 — y el
  backend derivó `cantidad_afiliadores` sin que el cliente la mandara. **Fila de prueba
  borrada** (la tabla quedó en 0 filas).
- El bundle servido es el recién construido (`index-DJpJA-jL.js`) y contiene
  `Supervisores`, `Sin líder asignado`, `contactos-supervisor` y `afiliadores de tu equipo`.
- `/rrhh/personal/` y `/rrhh/vetados/` siguen respondiendo 200: no se tocó Caddy (la ruta
  `/rrhh/seguimiento/*` ya existía desde el despliegue del 2026-08-31).

Rollback del frontend, si hiciera falta:
`cd C:\Proyectos\rrhh\web\seguimiento & ren dist dist_malo & ren dist_prev_20260902-092716 dist`

## Registro de actividad: la consulta del movimiento (2026-09-07)

Pregunta del usuario: *"¿dónde podemos ver las respuestas que estuvo realizando Dorian?"*.
No se podía. La app escribía sus 3 tablas desde el día 1 y **no tenía ninguna pantalla que
las consultara**: sólo el historial *por persona*, que muestra `· registró: <nombre>` pero
obliga a abrir fila por fila. El backend tampoco lo exponía — no había listado global ni
filtro por `registrado_por`.

Ahora hay una **segunda sección** en la app (no una 6ta pestaña) con una línea de tiempo
unificada de los 3 logs, filtrable y exportable a Excel.

Diseño y plan escritos antes del código, en `docs/superpowers/specs/` y
`docs/superpowers/plans/` (`2026-09-07-registro-actividad*`). Decisiones tomadas con el
usuario: los 3 logs (no sólo las llamadas); **una** línea de tiempo, no sub-pestañas por
tipo; filtros de rango de fechas + quién registró + persona/CI, y **nada más** (tipo,
indicador, resultado y medio quedaron como columnas visibles sin filtro, a pedido); nav en
el encabezado en vez de `react-router`; y Excel de una sola hoja plana.

### El `UNION ALL`, y por qué no un merge en Python

`services/actividad_service.py` normaliza las 3 tablas a un esquema común
(`tipo`, `id_registro`, `fecha`, `registrado_por`, `sujeto_*`, `indicador`, `resultado`,
`medio`, `detalle`) con `UNION ALL`, y **una sola función arma el `WHERE`** que comparten la
lista paginada, el `COUNT(*)` y el export. El motivo no es rendimiento sino correctitud: si
el archivo armara su propia consulta, tarde o temprano traería filas que la pantalla no
mostraba. Un merge en memoria además obligaría a traer las 3 tablas enteras en cada request
— el defecto que `rrhh-app/backend/app/services/excel_service.py` documenta de su versión
vieja.

⚠️ **Cuatro cosas que no hay que "arreglar":**

1. **El join del afiliador va por `empleado_unidad.id_empleado`, que es PK** → una fila, no
   multiplica. Es un caso distinto del riesgo que documenta `supervisores_service.py`, donde
   el problema era joinear por `id_persona` (ahí sí hay personas con más de una fila activa).
2. **El nombre del supervisor sale del snapshot `supervisor_nombre`, no del join.** Si en
   Lab 001 le corrigen el nombre, el historial tiene que seguir diciendo a quién se contactó.
   El join a `persona` es sólo para el CI.
3. **`ORDER BY fecha DESC, tipo, id_registro DESC`.** El desempate no es decorativo: con
   `LIMIT/OFFSET` y sólo `fecha DESC`, dos registros del mismo instante pueden repetirse o
   saltearse entre páginas.
4. **`id_registro` NO es único entre tipos** — el de DISPONIBILIDAD es un `id_empleado`,
   porque esa tabla no tiene id propio. La clave estable es el par `(tipo, id_registro)`.

**`/registradores` no aplica los filtros de la pantalla**, a propósito: si respetara el rango
de fechas, mover las fechas vaciaría el select y dejaría a quien busca sin poder elegir a
nadie.

**`por_pagina` se rechaza con 422 si supera 100, no se recorta en silencio.** Recortar
999→100 mudo devuelve 100 filas que quien llama lee como el universo completo — el mismo
problema que el aviso de recorte del export existe para evitar.

⚠️ **`hasta` es INCLUSIVO** y se traduce a `< hasta + 1 día`, con offset **fijo UTC-4**
(Bolivia no tiene horario de verano; el huso del servidor ataría el resultado a dónde corre
el proceso). Con `<=` sobre la medianoche, "hasta el 7" dejaría afuera todo el 7. Probado con
una fila sembrada a las 23:45 hora de Bolivia, que es el borde real.

### Frontend

- **`useActividadState` NO reusa `useAlertaListState`, y no hay que unificarlos.** Ese hook
  filtra, ordena y pagina **en el cliente** sobre un array completo (`filtradas.slice(...)`);
  esta lista pagina **en el servidor**. Doblarlo para los dos modos lo volvería condicional
  en todos lados y pondría en riesgo las 5 pestañas que hoy funcionan. Es exactamente el tipo
  de "esto parece duplicado" que alguien va a proponer unificar en seis meses.
- **`App.jsx` pasa a tener el layout y la nav**; `SeguimientoPage` perdió su wrapper y su
  `<h1>`. Las 5 pestañas **quedan montadas bajo `hidden`** al ir a la otra sección:
  desmontarlas tiraría el filtro que quien trabaja tenía puesto.
- **`lib/download.js`, `hooks/useExportarXlsx.js` y `ui/aviso-export.jsx` son copias de
  `rrhh-app`**, igual que todo `components/ui/`. `services/excel_service.py` también, y se
  verificó que es **byte a byte idéntico** después del docstring — incluido el detalle de que
  **Excel no soporta datetimes con zona horaria** (openpyxl lanza `ValueError`), que allá ya
  costó un error.
- `DISPONIBILIDAD_LABEL` se **deriva** de `DISPONIBILIDADES` en `lib/disponibilidad.js`, no
  se escribe a mano.

⚠️ **`registrado_por` es texto libre** (no hay login, por diseño), así que la misma persona
puede haber firmado de varias formas y el select mostrará una opción por cada una. Se
devuelven **sin normalizar**, con su conteo: el filtro tiene que mostrar el problema, no
esconderlo detrás de un `ILIKE` que adivine.

⚠️ **`seguimiento_disponibilidad` no tiene historial** (una fila por empleado). Su rama de la
línea de tiempo muestra la **última** confirmación de cada persona, no la secuencia de
cambios.

⚠️ **`openpyxl` está pineado en `3.1.5`, exactamente.** Es dependencia nueva y el venv de
producción es **compartido** con `sistema-personal` y `web_validador_vetados`, que ya tienen
ese pin; otro número se los cambia por debajo en el `uv pip install` del deploy.

**Sin migraciones** — la primera entrega de esta app que no toca el esquema.

### Verificado el 2026-09-07 (contra `rrhh_bd_dev`)

Como las 3 tablas estaban **en 0 filas** en dev, se sembraron 12 filas de prueba variadas
(3 registradores con cantidades distintas, fechas repartidas en dos meses, una a las 23:45
hora de Bolivia) — sin ellas casi todas las aserciones pasan **por vacuidad**: un export de
0 filas "coincide" con una pantalla de 0 filas sin haber probado nada. **Las filas se
borraron al terminar** (las 3 tablas quedaron en 0).

- `actividad_service`: el total es la suma de las 3 tablas, ninguna rama multiplica ni pierde
  filas, la paginación no repite ni saltea, `hasta` inclusivo, y `registradores()` coincide
  con un `GROUP BY` a mano.
- Endpoints por HTTP real: 14 chequeos, incluido el borde de `por_pagina` (100 → 200,
  101 y 999 → 422).
- Excel: las 15 columnas en orden, encabezado congelado, `X-Total-Disponible` igual al total
  de la pantalla, y **las 12 fechas** naive y sin correrse 4 horas (`2026-09-07T23:45:00-04:00`
  → celda `2026-09-07 23:45:00`). El recorte se probó bajando el tope a 2:
  `X-Filas-Exportadas: 2` / `X-Total-Disponible: 12`.
- Render por SSR de `TablaActividad` con las 12 filas reales de la API: las dos vistas
  (tarjeta y tabla) en el markup, los 3 badges de tipo, nombre y CI, y el mensaje de lista
  vacía.
- Las 4 rutas de alerta siguen respondiendo con datos (143 / 780 / 59 / 113 en dev ese día).
- `npm run build` compila.

⚠️ **Sin recorrido visual en navegador, otra vez.** La automatización de Chrome no llega a
`localhost` en este entorno (cuarta sesión consecutiva). Falta un recorrido manual, sobre
todo en teléfono.

⚠️ **El render de los diálogos no se puede verificar por SSR**: van por un `Portal` de
`@base-ui`, que devuelve markup vacío fuera del navegador. Vale para
`DetalleActividadDialog` y para los diálogos que ya existían. Lo que se verificó en su lugar
es que los datos que consumen son los correctos.

### Despliegue del registro de actividad (2026-09-07)

✅ **En producción.** `dev @ 85a480d`, pusheado a `origin/dev` antes de desplegar.
`deploy-backend.ps1` y después `deploy-frontend.ps1`. **Sin migración previa** — es la
primera entrega de esta app que no toca el esquema, así que no hubo DDL ni confirmación de
base que pedir.

**Antes de desplegar se revisó `20260905_avisar_hm.md`** (aviso de cambios de
infraestructura del 05-sep). Dos de sus puntos tocaban este despliegue y se verificaron
**contra producción, no contra la documentación** — que es lo que ese mismo aviso pide en su
punto 7:

- **Las reglas nuevas de Caddy que devuelven 404** (`@sensibles` por extensión de archivo,
  `@no_publicos` en `/api/*`) **no bloquean el export**: pedir
  `/rrhh/seguimiento/api/actividad/export.xlsx` devolvía el 404 de **FastAPI**
  (`{"detail":"Not Found"}`, con cuerpo), no el de Caddy (cuerpo vacío) → la petición llega
  al backend. Confirmado después del deploy: 200, `Content-Type` de xlsx y firma `PK` de zip.
- **El Caddyfile no se tocó.** La ruta existe desde el 31-ago y el aviso dice que repositorio
  y VPS ya están alineados.

⚠️ **Hallazgo propio, que no estaba en el aviso: `@sensibles` aplica también BAJO nuestro
prefijo**, no sólo en la raíz — `/rrhh/seguimiento/prueba.bat` devuelve el 404 de Caddy. Hoy
la lista es `.bat .cmd .pyc .pyd .exe .dll` y `.xlsx` no está ahí, pero **si alguien amplía
esa lista en el Caddyfile, el export de esta app se rompe sin que nadie la toque**. Es el
primer lugar donde mirar si un día el botón de Excel empieza a fallar con un 404 sin cuerpo.

⚠️ **El riesgo real de este deploy no era Caddy sino el venv compartido:**
`deploy-backend.ps1` corre `uv pip install -r requirements.txt` sobre `C:\uv-envs\rrhh`, que
comparten `sistema-personal` y `web_validador_vetados`, y nuestro `requirements.txt` pinea
versiones exactas — si alguna app hubiera subido una, este deploy se la bajaba. Se comparó
antes, pin por pin: el venv ya tenía exactamente los nuestros, `openpyxl 3.1.5` incluido. El
deploy lo confirmó: `Checked 9 packages in 31ms`, sin instalar nada.

Verificado contra la URL pública con `Cache-Control: no-cache`:

- `/api/actividad` → 200 `{"items":[],"total":0}` y `/api/actividad/registradores` → 200 `[]`.
  **0 filas era lo correcto ESE DÍA**: al 07-sep nadie había registrado nada en `rrhh_bd`
  (verificado también por las secuencias: los 3 únicos inserts históricos eran las pruebas de
  despliegue documentadas más arriba). Lo que probó el deploy es que responde 200 y no 500 —
  o sea que el `UNION ALL` y sus JOIN a `persona`/`empleado_unidad` son válidos contra el
  esquema de prod. **Ya no está vacía**: ver §"En uso real" más abajo.
- `/api/actividad/export.xlsx` → 200, `Content-Disposition` con sello de tiempo,
  `X-Filas-Exportadas`/`X-Total-Disponible` y `Access-Control-Expose-Headers` presentes.
- Bundle servido: `index-DJpJA-jL.js` → **`index-CK9afyEp.js`**, y contiene
  `Registro de actividad`, `Exportar a Excel`, `actividad/export.xlsx` y `Quién registró`.
- **Nada de lo anterior se rompió**: inactividad 136 · turnos 766 · reincidencia 59 ·
  producción MTD 115 · contactos-supervisor 0. Y las vecinas del mismo servidor siguen igual
  que en la línea base pre-deploy: `/rrhh/personal/` 200 · `/rrhh/vetados/` 200 ·
  `/zas/calidad/api` 200 · `/convocatoria/bnb` 301.

Rollback del frontend, si hiciera falta:
`cd C:\Proyectos\rrhh\web\seguimiento & ren dist dist_malo & ren dist_prev_20260907-150343 dist`

⚠️ **La comprobación de venv de este archivo da un falso positivo en esta máquina.**
`Get-Process -Id <pid> | Select Path` sobre el uvicorn muestra el Python **global** aunque se
lo lance con el del venv, porque `venv\Scripts\python.exe` es el *venv launcher* de Windows y
arranca el intérprete base ya configurado. Eso **no** es el fallo de `--reload` documentado
más arriba. La señal confiable es la cadena padre→hijo (`Get-CimInstance Win32_Process`) o,
más simple, que la app levante e importe `fastapi` (el Python global no puede).

### Columna "Proyecto" en el registro de actividad (2026-09-11)

Pedido del usuario tras hacer una exportación real: ver el proyecto **igual que en
Seguimiento**, en pantalla y en el Excel. Desplegado el mismo día (`dev @ 11ba1e6`), sin
migraciones.

⚠️ **Se usa el `codigo` de `unidad_negocio`/`campana`, NO el `nombre`.** Las 3 vistas de
Lab 001 exponen el código, así que la pantalla de Seguimiento viene mostrando `YAPE`,
`ZAS`, `BNB / BILLE`. Joinear `nombre` —que es lo que sale natural— habría dado
`YAPE - Afiliaciones QR BCP Bolivia / YAPE - Afiliaciones QR BCP`: largo, redundante y
**distinto de lo que la otra pantalla muestra para la misma persona**. Se replica también la
regla de colapso: la campaña sólo se agrega cuando difiere de la unidad.

⚠️ **En un contacto a supervisor el proyecto sale de SU GENTE, no de él** — un `LEFT JOIN
LATERAL` que abre el JSONB `afiliadores` y une los proyectos distintos con coma
(`YAPE, ZAS`). Decisión del usuario tomada sabiendo el costo, que queda comentado en el
código: **ese es el único campo de esa rama que NO queda congelado**, porque resuelve el
proyecto de HOY de cada afiliador y no el que tenía el día del contacto. `nombre` y
`metrica` sí salen del snapshot. Si alguien cambia de proyecto, el historial de supervisores
se relee distinto.

Detalle de implementación: el `DISTINCT` va en un subselect y no dentro del `string_agg`,
porque Postgres sólo admite `ORDER BY` sobre la misma expresión del `DISTINCT` en un agregado.

⚠️ **El `.xlsx` pasó de 15 a 16 columnas**, con `Proyecto` en la **5ta** (después de `CI`).
Eso corre una posición todo lo que va de `Indicador` en adelante: una tabla dinámica armada
sobre un archivo anterior tiene que apuntar a los encabezados, no a las letras de columna.

Verificado contra `rrhh_bd` (con los 94 registros reales de Dorian): **el total sigue en 94**
—o sea que ningún join nuevo multiplica filas—, las 94 resuelven proyecto sin vacíos
(`YAPE 76 · ZAS 18`), el formato es el código corto, y el `LATERAL` se ejercitó insertando un
contacto a supervisor **en una transacción revertida** (resolvió `YAPE`, una sola fila, prod
intacta). El `.xlsx` bajado de la URL pública trae las 16 columnas con `Proyecto` en la 5ta y
94 filas sin vacíos. `npm run build` compila; bundle servido `index-CJr0-MNs.js`.

Rollback del frontend: `ren dist dist_malo & ren dist_prev_20260911-145649 dist`

