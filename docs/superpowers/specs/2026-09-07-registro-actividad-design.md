# Registro de actividad — diseño

**Fecha:** 2026-09-07 · **Estado:** aprobado, pendiente de implementación

## El problema

La app escribe tres tablas propias desde el día 1 y **no tiene ninguna pantalla que las
consulte**. Lo único que existe hoy es el historial *por persona* (`HistorialLlamadasDialog`,
`HistorialContactoSupervisorDialog`), que muestra `· registró: <nombre>` pero obliga a abrir
fila por fila.

La pregunta que lo motivó, textual: *"¿dónde podemos ver las respuestas que estuvo realizando
Dorian?"*. Hoy la única respuesta honesta es "consultando la base a mano".

## Alcance

**Entra:** una vista de consulta sobre las 3 tablas propias, como una **línea de tiempo
unificada**, con filtros y exportación a `.xlsx`.

| Tabla | Qué aporta a la línea de tiempo |
|---|---|
| `seguimiento_llamada` | Cada contacto a un afiliador (tipo `AFILIADOR`) |
| `seguimiento_contacto_supervisor` | Cada llamado de atención a un supervisor (tipo `SUPERVISOR`) |
| `seguimiento_disponibilidad` | Cada disponibilidad confirmada (tipo `DISPONIBILIDAD`) |

**No entra:**

- **Auditoría de navegación** (quién entró, qué miró). Ese dato no existe: la app no tiene
  login ni registra accesos, y sin usuario autenticado sólo se sabría la IP. Construirlo es
  otro pedido.
- **Cualquier cambio a Lab 001** o a las 4 queries de alerta. Esta vista es sólo lectura.
- **Editar o borrar registros** desde la pantalla. Es un log: se consulta, no se corrige.

## Decisiones tomadas con el usuario (2026-09-07)

| Decisión | Por qué |
|---|---|
| Los 3 logs, **no** sólo las llamadas | Se pidió "todo el movimiento". La disponibilidad entra sabiendo que `seguimiento_disponibilidad` es **una fila por empleado** (la última confirmación pisa a la anterior): aporta "quién confirmó qué y cuándo", no la secuencia de cambios |
| **Una línea de tiempo unificada**, no sub-pestañas por tipo | La pregunta real es "qué se movió esta semana" / "qué hizo Dorian el martes". Tres listas separadas obligan a mirar en tres lugares |
| Filtros: **rango de fechas · quién registró · persona/supervisor (nombre o CI)** | Los únicos tres que el usuario dijo que va a usar. Tipo, indicador, resultado y medio quedan como **columnas visibles sin filtro** — se agregan si se extrañan |
| **Nav en el encabezado, sin `react-router`** | "Una página, no una pestaña más". Cero dependencias nuevas en el front, y no se toca el `base` de Vite ni el fallback de Caddy, que hoy funcionan. Se acepta el costo: no hay link directo a la vista |
| **`UNION ALL` en SQL, paginado en el servidor** | Es el único enfoque en que pantalla y Excel comparten **una sola definición de qué filas entran**. Un merge en Python trae las tres tablas enteras a memoria en cada request — el defecto que `rrhh-app/backend/app/services/excel_service.py` documenta de su versión vieja |
| **Excel de una sola hoja plana** | Se filtra y se hace tabla dinámica directo. Sin hoja de resumen: no se pidió medir gestión todavía |

---

## Backend

### La consulta unificada — `services/actividad_service.py`

Tres ramas proyectando el mismo esquema:

| Columna | AFILIADOR | SUPERVISOR | DISPONIBILIDAD |
|---|---|---|---|
| `tipo` | `'AFILIADOR'` | `'SUPERVISOR'` | `'DISPONIBILIDAD'` |
| `id_registro` | `sl.id` | `scs.id` | `sd.id_empleado` |
| `fecha` | `fecha_contacto` | `fecha_contacto` | `fecha_actualizacion` |
| `registrado_por` | ídem | ídem | ídem |
| `sujeto_id` | `id_empleado` | `id_persona_supervisor` | `id_empleado` |
| `sujeto_nombre` | de `persona` | `supervisor_nombre` (snapshot) | de `persona` |
| `sujeto_ci` | `persona.ci` | `persona.ci` del supervisor | `persona.ci` |
| `indicador` · `resultado` · `medio` | `fuente` · `resultado` · `medio_contacto` | ídem | `NULL` |
| `detalle` (JSONB) | motivo, próxima acción, seguimiento, notas | afiliadores del snapshot, cantidad, próxima acción, notas | la disponibilidad confirmada |

Boceto:

```sql
WITH actividad AS (
    SELECT 'AFILIADOR'::text AS tipo, sl.id AS id_registro, sl.fecha_contacto AS fecha,
           sl.registrado_por, sl.id_empleado AS sujeto_id,
           NULLIF(TRIM(CONCAT_WS(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), '') AS sujeto_nombre,
           p.ci AS sujeto_ci,
           sl.fuente AS indicador, sl.resultado, sl.medio_contacto AS medio,
           jsonb_build_object(
               'motivo_bajo_rendimiento',   sl.motivo_bajo_rendimiento,
               'proxima_accion',            sl.proxima_accion,
               'fecha_proximo_seguimiento', sl.fecha_proximo_seguimiento,
               'notas',                     sl.notas
           ) AS detalle
    FROM seguimiento_llamada sl
    LEFT JOIN empleado_unidad eu ON eu.id_empleado = sl.id_empleado
    LEFT JOIN persona p          ON p.id_persona   = eu.id_persona

    UNION ALL

    SELECT 'SUPERVISOR', scs.id, scs.fecha_contacto, scs.registrado_por,
           scs.id_persona_supervisor, scs.supervisor_nombre, ps.ci,
           scs.fuente, scs.resultado, scs.medio_contacto,
           jsonb_build_object(
               'cantidad_afiliadores',      scs.cantidad_afiliadores,
               'afiliadores',               scs.afiliadores,
               'proxima_accion',            scs.proxima_accion,
               'fecha_proximo_seguimiento', scs.fecha_proximo_seguimiento,
               'notas',                     scs.notas
           )
    FROM seguimiento_contacto_supervisor scs
    LEFT JOIN persona ps ON ps.id_persona = scs.id_persona_supervisor

    UNION ALL

    SELECT 'DISPONIBILIDAD', sd.id_empleado, sd.fecha_actualizacion, sd.registrado_por,
           sd.id_empleado,
           NULLIF(TRIM(CONCAT_WS(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
           p2.ci,
           NULL, NULL, NULL,
           jsonb_build_object('disponibilidad', sd.disponibilidad)
    FROM seguimiento_disponibilidad sd
    LEFT JOIN empleado_unidad eu2 ON eu2.id_empleado = sd.id_empleado
    LEFT JOIN persona p2          ON p2.id_persona   = eu2.id_persona
)
SELECT * FROM actividad
WHERE (:desde          IS NULL OR fecha >= :desde)
  AND (:hasta          IS NULL OR fecha <  :hasta)
  AND (:registrado_por IS NULL OR registrado_por = :registrado_por)
  AND (:q              IS NULL OR sujeto_nombre ILIKE :q_like OR sujeto_ci ILIKE :q_like)
ORDER BY fecha DESC, tipo, id_registro DESC
LIMIT :limite OFFSET :offset
```

Cuatro detalles que no son accidentales:

1. **El join del afiliador va por `empleado_unidad.id_empleado`, que es PK**
   (`Lab 001/03_carga_pg/schema/01_create_tables.sql:730`) → devuelve una fila, no multiplica.
   Es un caso distinto del riesgo que documenta `supervisores_service.py`: ahí el problema
   era joinear por `id_persona`, donde sí hay personas con más de una fila activa.
2. **El nombre del supervisor sale del snapshot `supervisor_nombre`, no del join.** Si en
   Lab 001 le corrigen el nombre, el historial tiene que seguir diciendo a quién se
   contactó — mismo criterio que ya rige `afiliadores` y `snapshot_metrica`. El join a
   `persona` es sólo para el CI.
3. **`ORDER BY fecha DESC, tipo, id_registro DESC`.** El desempate no es decorativo: con
   `LIMIT/OFFSET` y sólo `fecha DESC`, dos registros del mismo instante pueden repetirse o
   saltearse entre páginas.
4. **`id_registro` no es único entre tipos** (el de DISPONIBILIDAD es un `id_empleado`). La
   clave de React es la combinación `tipo` + `id_registro`.

### Fechas: UTC-4 fijo, y `hasta` es inclusivo

`desde` y `hasta` llegan como `date` (`YYYY-MM-DD`) y significan días **en hora de Bolivia**.
El servicio los convierte a `timestamptz` en Python con un offset **fijo de UTC-4** —
Bolivia no tiene horario de verano, y usar el huso del servidor ata el resultado a dónde
corre el proceso. `hasta` se traduce a `< hasta + 1 día` para que el día elegido entre
completo: con `<=` sobre la fecha a medianoche, "hasta el 7" dejaría afuera todo el 7.

Mismo criterio que `_HUSO_BOLIVIA` en `rrhh-app/backend/app/services/excel_service.py`.

### Endpoints — `routers/actividad.py`, prefijo `/actividad`

| Endpoint | Qué hace |
|---|---|
| `GET /actividad` | La línea de tiempo. Query: `desde`, `hasta`, `registrado_por`, `q`, `pagina` (1), `por_pagina` (25, tope 100). Devuelve `{items, total}` |
| `GET /actividad/registradores` | Los `registrado_por` distintos con su conteo, ordenados por cantidad. Puebla el select — el campo es **texto libre**, así que hay que ofrecer los valores que existen en vez de un input donde adivinar cómo se firmó cada uno |
| `GET /actividad/export.xlsx` | **Los mismos filtros**, `StreamingResponse`, tope 5000 filas, headers `X-Filas-Exportadas` / `X-Total-Disponible` |

Dos precisiones sobre esos tres:

- **`/registradores` NO aplica el rango de fechas ni los demás filtros**: devuelve todos los
  que existen en las 3 tablas. Si respetara el rango, mover las fechas vaciaría el select y
  dejaría al usuario sin poder elegir a quien está buscando.
- **El export ignora `pagina` y `por_pagina`** y aplica su propio tope: se exporta el
  resultado del filtro, no la página que se está viendo.

Una sola función arma el `WHERE` y la comparten la lista, el `COUNT(*)` y el export. Es la
razón de ser del enfoque elegido: no puede pasar que el archivo traiga filas que la pantalla
no mostraba.

### Schemas — `schemas.py`

```python
TipoActividad = Literal["AFILIADOR", "SUPERVISOR", "DISPONIBILIDAD"]

class ActividadItemOut(BaseModel):
    tipo: TipoActividad
    id_registro: int
    fecha: datetime
    registrado_por: Optional[str] = None
    sujeto_id: Optional[int] = None
    sujeto_nombre: Optional[str] = None
    sujeto_ci: Optional[str] = None
    indicador: Optional[str] = None
    resultado: Optional[str] = None
    medio: Optional[str] = None
    detalle: dict[str, Any] = {}

class ActividadPageOut(BaseModel):
    items: list[ActividadItemOut]
    total: int

class RegistradorOut(BaseModel):
    registrado_por: str
    cantidad: int
```

`detalle` va como `dict` abierto a propósito: cada tipo aporta claves distintas y tipar la
unión no le compraría nada a un panel de sólo lectura.

### El Excel — `services/excel_service.py`

Copiado de `rrhh-app` (openpyxl, cabecera oscura, anchos topados entre 10 y 60), incluida la
normalización que ya les costó un error allá: **Excel no soporta datetimes con zona
horaria**, así que se convierten a UTC-4 y se les quita el `tzinfo` antes de escribirlos.

Una hoja, `Movimiento`, una fila por registro:

`Fecha y hora` · `Tipo` · `Persona / supervisor` · `CI` · `Indicador` · `Resultado` ·
`Medio` · `Quién registró` · `Motivo` · `Próxima acción` · `Fecha de seguimiento` ·
`Notas` · `Afiliadores mencionados` (unidos con ` · `) · `Cantidad de afiliadores` ·
`Disponibilidad confirmada`

Tope **5000 filas**, igual que `LIMITE_EXPORT_PLANILLA` en `rrhh-app`. **El recorte no puede
ser silencioso**: si `X-Filas-Exportadas < X-Total-Disponible`, la pantalla lo dice. Un
archivo topado se lee como el universo completo y alguien decide sobre datos que no están.

---

## Frontend

### Ubicación y el único cambio a lo existente

`App.jsx` toma el estado `seccion` (`'seguimiento' | 'actividad'`) y pasa a dibujar el
contenedor, el `<h1>` y la nav de dos ítems. Hoy eso vive dentro de `SeguimientoPage.jsx`
(su `<div className="max-w-6xl …">` y el título), así que **esa página pierde su wrapper y su
título** y devuelve sólo su contenido. Es el único cambio en las 5 pestañas existentes y es
mecánico.

### `hooks/useActividadState.js` — hook nuevo, **no** reusa `useAlertaListState`

Deliberado. `useAlertaListState` filtra, ordena y pagina **en el cliente** sobre un array
completo (`filtradas.slice(...)`). Esta lista pagina en el servidor. Doblar ese hook para
soportar los dos modos lo volvería condicional en todos lados y pondría en riesgo las 5
pestañas que hoy funcionan.

El hook nuevo es chico: estado de filtros → `queryKey: ['actividad', filtros]`,
`placeholderData` para que la tabla no parpadee al cambiar de página, y el `useDebounce` que
ya existe para el buscador.

### Componentes

| Archivo | Qué es |
|---|---|
| `pages/ActividadPage.jsx` | Barra de filtros, contador de resultados, tabla y `PaginationBar` (ya existe), botón **Exportar a Excel** y `AvisoExport` |
| `components/actividad/TablaActividad.jsx` | Las mismas **dos vistas por CSS** que `TablaAlertas` (`md:hidden` / `hidden md:block`): tabla en escritorio, una tarjeta por registro en teléfono. Columnas: Fecha y hora · Tipo · Sujeto (nombre + CI) · Indicador · Resultado · Medio · Quién registró |
| `components/actividad/DetalleActividadDialog.jsx` | Notas, motivo, próxima acción y —en un contacto a supervisor— la lista congelada de afiliadores. Mismo patrón que `HistorialLlamadasDialog` |
| `lib/download.js` · `hooks/useExportarXlsx.js` · `components/ui/aviso-export.jsx` | Copiados de `rrhh-app` tal cual, como se copió todo `ui/` |
| `api/actividad.js` | Las 3 llamadas, sobre el `client` de axios que ya existe. El export pide `responseType: 'blob'` |

Los badges y etiquetas (`RESULTADO_LABEL`, `RESULTADO_VARIANT`, `MEDIOS`, `FUENTE_LABEL`)
salen de `lib/contacto.js`, que existe justamente porque estaban triplicados. Acá no se copia
ninguno.

`tabular-nums` en fecha, CI y cantidades, por el mismo motivo que en las otras tablas: son
números que cambian entre filas y con dígitos proporcionales la columna baila.

### Filtros y valores por defecto

- **Rango de fechas**: dos `<Input type="date">`. **Abre en los últimos 30 días** — con el
  rango vacío la vista arranca trayendo todo, y eso deja de leerse el día que la tabla tenga
  miles de filas.
- **Quién registró**: `SelectField` poblado por `/actividad/registradores`, mostrando el
  conteo (`Dorian (37)`).
- **Buscador**: nombre o CI del afiliador/supervisor, con debounce de 300 ms.
- En teléfono la barra va en `grid grid-cols-2` y vuelve a fila desde `sm`, igual que la de
  las pestañas de alerta.

---

## Qué se dejó afuera a propósito (YAGNI)

- **Filtros por tipo, indicador, resultado y medio.** Van como columnas visibles. El usuario
  dijo explícitamente que no los usa; se agregan cuando los extrañe.
- **Hoja de resumen en el Excel** (contactos por persona, por resultado, por indicador). Es
  para medir gestión, y eso todavía no se pidió.
- **`react-router` y URLs con los filtros en la query string.** Es lo que haría el link
  compartible, y se descartó por no tocar el `base` de Vite ni el fallback de Caddy.
- **Historial de disponibilidad.** Requeriría convertir `seguimiento_disponibilidad` en tabla
  de historial (migración 005) y no es lo que se pidió.

## Riesgos y trampas conocidas

| Riesgo | Mitigación |
|---|---|
| **`openpyxl` es dependencia nueva y el venv del servidor es COMPARTIDO** (`C:\uv-envs\rrhh`, lo usan `sistema-personal` y `web_validador_vetados`) | Pinear **exactamente `openpyxl==3.1.5`**, la versión que `rrhh-app` ya tiene ahí. Con otro pin, el `uv pip install` de `deploy-backend.ps1` le cambiaría la versión por debajo a una app que hoy anda |
| `registrado_por` es **texto libre** y la misma persona pudo firmar de varias formas | El select muestra los valores tal como están, con su conteo — hace visible el problema en vez de esconderlo. No se normaliza nada en esta entrega |
| Fechas corridas por huso | Offset **fijo UTC-4** en el filtro y en el Excel; nunca el huso del servidor |
| Un `.xlsx` recortado leído como si fuera todo | Headers `X-Filas-Exportadas` / `X-Total-Disponible` + `AvisoExport` en pantalla |
| Servidores viejos escuchando el puerto al probar en local | Antes de creerle a una prueba, `netstat -ano` + `Get-Process` (ya mordió dos veces, ver CLAUDE.md) |

**Sin migraciones de base**: no hay tabla ni columna nueva. Es la primera entrega de esta app
que no toca el esquema.

## Verificación

El proyecto no tiene suite automatizada; la verificación es la que se viene usando —
**HTTP real contra `rrhh_bd_dev`**, con filas de prueba que se borran al final:

1. Los totales por tipo cuadran con un `COUNT(*)` directo a las 3 tablas.
2. `desde`/`hasta` no se corren por el huso: un registro creado a las 23:00 hora Bolivia cae
   en su día, no en el siguiente.
3. `registrado_por` y el buscador por nombre/CI devuelven lo esperado, y `/registradores`
   lista los mismos valores que un `GROUP BY` a mano.
4. La paginación no repite ni saltea filas entre la página 1 y la 2.
5. **El `.xlsx` y la pantalla, con los mismos filtros, devuelven las mismas filas.** Abrir el
   archivo y verificar que las fechas no estén corridas 4 horas.
6. Forzar el recorte (tope bajado a mano) y confirmar que el aviso aparece.
7. `npm run build` compila.

## Despliegue

Orden: `deploy-backend.ps1` (que instala `openpyxl` en el venv compartido) y después
`deploy-frontend.ps1`. **No hay migración que correr antes.** Verificar después que
`sistema-personal` y `vetados` siguen respondiendo, porque el venv es compartido.

## Archivos

**Backend, nuevos:** `app/services/actividad_service.py`, `app/services/excel_service.py`,
`app/routers/actividad.py`

**Backend, tocados:** `app/schemas.py`, `app/main.py` (registrar el router),
`requirements.txt` (`openpyxl==3.1.5`)

**Frontend, nuevos:** `src/pages/ActividadPage.jsx`,
`src/components/actividad/TablaActividad.jsx`,
`src/components/actividad/DetalleActividadDialog.jsx`,
`src/components/ui/aviso-export.jsx`, `src/hooks/useActividadState.js`,
`src/hooks/useExportarXlsx.js`, `src/lib/download.js`, `src/api/actividad.js`

**Frontend, tocados:** `src/App.jsx` (nav + layout), `src/pages/SeguimientoPage.jsx` (pierde
wrapper y título)
