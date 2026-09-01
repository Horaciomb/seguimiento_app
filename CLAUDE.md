# CLAUDE.md — Seguimiento de Indicadores

**Qué es:** app web standalone, sin login, para que JP (y quien más lo use) registre el
resultado real de las llamadas a los afiliadores que marcan los indicadores de control de
`Lab 001 - Pasar a Datos` (`C:\temp\RRHH\Lab\001 - Pasar a Datos`). Hoy esos indicadores se
entregan como Excel por OneDrive y nadie registra si se llamó, si contestó, o qué sigue —
salvo el indicador de inactividad, que tiene un dedup propio
(`alerta_inactividad_notificacion`). Esta app generaliza esa idea a las tres fuentes, con un
log de contacto real en vez de solo dedup.

Ver `contexto_indicadores.md` para el detalle funcional de cada indicador (qué mide, de
dónde sale el dato, cómo se calcula) — es la referencia técnica de Lab 001, no de esta app.

**Decisión de diseño (2026-08-28, con el usuario):** sin login propio, un solo rol, uso
interno. Por eso el backend no tiene auth ni CORS restrictivo más allá de dev/localhost, y
`registrado_por` es texto libre (quien llama se identifica escribiendo su nombre, no
autenticándose).

---

## Qué NO es esta app

- No calcula ningún indicador. Todo el cálculo es de Lab 001; esta app solo LEE sus vistas
  (`vw_alerta_inactividad`, `vw_alerta_turnos`, `vw_produccion_mtd_vs_historico`) y agrega su
  propia lectura/escritura sobre `seguimiento_llamada`.
- No reemplaza (todavía) los Excel que Lab 001 manda a JP por PUMA — conviven. Si algún día
  se decide que esta app reemplaza esa entrega, es una decisión aparte, coordinada con Lab 001.

## Arquitectura

Mismo patrón de capas y mismo stack que `rrhh-app` (`C:\temp\RRHH\rrhh-app`), copiado y
simplificado quitando todo lo de auth/roles — ver ese repo para el porqué de cada decisión
de diseño que se heredó tal cual (pool de conexiones, keepalives TCP, `ORJSONResponse`, etc.).

```
backend/   FastAPI + SQLAlchemy 2.0, SIN auth. app/{config,database,models,schemas}.py,
           app/services/{alertas_service,llamadas_service}.py,
           app/routers/{alertas,llamadas}.py
frontend/  React 19 + Vite + Tailwind v4 + TanStack Query, SIN login/router.
           Componentes de ui/ copiados de rrhh-app/frontend (mismo look & feel, mismo
           patrón página+hook que VetadosPage.jsx/useVetadosState.js).
```

### Backend — qué endpoint hace qué

| Endpoint | Qué hace |
|---|---|
| `GET /alertas/inactividad` | `vw_alerta_inactividad`, `estado_medicion='MEDIDO' AND tramo IN ('SEGUIMIENTO','CRITICO','REVISAR BAJA')` — mismo filtro que la hoja "alerta" de `14_alerta_inactividad_afiliadores.py` |
| `GET /alertas/turnos` | `vw_alerta_turnos`, NOCHE/MADRUGADA, **último cálculo por turno** (no una ventana) — mismo filtro que la hoja "alerta" de `15_actividad_por_turno.py` (2026-08-28) |
| `GET /alertas/reincidencia` | Replica `armar_resumen_por_persona()` de `17_exportar_alerta_turnos.py`: ventana de `dias` (default 30), agrupado por empleado, `veces_en_alerta >= minimo_veces` (default 3) |
| `GET /alertas/produccion-mtd` | Los 4 filtros de `18b_exportar_produccion_mtd.py`: MEDIDO, promedio≥10, actual≤promedio, excluir a quien ya está en alerta de Inactividad o de Turnos (NOCHE/MADRUGADA, último cálculo) |
| `POST /llamadas` | Inserta en `seguimiento_llamada` |
| `GET /llamadas/historial/{id_empleado}` | Historial completo de esa persona, todas las fuentes |

Cada fila de los 4 GET de alertas se enriquece con la última `seguimiento_llamada` de ese
empleado (`services/llamadas_service.ultimas_llamadas_por_empleado`), para que la UI pinte
"cuándo se lo llamó y qué pasó" sin una consulta extra por fila.

**No se reinventa ningún criterio de negocio acá** — cada query de `alertas_service.py`
reproduce a propósito el mismo filtro ya verificado en el script de export correspondiente
del Lab. Si un número no coincide con lo que ve JP en su Excel, sospechar de la query antes
que de los datos.

### Las tablas propias: `seguimiento_llamada` y `seguimiento_disponibilidad`

`backend/migrations/001_create_seguimiento_llamada.sql`. Generaliza
`alerta_inactividad_notificacion` (que solo dedupea el indicador #1) a un log de contacto
real para las 4 fuentes: qué se llamó, qué contestó, qué sigue.

⚠️ **No lleva `ForeignKey(...)` en el modelo ORM** (`app/models.py`) aunque la tabla real sí
tiene `REFERENCES empleado_unidad(id_empleado)` — SQLAlchemy exige que la tabla referenciada
esté en el mismo `MetaData` para resolverla en el flush, y eso hubiera obligado a declarar
`empleado_unidad` como modelo propio de esta app (no lo es, es de Lab 001). La integridad la
sigue garantizando Postgres.

⚠️ **Nota de integración con Lab 001, sin resolver:** `clonar_a_dev.py` de Lab 001
reconstruye `rrhh_bd_dev` desde SU PROPIO `01_create_tables.sql` en cada re-clon —
ni `seguimiento_llamada` ni `seguimiento_disponibilidad` están en ese inventario, así que un re-clon de dev las borra (mismo
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

## Migraciones aplicadas en `rrhh_bd` (producción)

**Qué son y por qué existen:** `seguimiento_llamada` y `seguimiento_disponibilidad` son las
únicas tablas propias de esta app (§"Las tablas propias" arriba) — no las trae Lab 001, así
que hay que crearlas a mano con DDL. Tres migraciones, todas en `backend/migrations/`, todas
**idempotentes**
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ADD CONSTRAINT` guardado en un
`DO $$ ... END $$` que chequea `pg_constraint` antes de agregar):

| Migración | Qué hace |
|---|---|
| `001_create_seguimiento_llamada.sql` | Crea la tabla completa (columnas, `CHECK` en `fuente`/`resultado`, índice por `id_empleado`, `GRANT SELECT/INSERT/UPDATE` a `bex_app`) |
| `002_add_medio_y_motivo.sql` | Agrega `medio_contacto` y `motivo_bajo_rendimiento` (ver sección de WhatsApp arriba) con sus `CHECK` de valores válidos |
| `003_create_seguimiento_disponibilidad.sql` | Crea `seguimiento_disponibilidad` (ver sección de Disponibilidad arriba): una fila por empleado, `CHECK` de valores válidos, `GRANT` a `bex_app`. **Aplicada en `rrhh_bd_dev` el 2026-09-01; NO aplicada todavía en prod** — hace falta correrla antes de desplegar este cambio, o la app va a fallar al leer la tabla |

**Cronología real:**
- **2026-08-28** — ambas aplicadas primero en `rrhh_bd_dev`, para desarrollar y probar sin
  tocar producción.
- **2026-08-31** — aplicadas en `rrhh_bd` (prod), **con confirmación explícita del usuario
  en el chat antes de correrlas** (es una base compartida en producción, no se tocó sin
  preguntar). Repetidas ahí porque prod nunca corrió estas migraciones — solo dev las tenía
  hasta ese momento.

**Cómo se aplicaron (mecanismo, no manual — quedó en el historial de la sesión, no hay
script versionado para esto todavía):** un script Python puntual con `psycopg2`, conectando
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

⚠️ **Nada de esto se corrió con un script versionado en el repo** — fue un script ad-hoc
armado en el momento, ejecutado y descartado. Si hace falta repetir esta operación (por
ejemplo, una migración `003` futura), conviene guardar el script real en
`backend/migrations/aplicar_migracion.py` o similar en vez de rehacerlo desde cero cada vez.

## Verificado el 2026-08-28

Contra `rrhh_bd_dev`: las 4 queries de `alertas_service.py` corren sin error (119
inactividad, 6 turnos, 32 reincidencia, 105 producción MTD — los números no van a coincidir
con los que documenta Lab 001 para una fecha puntual, dev es un clon que cambia con el
tiempo). `POST /llamadas` + historial + enriquecimiento de "última llamada" probados
end-to-end vía HTTP real. Frontend: `npm run build` compila sin errores (3007 módulos). No
se pudo probar visualmente en navegador esta sesión (la automatización de Chrome no
respondía) — falta un recorrido manual en el navegador antes de darlo por completo.

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
