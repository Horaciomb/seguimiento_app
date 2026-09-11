# CLAUDE.md — Seguimiento de Indicadores

**Qué es:** app web standalone, sin login, para que JP (y quien más lo use) registre el
resultado real de las llamadas a los afiliadores que marcan los indicadores de control de
`Lab 001 - Pasar a Datos` (`C:\temp\RRHH\Lab\001 - Pasar a Datos`). El problema que vino a
resolver: esos indicadores se entregan como Excel por OneDrive y **nadie registraba** si se
llamó, si contestó, o qué sigue —
salvo el indicador de inactividad, que tiene un dedup propio
(`alerta_inactividad_notificacion`). Esta app generaliza esa idea a las tres fuentes, con un
log de contacto real en vez de solo dedup.

**Está en uso real desde el 2026-09-08** — ver §"En uso real: lo que muestran los primeros
registros". Quien la usa no es JP sino **Dorian Gutiérrez**, y sólo sobre la pestaña de
Turnos. Eso tiene consecuencias para cualquier cambio que se haga de acá en adelante: ya no
es una app vacía donde romper algo no se nota.

Desde el 2026-09-02 el contacto no es sólo al afiliador: la app también agrupa la alerta
por **supervisor / líder a cargo** y registra el llamado de atención que se le hace a él por
la gente de su equipo (§Invariantes · detalle en `docs/historial.md`).

Ver `contexto_indicadores.md` para el detalle funcional de cada indicador (qué mide, de
dónde sale el dato, cómo se calcula) — es la referencia técnica de Lab 001, no de esta app.

**Este archivo es la referencia para trabajar**: arquitectura, endpoints, cómo correrlo, las
**invariantes que no hay que "arreglar"** (§Invariantes — leerlas antes de tocar nada),
migraciones y despliegue. El relato de cada entrega —qué se pidió, qué se decidió, qué se
verificó, cómo se desplegó, con sus hashes y comandos de rollback— está en
**`docs/historial.md`**. Se separaron el 2026-09-11: con ocho entregas encima, el relato
tapaba lo que hace falta para trabajar.

**Decisión de diseño (2026-08-28, con el usuario):** sin login propio, un solo rol, uso
interno. Por eso el backend no tiene auth ni CORS restrictivo más allá de dev/localhost, y
`registrado_por` es texto libre (quien llama se identifica escribiendo su nombre, no
autenticándose).

---

## Qué NO es esta app

- No calcula ningún indicador. Todo el cálculo es de Lab 001; esta app solo LEE sus vistas
  (`vw_alerta_inactividad`, `vw_alerta_turnos`, `vw_produccion_mtd_vs_historico`) y agrega su
  propia lectura/escritura sobre sus 3 tablas (`seguimiento_llamada`,
  `seguimiento_disponibilidad`, `seguimiento_contacto_supervisor`).
- No reemplaza (todavía) los Excel que Lab 001 manda a JP por PUMA — conviven. Si algún día
  se decide que esta app reemplaza esa entrega, es una decisión aparte, coordinada con Lab 001.

## Arquitectura

Mismo patrón de capas y mismo stack que `rrhh-app` (`C:\temp\RRHH\rrhh-app`), copiado y
simplificado quitando todo lo de auth/roles — ver ese repo para el porqué de cada decisión
de diseño que se heredó tal cual (pool de conexiones, keepalives TCP, `ORJSONResponse`, etc.).

```
backend/   FastAPI + SQLAlchemy 2.0, SIN auth. app/{config,database,models,schemas}.py,
           app/services/{alertas_service,llamadas_service,disponibilidad_service,
           supervisores_service,contactos_supervisor_service}.py,
           app/routers/{alertas,llamadas,supervisores}.py
frontend/  React 19 + Vite + Tailwind v4 + TanStack Query, SIN login/router.
           Componentes de ui/ copiados de rrhh-app/frontend (mismo look & feel, mismo
           patrón página+hook que VetadosPage.jsx/useVetadosState.js).
```

### Backend — qué endpoint hace qué

| Endpoint | Qué hace |
|---|---|
| `GET /alertas/inactividad` | `vw_alerta_inactividad`, `estado_medicion='MEDIDO' AND tramo IN ('SEGUIMIENTO','CRITICO','REVISAR BAJA')` — mismo filtro que la hoja "alerta" de `14_alerta_inactividad_afiliadores.py` |
| `GET /alertas/turnos` | `vw_alerta_turnos`, **los 4 turnos**, **último cálculo por turno** (no una ventana) — ver §Invariantes y `docs/historial.md` |
| `GET /alertas/reincidencia` | Replica `armar_resumen_por_persona()` de `17_exportar_alerta_turnos.py`: ventana de `dias` (default 30), agrupado por empleado, `veces_en_alerta >= minimo_veces` (default 3) |
| `GET /alertas/produccion-mtd` | Los 4 filtros de `18b_exportar_produccion_mtd.py`: MEDIDO, promedio≥10, actual≤promedio, excluir a quien ya está en alerta de Inactividad o de Turnos (NOCHE/MADRUGADA, último cálculo) |
| `POST /llamadas` | Inserta en `seguimiento_llamada` |
| `GET /llamadas/historial/{id_empleado}` | Historial completo de esa persona, todas las fuentes |
| `POST /contactos-supervisor` | Registra el llamado de atención al supervisor (ver §Invariantes y `docs/historial.md`) |
| `GET /contactos-supervisor/ultimos` | Último contacto de cada supervisor, opcionalmente acotado por `fuente` |
| `GET /contactos-supervisor/historial/{id_persona_supervisor}` | Historial completo de ese supervisor |
| `GET /actividad` | La línea de tiempo unificada de las 3 tablas propias, paginada y filtrable (ver §Invariantes y `docs/historial.md`) |
| `GET /actividad/registradores` | Los `registrado_por` distintos con su conteo, **sin aplicar los filtros de la pantalla** |
| `GET /actividad/export.xlsx` | Los mismos filtros que la lista, en un `.xlsx`, con los headers de recorte |

Cada fila de los 4 GET de alertas se enriquece con la última `seguimiento_llamada` de ese
empleado (`services/llamadas_service.ultimas_llamadas_por_empleado`), para que la UI pinte
"cuándo se lo llamó y qué pasó" sin una consulta extra por fila.

**No se reinventa ningún criterio de negocio acá** — cada query de `alertas_service.py`
reproduce a propósito el mismo filtro ya verificado en el script de export correspondiente
del Lab. Si un número no coincide con lo que ve JP en su Excel, sospechar de la query antes
que de los datos.

### Las 3 tablas propias de esta app

Todo lo demás que lee la app es de Lab 001. Estas tres son suyas, y por eso hay que crearlas
a mano con DDL (§"Migraciones aplicadas en `rrhh_bd`"):

| Tabla | Qué guarda | Cardinalidad |
|---|---|---|
| `seguimiento_llamada` | Cada contacto a un afiliador | N por empleado (historial) |
| `seguimiento_disponibilidad` | En qué horario trabaja la persona | 1 por empleado (estado actual) |
| `seguimiento_contacto_supervisor` | Cada llamado de atención a un supervisor | N por supervisor (historial) |

**`seguimiento_llamada`** — `backend/migrations/001_create_seguimiento_llamada.sql`. Generaliza
`alerta_inactividad_notificacion` (que solo dedupea el indicador #1) a un log de contacto
real para las 4 fuentes: qué se llamó, qué contestó, qué sigue.

⚠️ **No lleva `ForeignKey(...)` en el modelo ORM** (`app/models.py`) aunque la tabla real sí
tiene `REFERENCES empleado_unidad(id_empleado)` — SQLAlchemy exige que la tabla referenciada
esté en el mismo `MetaData` para resolverla en el flush, y eso hubiera obligado a declarar
`empleado_unidad` como modelo propio de esta app (no lo es, es de Lab 001). La integridad la
sigue garantizando Postgres.

Ojo que esto vale para `seguimiento_llamada` y `seguimiento_disponibilidad`, cuyas tablas
reales SÍ tienen el `REFERENCES`. `seguimiento_contacto_supervisor` es un caso distinto y no
hay que "arreglarlo": ahí no hay FK **ni en el ORM ni en la base**, a propósito, porque
`id_persona_supervisor` es una referencia blanda en el propio Lab 001 (§Invariantes).

⚠️ **Nota de integración con Lab 001, sin resolver:** `clonar_a_dev.py` de Lab 001
reconstruye `rrhh_bd_dev` desde SU PROPIO `01_create_tables.sql` en cada re-clon —
**ninguna de las 3** (`seguimiento_llamada`, `seguimiento_disponibilidad`,
`seguimiento_contacto_supervisor`) está en ese inventario, así que un re-clon de dev las
borra (mismo
modo de falla ya documentado varias veces entre Lab 001 y `rrhh-app`, ver Lab 001 CLAUDE.md
§FASE 9). Como esta app corre contra `rrhh_bd` (prod, nunca se re-clona) el riesgo práctico
es bajo. Si hace falta que sobreviva un re-clon de dev, coordinar con Lab 001 para sumarla a
su inventario (mismo tratamiento que le dieron a `banco`/`TRABAJITO`).

**Aplicada en `rrhh_bd_dev` el 2026-08-28** (rol `bex_ingeniero`). **Aplicada en `rrhh_bd`
(prod) el 2026-08-31**, con confirmación explícita del usuario (rol `bex_ingeniero`,
`RRHH_PG_PASSWORD`) — junto con `002_add_medio_y_motivo.sql`. Verificado por columnas
(`information_schema.columns`) y grants de `bex_app` sobre la tabla.

## Cómo correrlo en desarrollo

```powershell
# Backend
cd backend
python -m venv venv          # usar Python 3.12 — psycopg2-binary no tiene wheel para 3.14
.\venv\Scripts\python.exe -m pip install -r requirements.txt
# copiar .env.example a .env y completar DB_PASSWORD (rol bex_app, mismo valor que usa rrhh-app)
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8010
# 🔴 con --reload, uvicorn puede relanzar el worker con el Python global en vez del venv en
# este entorno (visto el 2026-08-28: terminaba en AssertionError orjson pese a estar
# instalado). Si pasa, correr sin --reload o verificar con `Get-Process -Id <pid> | select Path`
# que el proceso que quedó escuchando el puerto es el de venv\Scripts\python.exe.

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5174, proxy /api -> http://localhost:8010
```

`backend/.env` ya apunta a `rrhh_bd_dev` con las credenciales de `bex_app` que también usa
`rrhh-app` (mismo rol, misma base). No apuntar `.env` local a `rrhh_bd` (prod).

## Invariantes: lo que NO hay que "arreglar"

Cada línea de acá nació de una decisión deliberada o de un error ya pagado, y casi todas
parecen un descuido a primera vista. **El relato completo de cada una está en
`docs/historial.md`**, en la entrega que la introdujo. Si vas a cambiar algo de esta lista,
leé primero el porqué allá.

### Criterios de negocio (son de Lab 001, no de esta app)

- **Ninguna de las 4 queries SQL de alerta se toca.** Todo dato nuevo se agrega en el
  *enriquecimiento* (`_enriquecer_filas`), nunca en el `SELECT`: así los criterios de Lab 001
  quedan intactos y la cantidad de filas no puede cambiar por un JOIN nuevo.
- **Reincidencia y la exclusión de Producción MTD siguen filtradas a NOCHE/MADRUGADA**, aunque
  la pestaña de Turnos muestre los 4. Sumarles MAÑANA/TARDE cambiaría en silencio el
  `veces_en_alerta` de cada persona y dejaría Producción MTD casi vacía.
- **El umbral `< 5` de MAÑANA/TARDE marca a ~90% de los medidos.** Es poco accionable como
  lista de trabajo, pero vive en `config_umbral_turno` y el criterio es de Lab 001: cambiarlo
  se coordina con ellos, no se parchea acá.

### Modelo de datos

- **`seguimiento_llamada` y `seguimiento_disponibilidad` no llevan `ForeignKey(...)` en el ORM**
  aunque las tablas reales sí tienen el `REFERENCES`: SQLAlchemy exigiría declarar
  `empleado_unidad` como modelo de esta app, y no lo es.
- **`seguimiento_contacto_supervisor` no tiene FK ni en el ORM ni en la base**, y es un caso
  distinto del anterior: `id_persona_supervisor` es una referencia blanda en el propio Lab 001
  y con una FK, registrar un contacto a un supervisor huérfano fallaría con un 500 al usarlo.
- **`afiliadores` es JSONB con el snapshot `[{id_empleado, nombre, metrica}]`, no un array de
  ids.** La métrica que motivó el mensaje ("45 días sin afiliar") no existe al día siguiente,
  porque la alerta se recalcula. Mismo criterio que `snapshot_metrica`.
- **`cantidad_afiliadores` la deriva el backend** con `len(afiliadores)`; no llega del cliente.
- **La disponibilidad se escribe desde el formulario de contacto, no desde un endpoint aparte**,
  y en el mismo commit que la llamada. El momento en que se averigua es la conversación.
  **No hay edición directa**: fue decisión del usuario, para que cada dato tenga una charla
  real detrás.

### Registro de actividad

- **El join del afiliador va por `empleado_unidad.id_empleado`, que es PK** → no multiplica. Es
  un caso distinto del riesgo de joinear por `id_persona`, donde sí hay personas con varias
  filas activas.
- **El nombre del supervisor sale del snapshot, no del join**; el join a `persona` es sólo para
  el CI.
- **`ORDER BY fecha DESC, tipo, id_registro DESC`** — el desempate evita que dos registros del
  mismo instante se repitan o se salteen entre páginas con `LIMIT/OFFSET`.
- **`id_registro` NO es único entre tipos** (el de DISPONIBILIDAD es un `id_empleado`). La clave
  estable es el par `(tipo, id_registro)`.
- **`/registradores` no aplica los filtros de la pantalla**: si respetara el rango de fechas,
  mover las fechas vaciaría el select.
- **`por_pagina > 100` se rechaza con 422, no se recorta**. Un recorte mudo devuelve 100 filas
  que quien llama lee como el universo completo.
- **`hasta` es INCLUSIVO** (`< hasta + 1 día`), con offset **fijo UTC-4**. Nunca el huso del
  servidor: Bolivia no tiene horario de verano.
- **"Proyecto" usa el `codigo` de unidad/campaña, no el `nombre`** — las vistas de Lab 001
  exponen el código, y el nombre daría un texto largo y distinto del que muestra Seguimiento
  para la misma persona.
- ⚠️ **El proyecto de un contacto a supervisor NO queda congelado**: sale de su gente vía
  `LATERAL` y resuelve el proyecto de hoy, no el del día del contacto. Es el único campo de esa
  rama que se comporta así, y fue una decisión consciente del usuario.

### Frontend

- **`useActividadState` no reusa `useAlertaListState`, y no hay que unificarlos**: uno pagina en
  el cliente sobre un array completo, el otro en el servidor.
- **`useSupervisoresState` monta su propia instancia** de `useAlertaListState`: compartirla haría
  que un filtro puesto en Turnos apareciera aplicado en Supervisores sin que nadie lo tocara.
- **`agruparPorSupervisor` agrupa por `id_persona_supervisor`, no por nombre** — dos homónimos
  colapsarían y se le mandaría a uno la gente del otro.
- **Las tablas tienen dos vistas del mismo dato elegidas por CSS** (`md:hidden` /
  `hidden md:block`), no por `matchMedia`: así no parpadean en la primera pintura.
- **"WhatsApp" y "Registrar" están separados a propósito**: la respuesta de la persona llega
  después de la conversación, no al abrir el chat.
- **El diálogo de contacto al supervisor no tiene `disponibilidad` ni `motivo_bajo_rendimiento`**:
  son datos del afiliador, y el motivo que *supone* el supervisor ensuciaría el reporte.

### Excel y despliegue

- **Excel no soporta datetimes con zona horaria** (openpyxl lanza `ValueError`): se convierten a
  UTC-4 y se les quita el `tzinfo`.
- **El recorte del export nunca es silencioso**: `X-Filas-Exportadas` / `X-Total-Disponible` +
  `Access-Control-Expose-Headers`, y el aviso en pantalla.
- **`openpyxl` pineado en `3.1.5` exactamente**: el venv de producción es compartido con
  `sistema-personal` y `web_validador_vetados`.
- ⚠️ **`@sensibles` de Caddy aplica también bajo `/rrhh/seguimiento/`**, no sólo en la raíz. Hoy
  bloquea `.bat .cmd .pyc .pyd .exe .dll` y `.xlsx` no está, pero ampliar esa lista rompería el
  export sin tocar esta app. Primer lugar donde mirar si el botón de Excel empieza a dar 404 sin
  cuerpo.

### Trampas del entorno (ya mordieron)

- **Servidores viejos escuchando el puerto**: antes de creerle a una prueba local, `netstat -ano`
  + `Get-Process`. Ya produjo dos diagnósticos falsos.
- **La comprobación del venv por `Path` da un falso positivo** en esta máquina: muestra el Python
  global aunque el proceso venga del venv (`venv\Scripts\python.exe` es el *launcher*). La señal
  confiable es la cadena padre→hijo, o que la app importe `fastapi`.
- **Los diálogos no se pueden verificar por SSR**: van por un `Portal` de `@base-ui`, que devuelve
  markup vacío fuera del navegador.
- **La automatización de Chrome no llega a `localhost`** en este entorno (cuatro sesiones
  seguidas). Toda verificación visual es manual.

## En uso real: lo que muestran los primeros registros (2026-09-11)

Hasta el 07-sep la app estaba desplegada pero **nadie había registrado nada** (3 inserts
históricos en toda su vida, los tres pruebas de despliegue). **El 08-sep arrancó el uso
real.** Al 11-sep hay **94 registros, todos de `DORIAN GUTIERREZ`** — el único registrador.

| | |
|---|---|
| 47 contactos a afiliadores + 47 disponibilidades | **Cada contacto trae su disponibilidad**: está usando el formulario completo, no a medias |
| 8-sep 56 · 9-sep 30 · 10-sep 8 | Arrancó fuerte y viene bajando |
| 42 contestaron · 5 no | 89% de contacto efectivo |
| `YAPE` 76 · `ZAS` 18 | Dos proyectos |
| Los 47 con próxima acción **y** con notas | Notas sustanciosas, no de trámite |

**Sólo trabaja la pestaña de Turnos.** Inactividad, Reincidencia y Producción MTD no tienen
ni un registro. Antes de suponer que las otras tres "no sirven", tener en cuenta que el
umbral `< 5` de Turnos marca a ~90% de los medidos (§Invariantes), así que esa pestaña
sola ya le da más gente de la que puede llamar.

⚠️ **La categoría `OTRO` es la más usada (18 de 47), por encima de `PERSONAL_FAMILIAR` (17).**
Cuando la opción de escape gana, normalmente significa que al catálogo le falta una categoría
real. `motivo_bajo_rendimiento` existe justamente para poder reportar "cuántos se van por X"
sin leer notas a mano (`docs/historial.md`), y con `OTRO` a la cabeza ese
reporte pierde la mitad de su valor. **Antes de agregar una categoría, leer esas 18 notas**:
si hay un patrón repetido, ahí está la que falta. Es un cambio de `CHECK` en la base + el
`Literal` de `schemas.py` + el mapa de `RegistrarLlamadaDialog`.

Distribución completa: `OTRO` 18 · `PERSONAL_FAMILIAR` 17 · `SALUD` 6 · `SIN_MOTIVO_CLARO` 2
· `NO_LE_GUSTA_TURNO` 2 · `OTRO_TRABAJO` 1 · `DIFICULTAD_SISTEMA` 1.

Las disponibilidades confirmadas empiezan a llenar el hueco del 79% "Sin dato"
(el porqué, en `docs/historial.md`): 34 tiempo completo · 6 medio tiempo · 4 turno tarde ·
3 no definido. Se está llenando por la vía que el usuario eligió en su momento —a través del
formulario de contacto, con una conversación real detrás— y no por carga masiva.

## Migraciones aplicadas en `rrhh_bd` (producción)

**Qué son y por qué existen:** `seguimiento_llamada`, `seguimiento_disponibilidad` y
`seguimiento_contacto_supervisor` son las únicas tablas propias de esta app (§"Las 3 tablas
propias" arriba) — no las trae Lab 001, así que hay que crearlas a mano con DDL. Cuatro
migraciones, todas en `backend/migrations/`, todas
**idempotentes**
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ADD CONSTRAINT` guardado en un
`DO $$ ... END $$` que chequea `pg_constraint` antes de agregar):

| Migración | Qué hace |
|---|---|
| `001_create_seguimiento_llamada.sql` | Crea la tabla completa (columnas, `CHECK` en `fuente`/`resultado`, índice por `id_empleado`, `GRANT SELECT/INSERT/UPDATE` a `bex_app`) |
| `002_add_medio_y_motivo.sql` | Agrega `medio_contacto` y `motivo_bajo_rendimiento` (ver `docs/historial.md`) con sus `CHECK` de valores válidos |
| `003_create_seguimiento_disponibilidad.sql` | Crea `seguimiento_disponibilidad` (ver `docs/historial.md`): una fila por empleado, `CHECK` de valores válidos, `GRANT` a `bex_app` |
| `004_create_seguimiento_contacto_supervisor.sql` | Crea `seguimiento_contacto_supervisor` (ver `docs/historial.md`): una fila por contacto, `afiliadores` JSONB con el snapshot, 3 `CHECK`, índice por supervisor, `GRANT` a `bex_app` + la secuencia. Aplicada en `rrhh_bd_dev` el 2026-09-01 y en `rrhh_bd` el 2026-09-02 |

**Cronología real:**
- **2026-08-28** — ambas aplicadas primero en `rrhh_bd_dev`, para desarrollar y probar sin
  tocar producción.
- **2026-08-31** — aplicadas en `rrhh_bd` (prod), **con confirmación explícita del usuario
  en el chat antes de correrlas** (es una base compartida en producción, no se tocó sin
  preguntar). Repetidas ahí porque prod nunca corrió estas migraciones — solo dev las tenía
  hasta ese momento.
- **2026-09-01** — la `003` aplicada en `rrhh_bd_dev` y, después, en `rrhh_bd` (prod),
  también **con confirmación explícita del usuario**. Ya con el script versionado
  (`aplicar_migracion.py`, ver abajo), no con uno ad-hoc. Verificado en la salida del propio
  script contra prod: las 4 columnas, el `CHECK` de los 5 valores, la PK sobre `id_empleado`,
  el `FOREIGN KEY ... REFERENCES empleado_unidad(id_empleado) ON DELETE CASCADE`, grants de
  `bex_app` (`SELECT`/`INSERT`/`UPDATE`, más el `DELETE` heredado del esquema como en la 001)
  y 0 filas. Re-corrida a continuación para confirmar que el no-op es limpio.

✅ **Desplegado a prod el 2026-09-01, después de la migración** (ese es el orden seguro: la
tabla primero, el código que la lee después). Verificado contra la URL pública con
`Cache-Control: no-cache`: `/api/health` → `ok` / `database conectado`; las 4 rutas de alerta
devuelven las 5 claves `disponibilidad*`; el bundle servido (`index-vd-KJDl1.js`, el recién
construido) contiene `Disponibilidad`, `TURNO_MANANA` y `de reclutamiento`.

**Cobertura real en prod** (mejor que en dev, ~23%): de 779 filas de Turnos, 176 traen
disponibilidad heredada de reclutamiento (87 tiempo completo, 42 turno tarde, 34 turno
mañana, 7 medio tiempo, 6 no definido) y 603 quedan en "Sin dato" — que es justamente a
quienes hay que preguntarles, y el filtro los aísla.

**Cómo se aplicaron la 001 y la 002 (mecanismo, no manual — quedó en el historial de la
sesión, sin script versionado):** un script Python puntual con `psycopg2`, conectando
como el rol `bex_ingeniero` (dueño de las tablas — `bex_app` no puede hacer DDL) contra
`10.0.0.2:5432` / `rrhh_bd`, con la contraseña tomada de la variable de entorno
`RRHH_PG_PASSWORD` (mismo patrón que usa Lab 001 para sus propias migraciones — ver
`Lab 001/.claude/rules/10-credenciales-y-conexiones.md`). El script leyó y ejecutó el SQL de
los dos archivos tal cual están en el repo, en orden (`001` y después `002`), con
`autocommit = True`.

**Verificación post-migración (contra prod, no contra dev):**
- `information_schema.columns` sobre `seguimiento_llamada` → confirmadas las 13 columnas
  esperadas, incluyendo `medio_contacto` (`NOT NULL DEFAULT 'LLAMADA'`) y
  `motivo_bajo_rendimiento` (nullable) de la migración 002.
- `information_schema.role_table_grants` → confirmado que `bex_app` tiene
  `SELECT`/`INSERT`/`UPDATE` sobre la tabla (además apareció `DELETE`, heredado de un
  privilegio por defecto del esquema, no otorgado por esta migración — no es un problema,
  simplemente no hacía falta pedirlo).
- Más tarde, ya con la app desplegada, se probó un `POST /llamadas` real contra la URL
  pública de producción (ver sección de Despliegue) y se confirmó que insertó una fila real
  en `seguimiento_llamada` en `rrhh_bd` — la prueba de fuego de que las columnas y el rol
  quedaron bien. Esa fila de prueba se borró después con un DELETE puntual (mismo mecanismo:
  `bex_ingeniero` + `RRHH_PG_PASSWORD`).

**Ya hay un script versionado para esto (2026-09-01):** `backend/migrations/aplicar_migracion.py`
—  lo que CLAUDE.md venía pidiendo desde las migraciones 001/002, que se aplicaron con un
script ad-hoc armado en el momento y descartado. Hace lo mismo que hacía aquel (leer el
`.sql` del repo, conectar como `bex_ingeniero` con `RRHH_PG_PASSWORD`, `autocommit`) y
además imprime solo la verificación (columnas, constraints, grants de `bex_app`, filas) de
las tablas que ese SQL toca:

```powershell
cd backend
$env:RRHH_PG_PASSWORD = "<la de bex_ingeniero>"
venv\Scripts\python.exe migrations/aplicar_migracion.py 003_create_seguimiento_disponibilidad.sql          # dev
venv\Scripts\python.exe migrations/aplicar_migracion.py 003_create_seguimiento_disponibilidad.sql --prod   # rrhh_bd
```

Sin `--prod` va a `rrhh_bd_dev`. Con `--prod` **pide escribir `APLICAR` a mano** antes de
conectar: `rrhh_bd` es una base compartida con las otras apps de RRHH y el flag solo no
alcanza como confirmación. Como todas las migraciones son idempotentes, volver a correr una
ya aplicada es un no-op seguro — y es la forma de verificar en qué estado quedó una base.

⚠️ **Ese `input()` no se puede contestar desde una sesión de agente** (corre sin stdin). La
`003` en prod se aplicó pasándoselo por pipe: `echo APLICAR | venv\Scripts\python.exe
migrations/aplicar_migracion.py ... --prod`, y **sólo después de que el usuario lo autorizara
explícitamente en el chat**. Se evaluó agregar un flag `--confirmado` que saltee el prompt y
se descartó: hacer visible el pipe en el comando es preferible a dejar en el repo una forma
cómoda de correr DDL en producción sin que nadie confirme nada.

## Despliegue (servidor `srv.beneficioslatam.com` / `10.0.0.2`)

Mismo servidor que `rrhh-app` (Windows Server 2025, Caddy v2.11.2 como reverse proxy,
servicios Windows con nssm). `seguimiento_app` no tenía ningún despliegue propio hasta el
2026-08-31 — las coordenadas de abajo se relevaron del servidor real (no de la
documentación de `rrhh-app`), y varias piezas se **comparten con `rrhh-app` a propósito**,
no por descuido:

| Coordenada | Valor | Por qué |
|---|---|---|
| Carpeta backend | `C:\Proyectos\rrhh\apps\seguimiento\` | Mismo patrón que `apps\sistema_personal` |
| Carpeta frontend | `C:\Proyectos\rrhh\web\seguimiento\` | Mismo patrón que `web\personal` |
| venv | **Compartido**: `C:\uv-envs\rrhh\Scripts\python.exe` | Ya tenía (2026-08-31) exactamente las versiones de `requirements.txt` — instalar ahí es un no-op. Lo comparten `sistema-personal` y `web_validador_vetados` |
| Puerto backend | `8222` | ⚠️ El Caddyfile sugería 8219/8220 como libres (no aparecían en ninguna ruta), pero `netstat -ano` mostró que **ambos ya estaban ocupados** por procesos Python sin ruta en Caddy (igual que 8200–8218 y 8221). El Caddyfile documenta rutas, no puertos realmente libres — antes de asignar un puerto hay que verificar con `netstat`, no solo grepear el Caddyfile |
| Servicio nssm | `web_rrhh_seguimiento` | Patrón `web_<unidad>_<app>` de la mayoría de los servicios del servidor |
| Cuenta de servicio | `LocalSystem` | Se intentó reusar `.\bex_svc_rrhh` (la de `sistema-personal`/`web_validador_vetados`) pero esa contraseña no la maneja el usuario. Usar `Administrator` le habría dado a este backend permisos de admin total del servidor compartido. `LocalSystem` es el mismo patrón que ya usan `web_bille_afilia`, `web_bnb_feriasiv`, `web_kiosco_afilia`, `web_zas_produccion` en este servidor |
| Ruta pública | `/rrhh/seguimiento/` (API en `/rrhh/seguimiento/api/*`) | Mismo patrón que `/rrhh/personal/` |
| Acceso | Excluida del `basic_auth` genérico de `/rrhh/*` (igual que `personal`/`form`/`vetados`) | Coherente con la decisión "sin login propio" |
| DB en prod | `rrhh_bd` (no `rrhh_bd_dev`) | Migraciones 001 y 002 ya aplicadas ahí (ver arriba) |
| CORS en prod | vacío | Frontend y API comparten origen detrás de Caddy |

**Cambios en el repo para esto:** `frontend/vite.config.js` usa `base: '/rrhh/seguimiento/'`
solo en build (`command === 'build'`) — en dev sigue sirviendo en `/` para no romper
`http://localhost:5174/`. `frontend/.env.production` fija
`VITE_API_URL=/rrhh/seguimiento/api` (Vite lo carga solo para `npm run build`).

**Deploy del día a día** (una vez que el servicio y las carpetas ya existen en el servidor,
ver provisión inicial más abajo):

```powershell
cd deploy
.\deploy-backend.ps1     # aborta si backend/app está sucio · scp app/ + uv pip install en el
                          # venv compartido + sc stop/start web_rrhh_seguimiento + health check
.\deploy-frontend.ps1    # npm run build + scp a dist_up_<timestamp> + swap atómico → dist
```

Ambos son una adaptación literal de `rrhh-app/deploy/*.ps1` (mismas guardas: árbol sucio,
venv-vs-nssm-Application, stop/wait/start en vez de `nssm restart`, swap con carpeta
temporal con timestamp, health check con reintentos) — ver ese repo para el detalle de por
qué cada guarda existe (cada una nació de un incidente real documentado ahí).

✅ **Desplegado y verificado en prod el 2026-08-31.** Provisión inicial hecha en este orden:
crear `C:\Proyectos\rrhh\apps\seguimiento\{app,logs}` y `C:\Proyectos\rrhh\web\seguimiento\`;
crear a mano el `.env` de prod en el servidor (nunca versionado, contraseña de `bex_app`
copiada server-side desde el `.env` de `sistema_personal`); primer `scp` de código a mano
(backend y frontend); `uv pip install` en el venv compartido (confirmado no-op); registrar
el servicio nssm `web_rrhh_seguimiento` (`LocalSystem`, puerto `8222`); agregar el bloque
`/rrhh/seguimiento/*` al `Caddyfile` (`C:\Caddy\Caddyfile`, su propio repo git en el
servidor) **antes** del `handle_path /rrhh/*` genérico, subido primero como
`Caddyfile.new` y validado con `caddy.exe validate` (verde) antes de reemplazar el archivo
real (con backup `Caddyfile.bak_20260831-113607`) y recién ahí `caddy.exe reload`.

Verificado end-to-end contra la URL pública: `GET /rrhh/seguimiento/api/health` → `{"status":
"ok", "database": "conectado"}`; `GET /rrhh/seguimiento/` sirve el `index.html` con los
assets bajo `/rrhh/seguimiento/assets/`; `POST /rrhh/seguimiento/api/llamadas` insertó una
fila real en `rrhh_bd` (borrada después, era solo de prueba). Se confirmó que otras apps del
mismo servidor (`sistema-personal`, `vetados`, `form`) siguen respondiendo igual después del
`reload` de Caddy. `/rrhh/form` sigue devolviendo 404 en su ruta raíz — es un bug
**preexistente** ya documentado en `rrhh-app/CLAUDE.md`, no una regresión de este cambio.
