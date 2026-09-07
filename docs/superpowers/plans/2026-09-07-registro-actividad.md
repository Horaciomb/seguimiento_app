# Registro de actividad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una vista de consulta sobre las 3 tablas propias de la app —una línea de tiempo
unificada con filtros y exportación a `.xlsx`— para poder responder "qué registró Dorian" sin
entrar a la base.

**Architecture:** Backend: un `UNION ALL` en SQL normaliza las 3 tablas a un esquema común;
una sola función arma el `WHERE` y la comparten la lista paginada, el `COUNT(*)` y el export,
de modo que pantalla y archivo no puedan divergir. Frontend: una sección nueva alcanzable
desde una nav en el encabezado (sin router), con su propio hook porque esta lista pagina en el
servidor y `useAlertaListState` pagina en el cliente.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (`text()` crudo, como el resto de los servicios) ·
openpyxl 3.1.5 · React 19 + TanStack Query v5 + Tailwind v4 · axios.

**Spec:** `docs/superpowers/specs/2026-09-07-registro-actividad-design.md`

## Global Constraints

- **Sin migraciones.** No se crea ni altera ninguna tabla ni columna. Si una tarea parece
  necesitar DDL, está mal planteada: parar y avisar.
- **No se toca Lab 001** ni ninguna de las 4 queries de alerta (`alertas_service.py`). Esta
  entrega es sólo lectura sobre `seguimiento_llamada`, `seguimiento_contacto_supervisor`,
  `seguimiento_disponibilidad` + `LEFT JOIN` a `empleado_unidad`/`persona`.
- **`openpyxl==3.1.5`, exactamente esa versión.** El venv del servidor es compartido con
  `sistema-personal` y `web_validador_vetados`, que ya tienen ese pin. Otro número le cambia
  la librería por debajo a una app que hoy funciona.
- **Huso: offset fijo `timezone(timedelta(hours=-4))`.** Nunca `datetime.now()` sin tz ni el
  huso del servidor. Bolivia no tiene horario de verano.
- **El recorte del export nunca es silencioso:** headers `X-Filas-Exportadas` /
  `X-Total-Disponible` + `Access-Control-Expose-Headers`, y aviso visible en pantalla.
- **Idioma:** todo el texto de UI, nombres de columna del Excel, comentarios y mensajes de
  commit en español, como el resto del repo.
- **Base de desarrollo:** `rrhh_bd_dev` vía el `.env` que ya existe. **Nunca apuntar a
  `rrhh_bd` (prod) desde local.** Toda fila de prueba se borra al terminar la tarea.

## Nota sobre el ciclo de prueba (leer antes de la Task 1)

**Este repo no tiene suite de tests** — ni pytest, ni vitest, ni un directorio `tests/`. La
verificación que se viene usando (y que CLAUDE.md documenta en cada entrega) es **HTTP real
contra `rrhh_bd_dev`** con las filas de prueba borradas al final. Introducir pytest acá sería
scope que el spec no aprobó, así que el plan **conserva el ciclo rojo→verde** pero con
**scripts de verificación ejecutables** en vez de un framework: cada tarea escribe primero su
script, lo corre para verlo fallar, implementa, y lo corre para verlo pasar.

Los scripts viven en el scratchpad de la sesión y **no se commitean** (son andamio, igual que
las verificaciones de las entregas anteriores). Definir una vez, al empezar:

```powershell
$SCRATCH = "C:\Users\hmolina\AppData\Local\Temp\claude\C--temp-RRHH-Lab-seguimiento-app\6be7bf01-e0ad-4cd2-830e-31403e3ca4c4\scratchpad"
$PY = "C:\temp\RRHH\Lab\seguimiento_app\backend\venv\Scripts\python.exe"
```

⚠️ **Las 3 tablas están VACÍAS en `rrhh_bd_dev`** (verificado en la Task 1: 0/0/0). Contra
tablas vacías casi todas las aserciones pasan **por vacuidad** —un export de 0 filas
"coincide" con una pantalla de 0 filas sin haber probado nada—, así que las filas de prueba
se siembran **una sola vez y se MANTIENEN** hasta la Task 8, que es la que las borra. El
sembrador vive en `$SCRATCH\sembrar_pruebas.py` y toda fila lleva `registrado_por` con
prefijo `PRUEBA_` para poder borrarlas de un solo `DELETE`. **Ninguna tarea intermedia
limpia la base.**

⚠️ **Antes de creerle a cualquier prueba local contra el puerto 8010**, verificar que quien
escucha es el uvicorn que acabás de levantar y no uno de una sesión anterior con el código
viejo:

```powershell
netstat -ano | Select-String ":8010" ; Get-Process -Id <pid> | Select-Object Path
```

Ya mordió dos veces (ver CLAUDE.md §Contacto al supervisor).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `backend/app/services/actividad_service.py` | **Crear.** El `UNION ALL`, los filtros, la paginación, el conteo y la lista de registradores. Único lugar donde vive el `WHERE` |
| `backend/app/services/excel_service.py` | **Crear.** Armar un `.xlsx` en memoria. Genérico (columnas + filas), sin saber nada de actividad |
| `backend/app/routers/actividad.py` | **Crear.** Los 3 endpoints y las columnas del Excel |
| `backend/app/schemas.py` | **Modificar.** 3 modelos de salida al final del archivo |
| `backend/app/main.py:7,29` | **Modificar.** Importar y registrar el router |
| `backend/requirements.txt` | **Modificar.** `openpyxl==3.1.5` |
| `frontend/src/api/actividad.js` | **Crear.** Las 3 llamadas |
| `frontend/src/lib/download.js` | **Crear.** Disparar la descarga de un blob (copiado de rrhh-app) |
| `frontend/src/hooks/useExportarXlsx.js` | **Crear.** Estado de la descarga + comparación de los headers de recorte (copiado) |
| `frontend/src/components/ui/aviso-export.jsx` | **Crear.** El aviso de archivo topado (copiado) |
| `frontend/src/hooks/useActividadState.js` | **Crear.** Filtros + paginación server-side + las dos queries |
| `frontend/src/components/actividad/TablaActividad.jsx` | **Crear.** Tabla en escritorio / tarjetas en teléfono |
| `frontend/src/components/actividad/DetalleActividadDialog.jsx` | **Crear.** El detalle de un registro |
| `frontend/src/pages/ActividadPage.jsx` | **Crear.** Filtros, tabla, paginación, botón de export |
| `frontend/src/App.jsx` | **Modificar.** Layout + nav de dos secciones |
| `frontend/src/pages/SeguimientoPage.jsx:209-213` | **Modificar.** Pierde su wrapper y su `<h1>` |

---

## Task 1: La consulta unificada (`actividad_service.py`)

**Files:**
- Create: `backend/app/services/actividad_service.py`
- Verify: `$SCRATCH\verificar_task1.py` (no se commitea)

**Interfaces:**
- Consumes: `..database.SessionLocal` (ya existe), las 3 tablas propias.
- Produces:
  - `listar(db, *, desde=None, hasta=None, registrado_por=None, q=None, limite=25, offset=0) -> list[dict]`
  - `contar(db, *, desde=None, hasta=None, registrado_por=None, q=None) -> int`
  - `registradores(db) -> list[dict]` con claves `registrado_por`, `cantidad`
  - Cada dict de `listar` trae: `tipo`, `id_registro`, `fecha`, `registrado_por`, `sujeto_id`,
    `sujeto_nombre`, `sujeto_ci`, `indicador`, `resultado`, `medio`, `detalle`
  - `desde`/`hasta` son `datetime.date` y se interpretan en hora de Bolivia; `hasta` es
    **inclusivo**

- [ ] **Step 1: Escribir el script de verificación**

Crear `$SCRATCH\verificar_task1.py`:

```python
"""Verifica actividad_service contra rrhh_bd_dev. Rojo antes de implementar, verde después."""
import sys
from datetime import date, timedelta

sys.path.insert(0, r"C:\temp\RRHH\Lab\seguimiento_app\backend")

from sqlalchemy import text
from app.database import SessionLocal
from app.services import actividad_service

db = SessionLocal()
fallos = []

def chequear(nombre, condicion, detalle=""):
    print(("  OK   " if condicion else "  FALLA") + f" {nombre} {detalle}")
    if not condicion:
        fallos.append(nombre)

# 1. El total sin filtros es exactamente la suma de las 3 tablas.
esperado = sum(
    db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar_one()
    for t in ("seguimiento_llamada", "seguimiento_contacto_supervisor", "seguimiento_disponibilidad")
)
total = actividad_service.contar(db)
chequear("total = suma de las 3 tablas", total == esperado, f"({total} vs {esperado})")

# 2. Las tres ramas aportan filas con el tipo correcto y ninguna clave falta.
CLAVES = {"tipo", "id_registro", "fecha", "registrado_por", "sujeto_id",
          "sujeto_nombre", "sujeto_ci", "indicador", "resultado", "medio", "detalle"}
filas = actividad_service.listar(db, limite=1000)
chequear("todas las claves presentes", all(CLAVES <= set(f) for f in filas))
chequear("tipos válidos",
         {f["tipo"] for f in filas} <= {"AFILIADOR", "SUPERVISOR", "DISPONIBILIDAD"})
for tipo, tabla in (("AFILIADOR", "seguimiento_llamada"),
                    ("SUPERVISOR", "seguimiento_contacto_supervisor"),
                    ("DISPONIBILIDAD", "seguimiento_disponibilidad")):
    n_tabla = db.execute(text(f"SELECT COUNT(*) FROM {tabla}")).scalar_one()
    n_union = sum(1 for f in filas if f["tipo"] == tipo)
    chequear(f"{tipo}: el join no multiplica ni pierde filas",
             n_union == min(n_tabla, 1000) or n_union == n_tabla, f"({n_union} vs {n_tabla})")

# 3. Orden descendente por fecha, sin excepciones.
fechas = [f["fecha"] for f in filas]
chequear("ordenado por fecha DESC", fechas == sorted(fechas, reverse=True))

# 4. La paginación no repite ni saltea: página 1 + página 2 == las primeras 4 filas.
p1 = actividad_service.listar(db, limite=2, offset=0)
p2 = actividad_service.listar(db, limite=2, offset=2)
clave = lambda f: (f["tipo"], f["id_registro"])
chequear("paginación sin repetidos",
         len({clave(f) for f in p1 + p2}) == len(p1 + p2))
chequear("paginación == la lista corrida",
         [clave(f) for f in p1 + p2] == [clave(f) for f in actividad_service.listar(db, limite=4)])

# 5. `hasta` es INCLUSIVO: filtrar hasta el día de la fila más reciente la sigue trayendo.
if filas:
    dia = filas[0]["fecha"].astimezone().date()
    con_filtro = actividad_service.contar(db, desde=dia, hasta=dia)
    chequear("hasta inclusivo (la fila del día sigue estando)", con_filtro >= 1, f"({con_filtro})")
    chequear("desde posterior a todo => 0",
             actividad_service.contar(db, desde=dia + timedelta(days=400)) == 0)

# 6. El buscador pega por nombre y por CI.
con_nombre = [f for f in filas if f["sujeto_nombre"]]
if con_nombre:
    trozo = con_nombre[0]["sujeto_nombre"].split()[0]
    chequear("buscador por nombre", actividad_service.contar(db, q=trozo) >= 1)

# 7. registradores() coincide con un GROUP BY a mano.
regs = actividad_service.registradores(db)
esperado_regs = db.execute(text("""
    SELECT registrado_por, COUNT(*) FROM (
        SELECT registrado_por FROM seguimiento_llamada
        UNION ALL SELECT registrado_por FROM seguimiento_contacto_supervisor
        UNION ALL SELECT registrado_por FROM seguimiento_disponibilidad
    ) t WHERE registrado_por IS NOT NULL AND TRIM(registrado_por) <> ''
    GROUP BY registrado_por
""")).all()
chequear("registradores == GROUP BY manual",
         sorted((r["registrado_por"], r["cantidad"]) for r in regs) == sorted((a, b) for a, b in esperado_regs))

db.close()
print("\nFALLOS:", fallos or "ninguno")
sys.exit(1 if fallos else 0)
```

- [ ] **Step 2: Correrlo para verlo fallar**

```powershell
& $PY $SCRATCH\verificar_task1.py
```

Esperado: `ModuleNotFoundError: No module named 'app.services.actividad_service'`.

- [ ] **Step 3: Implementar el servicio**

Crear `backend/app/services/actividad_service.py`:

```python
"""Línea de tiempo unificada de todo lo que esta app registra.

Las 3 tablas propias tienen forma distinta —una llamada apunta a UN afiliador, un contacto
a supervisor habla de N a la vez, y la disponibilidad es un atributo de la persona— así que
se normalizan acá a un esquema común con `UNION ALL`, en vez de unirlas en memoria.

El motivo no es de rendimiento sino de correctitud: **una sola definición de qué filas
entran**, compartida por la lista paginada, el COUNT y el export a Excel. Si el archivo
armara su propia consulta, tarde o temprano traería filas que la pantalla no mostraba.

⚠️ El JOIN del afiliador va por `empleado_unidad.id_empleado`, que es PRIMARY KEY: devuelve
una fila y no multiplica. NO confundir con el riesgo que documenta `supervisores_service`,
que era joinear por `id_persona` (ahí sí hay personas con más de una fila activa).
"""
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

# UTC-4 FIJO. Bolivia no tiene horario de verano y usar el huso del servidor ataría el
# resultado del filtro a dónde corre el proceso. Mismo criterio que el excel_service.
_HUSO_BOLIVIA = timezone(timedelta(hours=-4))

# Las 3 ramas, normalizadas. `detalle` lleva lo específico de cada tipo: tiparlo no le
# compraría nada a un panel de sólo lectura, y así agregar un campo no cambia el esquema.
_CTE = """
WITH actividad AS (
    SELECT 'AFILIADOR'::varchar AS tipo,
           sl.id                AS id_registro,
           sl.fecha_contacto    AS fecha,
           sl.registrado_por,
           sl.id_empleado       AS sujeto_id,
           NULLIF(TRIM(CONCAT_WS(' ', p.nombres, p.apellido_paterno, p.apellido_materno)), '') AS sujeto_nombre,
           p.ci                 AS sujeto_ci,
           sl.fuente            AS indicador,
           sl.resultado,
           sl.medio_contacto    AS medio,
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

    -- El nombre sale del snapshot desnormalizado, NO del join: si en Lab 001 le corrigen el
    -- nombre al supervisor, el historial tiene que seguir diciendo a quién se contactó.
    -- El join a `persona` es sólo para el CI.
    SELECT 'SUPERVISOR'::varchar, scs.id, scs.fecha_contacto, scs.registrado_por,
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

    -- `seguimiento_disponibilidad` es una fila POR EMPLEADO (estado actual, no historial):
    -- esta rama muestra la ÚLTIMA confirmación de cada persona, no la secuencia de cambios.
    -- Por eso `id_registro` es el id_empleado y no un id propio: la tabla no tiene uno.
    SELECT 'DISPONIBILIDAD'::varchar, sd.id_empleado, sd.fecha_actualizacion, sd.registrado_por,
           sd.id_empleado,
           NULLIF(TRIM(CONCAT_WS(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
           p2.ci,
           NULL::varchar, NULL::varchar, NULL::varchar,
           jsonb_build_object('disponibilidad', sd.disponibilidad)
    FROM seguimiento_disponibilidad sd
    LEFT JOIN empleado_unidad eu2 ON eu2.id_empleado = sd.id_empleado
    LEFT JOIN persona p2          ON p2.id_persona   = eu2.id_persona
)
"""

_FILTROS = """
WHERE (:desde          IS NULL OR fecha >= :desde)
  AND (:hasta          IS NULL OR fecha <  :hasta)
  AND (:registrado_por IS NULL OR registrado_por = :registrado_por)
  AND (:q              IS NULL OR sujeto_nombre ILIKE :q_like OR sujeto_ci ILIKE :q_like)
"""

# `id_registro` desempata a propósito: con LIMIT/OFFSET y sólo `fecha DESC`, dos registros
# del mismo instante pueden repetirse o saltearse entre páginas.
_ORDEN = " ORDER BY fecha DESC, tipo, id_registro DESC"


def _inicio_del_dia(d: date | None) -> datetime | None:
    """Medianoche de ese día EN BOLIVIA, como timestamptz."""
    return None if d is None else datetime.combine(d, time.min, tzinfo=_HUSO_BOLIVIA)


def _params(desde, hasta, registrado_por, q) -> dict:
    """Los filtros, en un solo lugar: los comparten la lista, el conteo y el export.

    `hasta` es INCLUSIVO y se traduce a `< hasta + 1 día`. Con `<=` sobre la medianoche,
    "hasta el 7" dejaría afuera todo el 7 salvo el instante exacto de las 00:00.
    """
    texto = (q or "").strip() or None
    return {
        "desde": _inicio_del_dia(desde),
        "hasta": _inicio_del_dia(hasta + timedelta(days=1)) if hasta else None,
        "registrado_por": (registrado_por or "").strip() or None,
        "q": texto,
        "q_like": f"%{texto}%" if texto else None,
    }


def listar(db: Session, *, desde=None, hasta=None, registrado_por=None, q=None,
           limite: int = 25, offset: int = 0) -> list[dict]:
    sql = text(_CTE + "SELECT * FROM actividad" + _FILTROS + _ORDEN + " LIMIT :limite OFFSET :offset")
    params = {**_params(desde, hasta, registrado_por, q), "limite": limite, "offset": offset}
    return [dict(f) for f in db.execute(sql, params).mappings().all()]


def contar(db: Session, *, desde=None, hasta=None, registrado_por=None, q=None) -> int:
    sql = text(_CTE + "SELECT COUNT(*) FROM actividad" + _FILTROS)
    return db.execute(sql, _params(desde, hasta, registrado_por, q)).scalar_one()


# NO aplica los filtros de la pantalla a propósito: si respetara el rango de fechas, mover
# las fechas vaciaría el select y dejaría a quien busca sin poder elegir a nadie.
_REGISTRADORES_SQL = text(
    """
    SELECT registrado_por, COUNT(*) AS cantidad
    FROM (
        SELECT registrado_por FROM seguimiento_llamada
        UNION ALL
        SELECT registrado_por FROM seguimiento_contacto_supervisor
        UNION ALL
        SELECT registrado_por FROM seguimiento_disponibilidad
    ) t
    WHERE registrado_por IS NOT NULL AND TRIM(registrado_por) <> ''
    GROUP BY registrado_por
    ORDER BY cantidad DESC, registrado_por
    """
)


def registradores(db: Session) -> list[dict]:
    """Quiénes registraron algo alguna vez, con su conteo.

    `registrado_por` es TEXTO LIBRE (no hay login), así que la misma persona puede haber
    firmado de varias formas. Se devuelven tal como están, sin normalizar: el select tiene
    que mostrar el problema, no esconderlo detrás de un ILIKE que adivine.
    """
    return [dict(f) for f in db.execute(_REGISTRADORES_SQL).mappings().all()]
```

- [ ] **Step 4: Correrlo para verlo pasar**

```powershell
& $PY $SCRATCH\verificar_task1.py
```

Esperado: `FALLOS: ninguno`, exit 0.

Si `seguimiento_disponibilidad` o alguna otra tabla está vacía en dev, insertar 2-3 filas de
prueba con `bex_app`, re-correr, y **borrarlas al terminar la tarea**.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/actividad_service.py
git commit -m "Unificar los 3 logs de la app en una sola consulta de actividad"
```

---

## Task 2: Endpoints de lista y registradores

**Files:**
- Create: `backend/app/routers/actividad.py`
- Modify: `backend/app/schemas.py` (al final), `backend/app/main.py:7` y `:29`
- Verify: `$SCRATCH\verificar_task2.py`

**Interfaces:**
- Consumes: `actividad_service.listar` / `contar` / `registradores` (Task 1).
- Produces:
  - `GET /actividad?desde&hasta&registrado_por&q&pagina&por_pagina` → `{items: [...], total: int}`
  - `GET /actividad/registradores` → `[{registrado_por, cantidad}]`
  - Schemas `ActividadItemOut`, `ActividadPageOut`, `RegistradorOut`

- [ ] **Step 1: Escribir el script de verificación**

Crear `$SCRATCH\verificar_task2.py`:

```python
"""Verifica los endpoints por HTTP real contra el uvicorn local."""
import sys, json, urllib.request, urllib.parse

BASE = "http://127.0.0.1:8010"
fallos = []

def get(ruta):
    with urllib.request.urlopen(BASE + ruta) as r:
        return r.status, json.loads(r.read())

def chequear(nombre, condicion, detalle=""):
    print(("  OK   " if condicion else "  FALLA") + f" {nombre} {detalle}")
    if not condicion:
        fallos.append(nombre)

st, body = get("/actividad")
chequear("GET /actividad responde 200", st == 200)
chequear("devuelve items y total", {"items", "total"} <= set(body))
chequear("por_pagina por defecto = 25", len(body["items"]) <= 25)

st, pag1 = get("/actividad?pagina=1&por_pagina=2")
st, pag2 = get("/actividad?pagina=2&por_pagina=2")
clave = lambda f: (f["tipo"], f["id_registro"])
chequear("página 1 y 2 no se pisan",
         not ({clave(f) for f in pag1["items"]} & {clave(f) for f in pag2["items"]}))
chequear("el total no cambia entre páginas", pag1["total"] == pag2["total"])

st, body = get("/actividad?por_pagina=999")
chequear("por_pagina topado en 100", len(body["items"]) <= 100)

st, regs = get("/actividad/registradores")
chequear("GET /actividad/registradores responde 200", st == 200)
chequear("trae registrado_por y cantidad",
         all({"registrado_por", "cantidad"} <= set(r) for r in regs))
chequear("ordenado por cantidad DESC",
         [r["cantidad"] for r in regs] == sorted((r["cantidad"] for r in regs), reverse=True))

if regs:
    quien = urllib.parse.quote(regs[0]["registrado_por"])
    st, filtrado = get(f"/actividad?registrado_por={quien}&por_pagina=100")
    chequear("filtro por registrado_por acota",
             all(f["registrado_por"] == regs[0]["registrado_por"] for f in filtrado["items"]))
    chequear("el total del filtro coincide con el conteo del select",
             filtrado["total"] == regs[0]["cantidad"], f'({filtrado["total"]} vs {regs[0]["cantidad"]})')

st, vacio = get("/actividad?desde=2099-01-01")
chequear("rango futuro => 0 filas", vacio["total"] == 0 and vacio["items"] == [])

print("\nFALLOS:", fallos or "ninguno")
sys.exit(1 if fallos else 0)
```

- [ ] **Step 2: Levantar el backend y correrlo para verlo fallar**

```powershell
netstat -ano | Select-String ":8010"   # tiene que estar libre; si no, matar el proceso viejo
Start-Process -NoNewWindow $PY -ArgumentList "-m","uvicorn","app.main:app","--port","8010" -WorkingDirectory "C:\temp\RRHH\Lab\seguimiento_app\backend"
& $PY $SCRATCH\verificar_task2.py
```

Esperado: `HTTP Error 404: Not Found` en la primera llamada.

- [ ] **Step 3: Agregar los schemas**

Al final de `backend/app/schemas.py`:

```python
# --- Registro de actividad (línea de tiempo unificada de las 3 tablas propias) ---------

TipoActividad = Literal["AFILIADOR", "SUPERVISOR", "DISPONIBILIDAD"]


class ActividadItemOut(BaseModel):
    """Un registro de la línea de tiempo, ya normalizado por `actividad_service`.

    ⚠️ `id_registro` NO es único entre tipos: el de DISPONIBILIDAD es un `id_empleado`,
    porque esa tabla no tiene id propio. La clave estable es el par (tipo, id_registro).
    """

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
    # Abierto a propósito: cada tipo aporta claves distintas y tipar la unión no le
    # compraría nada a un panel de sólo lectura.
    detalle: dict[str, Any] = {}


class ActividadPageOut(BaseModel):
    items: list[ActividadItemOut]
    total: int


class RegistradorOut(BaseModel):
    registrado_por: str
    cantidad: int
```

- [ ] **Step 4: Crear el router**

Crear `backend/app/routers/actividad.py`:

```python
"""Consulta del movimiento registrado en la app (las 3 tablas propias)."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import ActividadPageOut, RegistradorOut
from ..services import actividad_service

router = APIRouter(prefix="/actividad", tags=["actividad"])


@router.get("", response_model=ActividadPageOut)
def listar_actividad(
    desde: Optional[date] = Query(None, description="Día inicial, en hora de Bolivia"),
    hasta: Optional[date] = Query(None, description="Día final INCLUSIVO, en hora de Bolivia"),
    registrado_por: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Nombre o CI del afiliador/supervisor"),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """La línea de tiempo paginada.

    `total` es el del filtro completo, no el de la página: la barra de paginación necesita
    saber cuántas hay en total para poder ofrecer "Siguiente".
    """
    filtros = dict(desde=desde, hasta=hasta, registrado_por=registrado_por, q=q)
    items = actividad_service.listar(
        db, **filtros, limite=por_pagina, offset=(pagina - 1) * por_pagina
    )
    return {"items": items, "total": actividad_service.contar(db, **filtros)}


# ⚠️ Declarada DESPUÉS de la ruta raíz pero con path propio: no hay conflicto porque `""`
# no captura segmentos. Si algún día se agrega `/{algo}`, esta tiene que ir ANTES.
@router.get("/registradores", response_model=list[RegistradorOut])
def listar_registradores(db: Session = Depends(get_db)):
    """Quiénes registraron algo, con su conteo — para poblar el select.

    Sin filtros a propósito: si respetara el rango de fechas de la pantalla, mover las
    fechas vaciaría el select y dejaría a quien busca sin poder elegir a nadie.
    """
    return actividad_service.registradores(db)
```

- [ ] **Step 5: Registrar el router en `main.py`**

En `backend/app/main.py`, línea 7, cambiar:

```python
from .routers import alertas, llamadas, supervisores
```

por:

```python
from .routers import actividad, alertas, llamadas, supervisores
```

y después de `app.include_router(supervisores.router)` agregar:

```python
app.include_router(actividad.router)
```

- [ ] **Step 6: Reiniciar el backend y correr la verificación**

```powershell
Get-Process python | Where-Object { $_.Path -like "*seguimiento_app*" } | Stop-Process
Start-Process -NoNewWindow $PY -ArgumentList "-m","uvicorn","app.main:app","--port","8010" -WorkingDirectory "C:\temp\RRHH\Lab\seguimiento_app\backend"
& $PY $SCRATCH\verificar_task2.py
```

Esperado: `FALLOS: ninguno`.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/actividad.py backend/app/schemas.py backend/app/main.py
git commit -m "Exponer la linea de tiempo de actividad y sus registradores"
```

---

## Task 3: Export a Excel

**Files:**
- Create: `backend/app/services/excel_service.py`
- Modify: `backend/app/routers/actividad.py`, `backend/requirements.txt`
- Verify: `$SCRATCH\verificar_task3.py`

**Interfaces:**
- Consumes: `actividad_service.listar` / `contar`.
- Produces: `GET /actividad/export.xlsx` (mismos filtros que la lista, sin `pagina`), y
  `excel_service.construir_xlsx(*, titulo_hoja: str, columnas: Sequence[tuple[str, Callable]], filas: Sequence) -> BytesIO`

- [ ] **Step 1: Escribir el script de verificación**

Crear `$SCRATCH\verificar_task3.py`:

```python
"""El .xlsx tiene que coincidir con la pantalla, y las fechas no pueden correrse."""
import sys, urllib.request, json
from io import BytesIO
from openpyxl import load_workbook

BASE = "http://127.0.0.1:8010"
fallos = []

def chequear(nombre, condicion, detalle=""):
    print(("  OK   " if condicion else "  FALLA") + f" {nombre} {detalle}")
    if not condicion:
        fallos.append(nombre)

with urllib.request.urlopen(BASE + "/actividad?por_pagina=100") as r:
    pantalla = json.loads(r.read())

with urllib.request.urlopen(BASE + "/actividad/export.xlsx") as r:
    chequear("responde 200", r.status == 200)
    chequear("media type de xlsx", "spreadsheetml" in r.headers["Content-Type"])
    chequear("Content-Disposition con nombre", "attachment" in r.headers["Content-Disposition"])
    exportadas = int(r.headers["X-Filas-Exportadas"])
    disponibles = int(r.headers["X-Total-Disponible"])
    chequear("expone los headers a JS",
             "X-Filas-Exportadas" in r.headers.get("Access-Control-Expose-Headers", ""))
    contenido = r.read()

chequear("X-Total-Disponible == el total de la pantalla",
         disponibles == pantalla["total"], f"({disponibles} vs {pantalla['total']})")

wb = load_workbook(BytesIO(contenido))
ws = wb.active
chequear("hoja 'Movimiento'", ws.title == "Movimiento")
chequear("una fila por registro + encabezado", ws.max_row == exportadas + 1,
         f"({ws.max_row} vs {exportadas + 1})")
chequear("encabezado congelado", ws.freeze_panes == "A2")

encabezados = [c.value for c in ws[1]]
ESPERADOS = ["Fecha y hora", "Tipo", "Persona / supervisor", "CI", "Indicador", "Resultado",
             "Medio", "Quién registró", "Motivo", "Próxima acción", "Fecha de seguimiento",
             "Notas", "Afiliadores mencionados", "Cantidad de afiliadores",
             "Disponibilidad confirmada"]
chequear("las 15 columnas, en orden", encabezados == ESPERADOS, f"\n     {encabezados}")

# Ninguna celda de fecha puede llevar tzinfo (openpyxl lanza ValueError) ni estar corrida.
if exportadas:
    primera_fecha = ws.cell(row=2, column=1).value
    chequear("la fecha se escribió como datetime naive",
             primera_fecha is not None and getattr(primera_fecha, "tzinfo", None) is None)
    esperada = pantalla["items"][0]["fecha"][:16].replace("T", " ")
    chequear("la fecha no está corrida por huso",
             str(primera_fecha)[:16] == esperada, f"({primera_fecha} vs {esperada})")

# El filtro del archivo es el mismo que el de la pantalla.
with urllib.request.urlopen(BASE + "/actividad/export.xlsx?desde=2099-01-01") as r:
    chequear("filtro vacío => sólo el encabezado", int(r.headers["X-Filas-Exportadas"]) == 0)

print("\nFALLOS:", fallos or "ninguno")
sys.exit(1 if fallos else 0)
```

- [ ] **Step 2: Correrlo para verlo fallar**

```powershell
& $PY $SCRATCH\verificar_task3.py
```

Esperado: `HTTP Error 404` (y posiblemente `ModuleNotFoundError: openpyxl` en el propio script).

- [ ] **Step 3: Agregar la dependencia e instalarla**

Agregar a `backend/requirements.txt`, después de `python-dotenv==1.0.1`:

```
openpyxl==3.1.5
```

⚠️ **Exactamente `3.1.5`** — el venv del servidor es compartido con `sistema-personal` y
`web_validador_vetados`, que ya tienen ese pin. Otro número se lo cambia por debajo.

```powershell
& $PY -m pip install openpyxl==3.1.5
```

- [ ] **Step 4: Crear `excel_service.py`**

Copiar `C:\temp\RRHH\rrhh-app\backend\app\services\excel_service.py` **tal cual**, reemplazando
únicamente su docstring de módulo (el original habla de la planilla y de UC-16, que no aplican
acá) por:

```python
"""Generación de archivos Excel (.xlsx).

Copiado de `rrhh-app/backend/app/services/excel_service.py`, mismo criterio con el que se
copió todo `components/ui/` del frontend: el patrón ya está probado ahí y sus dos detalles
finos ya costaron un error una vez.

Genérico a propósito —recibe `(encabezado, extractor)` y filas, no sabe nada de actividad—
para que el router decida qué columnas salen.
"""
```

Lo que **no** hay que tocar del archivo copiado, porque cada cosa está por una razón:

- `_HUSO_BOLIVIA = timezone(timedelta(hours=-4))` y la conversión en `_texto()`: **Excel no
  soporta datetimes con zona horaria** (openpyxl lanza `ValueError`), y escribir el UTC
  correría todas las fechas 4 horas, cambiando el día a la medianoche.
- `ANCHO_MAXIMO = 60`: sin techo, una nota larga produce una columna de 500 caracteres.
- `ws.freeze_panes = "A2"`: sin eso, en 500 filas se pierde de vista qué es cada columna.
- `columnas` como lista de tuplas y no dict: el orden es explícito.

- [ ] **Step 5: Agregar el endpoint de export**

En `backend/app/routers/actividad.py`, agregar a los imports:

```python
from datetime import datetime

from fastapi.responses import StreamingResponse

from ..services import actividad_service, excel_service
```

y al final del archivo:

```python
# El caso de uso es bajarse el período completo, así que el techo es alto; 5000 deja margen
# de años sin volverse ilimitado. Mismo número que `LIMITE_EXPORT_PLANILLA` en rrhh-app.
LIMITE_EXPORT = 5000

_MOTIVO_LABEL = {
    "SALUD": "Salud",
    "PERSONAL_FAMILIAR": "Personal/familiar",
    "OTRO_TRABAJO": "Consiguió otro trabajo",
    "NO_LE_GUSTA_TURNO": "No le gusta el turno/proyecto",
    "PAGO_COMISIONES": "Pago/comisiones",
    "DIFICULTAD_SISTEMA": "Dificultad con el sistema",
    "SIN_MOTIVO_CLARO": "Sin motivo claro",
    "OTRO": "Otro",
}

_TIPO_LABEL = {
    "AFILIADOR": "Contacto a afiliador",
    "SUPERVISOR": "Contacto a supervisor",
    "DISPONIBILIDAD": "Disponibilidad confirmada",
}

_FUENTE_LABEL = {
    "INACTIVIDAD": "Inactividad",
    "TURNOS": "Turnos",
    "REINCIDENCIA": "Reincidencia",
    "PRODUCCION_MTD": "Producción MTD",
}


def _afiliadores(fila: dict) -> str | None:
    """Los N afiliadores de un contacto a supervisor, en una celda.

    Sale del snapshot congelado, no de la alerta de hoy: la métrica que motivó el mensaje
    ("45 días sin afiliar") ya no existe en ninguna vista al día siguiente.
    """
    lista = (fila.get("detalle") or {}).get("afiliadores") or []
    partes = [
        " ".join(p for p in (a.get("nombre"), f"({a['metrica']})" if a.get("metrica") else None) if p)
        for a in lista
    ]
    return " · ".join(partes) or None


_COLUMNAS = [
    ("Fecha y hora",             lambda f: f.get("fecha")),
    ("Tipo",                     lambda f: _TIPO_LABEL.get(f.get("tipo"), f.get("tipo"))),
    ("Persona / supervisor",     lambda f: f.get("sujeto_nombre")),
    ("CI",                       lambda f: f.get("sujeto_ci")),
    ("Indicador",                lambda f: _FUENTE_LABEL.get(f.get("indicador"), f.get("indicador"))),
    ("Resultado",                lambda f: f.get("resultado")),
    ("Medio",                    lambda f: f.get("medio")),
    ("Quién registró",           lambda f: f.get("registrado_por")),
    ("Motivo",                   lambda f: _MOTIVO_LABEL.get(
        (f.get("detalle") or {}).get("motivo_bajo_rendimiento"),
        (f.get("detalle") or {}).get("motivo_bajo_rendimiento"))),
    ("Próxima acción",           lambda f: (f.get("detalle") or {}).get("proxima_accion")),
    ("Fecha de seguimiento",     lambda f: (f.get("detalle") or {}).get("fecha_proximo_seguimiento")),
    ("Notas",                    lambda f: (f.get("detalle") or {}).get("notas")),
    ("Afiliadores mencionados",  _afiliadores),
    ("Cantidad de afiliadores",  lambda f: (f.get("detalle") or {}).get("cantidad_afiliadores")),
    ("Disponibilidad confirmada", lambda f: (f.get("detalle") or {}).get("disponibilidad")),
]


@router.get("/export.xlsx")
def exportar_actividad(
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    registrado_por: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """El mismo filtro que la pantalla, en un `.xlsx`.

    Ignora `pagina`/`por_pagina` a propósito: se exporta el resultado del filtro, no la
    página que se está viendo.

    🔴 **El recorte no puede ser silencioso.** Un archivo topado se lee como el universo
    completo y alguien decide sobre datos que no están; por eso van las dos cabeceras y el
    frontend las compara siempre.
    """
    filtros = dict(desde=desde, hasta=hasta, registrado_por=registrado_por, q=q)
    filas = actividad_service.listar(db, **filtros, limite=LIMITE_EXPORT, offset=0)
    total = actividad_service.contar(db, **filtros)

    buffer = excel_service.construir_xlsx(
        titulo_hoja="Movimiento", columnas=_COLUMNAS, filas=filas,
    )
    sello = datetime.now().strftime("%Y%m%d-%H%M")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="actividad-{sello}.xlsx"',
            "X-Filas-Exportadas": str(len(filas)),
            "X-Total-Disponible": str(total),
            # Sin esto el navegador no deja leer las dos cabeceras desde JS.
            "Access-Control-Expose-Headers": "X-Filas-Exportadas, X-Total-Disponible",
        },
    )
```

- [ ] **Step 6: Reiniciar y verificar**

```powershell
Get-Process python | Where-Object { $_.Path -like "*seguimiento_app*" } | Stop-Process
Start-Process -NoNewWindow $PY -ArgumentList "-m","uvicorn","app.main:app","--port","8010" -WorkingDirectory "C:\temp\RRHH\Lab\seguimiento_app\backend"
& $PY $SCRATCH\verificar_task3.py
```

Esperado: `FALLOS: ninguno`.

- [ ] **Step 7: Verificar a mano que el recorte avisa**

Bajar `LIMITE_EXPORT` a `2` temporalmente, reiniciar, y confirmar que
`X-Filas-Exportadas: 2` con `X-Total-Disponible` mayor. **Volver a dejarlo en 5000.**

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/excel_service.py backend/app/routers/actividad.py backend/requirements.txt
git commit -m "Exportar el registro de actividad a Excel con aviso de recorte"
```

---

## Task 4: La sección nueva en el frontend (nav + página vacía)

**Files:**
- Create: `frontend/src/pages/ActividadPage.jsx`, `frontend/src/api/actividad.js`
- Modify: `frontend/src/App.jsx`, `frontend/src/pages/SeguimientoPage.jsx:209-213`

**Interfaces:**
- Produces: `getActividad(params)`, `getRegistradores()`, `getActividadXlsx(params)` en
  `api/actividad.js`; `<ActividadPage />` sin props.

- [ ] **Step 1: Crear la capa de API**

Crear `frontend/src/api/actividad.js`:

```js
import client from './client'

export const getActividad = (params) => client.get('/actividad', { params })
export const getRegistradores = () => client.get('/actividad/registradores')

/**
 * El `.xlsx`. `responseType: 'blob'` es obligatorio: sin eso axios intenta parsear el
 * binario como texto y el archivo llega corrupto.
 */
export const getActividadXlsx = (params) =>
  client.get('/actividad/export.xlsx', { params, responseType: 'blob' })
```

- [ ] **Step 2: Crear la página, por ahora sólo el encabezado**

Crear `frontend/src/pages/ActividadPage.jsx`:

```jsx
/**
 * Todo lo que esta app registró, en una sola línea de tiempo.
 *
 * Las 5 pestañas de Seguimiento muestran a quién HAY QUE contactar; esto muestra a quién SE
 * contactó, quién lo hizo y qué pasó. Antes de esta pantalla, la única forma de saberlo era
 * abrir el historial persona por persona.
 */
export default function ActividadPage() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Registro de actividad</h2>
        <p className="text-sm text-muted-foreground">
          Contactos a afiliadores y a supervisores, y disponibilidades confirmadas, en orden
          cronológico.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Sacarle el wrapper y el título a `SeguimientoPage`**

En `frontend/src/pages/SeguimientoPage.jsx`, reemplazar:

```jsx
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Seguimiento de indicadores</h1>
      </div>

      <Tabs defaultValue="inactividad">
```

por:

```jsx
  return (
    <Tabs defaultValue="inactividad">
```

y al final del archivo quitar el `</div>` de cierre que quedó huérfano, dejando `</Tabs>` como
último elemento del `return`. El contenedor y el `<h1>` pasan a `App.jsx`.

- [ ] **Step 4: Mover el layout a `App.jsx` y agregar la nav**

Reemplazar `frontend/src/App.jsx` entero por:

```jsx
import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import SeguimientoPage from '@/pages/SeguimientoPage'
import ActividadPage from '@/pages/ActividadPage'

/**
 * Dos secciones, con estado local en vez de `react-router`.
 *
 * Es una app de una sola pantalla que se sirve bajo `/rrhh/seguimiento/`; sumar un router
 * obligaría a tocar el `base` de Vite y el fallback de Caddy, que hoy funcionan. El costo
 * aceptado es que no hay link directo a la sección — si algún día hace falta compartir uno,
 * ESE es el momento de traer el router, no antes.
 */
const SECCIONES = [
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'actividad', label: 'Registro de actividad' },
]

export default function App() {
  const [seccion, setSeccion] = useState('seguimiento')

  return (
    <QueryClientProvider client={queryClient}>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Seguimiento de indicadores</h1>
          <div className="flex gap-2">
            {SECCIONES.map((s) => (
              <Button
                key={s.id}
                size="touch"
                variant={seccion === s.id ? 'default' : 'outline'}
                className="px-3 text-sm sm:h-9"
                onClick={() => setSeccion(s.id)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Las 5 pestañas se mantienen montadas: desmontarlas tiraría el filtro que quien
            trabaja tenía puesto cada vez que va a mirar el registro y vuelve. */}
        <div hidden={seccion !== 'seguimiento'}>
          <SeguimientoPage />
        </div>
        {seccion === 'actividad' && <ActividadPage />}
      </div>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 5: Verificar que compila y que la nav funciona**

```powershell
cd C:\temp\RRHH\Lab\seguimiento_app\frontend
npm run build
```

Esperado: build sin errores. Después `npm run dev`, abrir `http://localhost:5174/`, y
confirmar a mano: las 5 pestañas siguen ahí y funcionando, el botón "Registro de actividad"
muestra el encabezado nuevo, y volver a "Seguimiento" **conserva el filtro** que se había
puesto en una pestaña.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.jsx frontend/src/pages/SeguimientoPage.jsx frontend/src/pages/ActividadPage.jsx frontend/src/api/actividad.js
git commit -m "Separar Seguimiento y Registro de actividad en dos secciones"
```

---

## Task 5: La lista con sus filtros

**Files:**
- Create: `frontend/src/hooks/useActividadState.js`,
  `frontend/src/components/actividad/TablaActividad.jsx`
- Modify: `frontend/src/pages/ActividadPage.jsx`

**Interfaces:**
- Consumes: `getActividad`, `getRegistradores` (Task 4); `GET /actividad` (Task 2).
- Produces: `useActividadState()` devolviendo
  `{ desde, setDesde, hasta, setHasta, registradoPor, setRegistradoPor, q, setQ,
     page, setPage, pageSize, items, total, registradores, isLoading, isError, error,
     refetch, detalle, setDetalle, filtros }`
  (`filtros` es el objeto `{desde, hasta, registrado_por, q}` que la Task 7 le pasa al export)

- [ ] **Step 1: Crear el hook**

Crear `frontend/src/hooks/useActividadState.js`:

```js
import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { getActividad, getRegistradores } from '@/api/actividad'
import { hoyLocal } from '@/lib/format'

const PAGE_SIZE = 25

/** `yyyy-MM-dd` de hace N días, en hora local — para prellenar el `<input type="date">`. */
function haceDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Estado de la pantalla de Registro de actividad.
 *
 * ⚠️ NO reusa `useAlertaListState` a propósito: ese hook filtra, ordena y pagina EN EL
 * CLIENTE sobre un array completo (`filtradas.slice(...)`), y esta lista pagina en el
 * servidor. Doblarlo para soportar los dos modos lo volvería condicional en todos lados y
 * pondría en riesgo las 5 pestañas que hoy funcionan.
 *
 * Abre en los últimos 30 días: con el rango vacío la vista arranca trayendo todo, y eso
 * deja de leerse el día que la tabla tenga miles de filas.
 */
export function useActividadState() {
  const [desde, setDesdeInterno] = useState(() => haceDias(30))
  const [hasta, setHastaInterno] = useState(() => hoyLocal())
  const [registradoPor, setRegistradoPorInterno] = useState('')
  const [q, setQInterno] = useState('')
  const [page, setPage] = useState(1)
  const [detalle, setDetalle] = useState(null)

  const qDebounced = useDebounce(q, 300)

  const filtros = {
    desde: desde || undefined,
    hasta: hasta || undefined,
    registrado_por: registradoPor || undefined,
    q: qDebounced || undefined,
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['actividad', filtros, page],
    queryFn: () => getActividad({ ...filtros, pagina: page, por_pagina: PAGE_SIZE }).then((r) => r.data),
    // Sin esto la tabla se vacía y "salta" en cada cambio de página, porque cada página es
    // una queryKey distinta.
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  // Sin filtros: si respetara el rango, mover las fechas vaciaría el select y dejaría a
  // quien busca sin poder elegir a nadie. Es el mismo criterio que el endpoint.
  const { data: registradores = [] } = useQuery({
    queryKey: ['actividad', 'registradores'],
    queryFn: () => getRegistradores().then((r) => r.data),
    staleTime: 60_000,
  })

  // Todo cambio de filtro vuelve a la página 1: quedarse en la 4 de un resultado que ahora
  // tiene 2 páginas muestra una lista vacía que parece un error.
  const conReset = (setter) => (valor) => {
    setter(valor)
    setPage(1)
  }

  return {
    desde, setDesde: conReset(setDesdeInterno),
    hasta, setHasta: conReset(setHastaInterno),
    registradoPor, setRegistradoPor: conReset(setRegistradoPorInterno),
    q, setQ: conReset(setQInterno),
    page, setPage, pageSize: PAGE_SIZE,
    items: data?.items ?? [],
    total: data?.total ?? 0,
    registradores,
    isLoading, isError, error, refetch,
    detalle, setDetalle,
    filtros,
  }
}
```

- [ ] **Step 2: Crear la tabla**

Crear `frontend/src/components/actividad/TablaActividad.jsx`:

```jsx
import { MessageCircle, PhoneCall, Users, User, CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { fmtFechaHora } from '@/lib/format'
import { RESULTADO_LABEL_CORTO, RESULTADO_VARIANT, FUENTE_LABEL } from '@/lib/contacto'

const TIPO = {
  AFILIADOR: { label: 'Afiliador', icono: User, variant: 'secondary' },
  SUPERVISOR: { label: 'Supervisor', icono: Users, variant: 'outline' },
  DISPONIBILIDAD: { label: 'Disponibilidad', icono: CalendarClock, variant: 'amber' },
}

const MEDIO_ICON = { WHATSAPP: MessageCircle, LLAMADA: PhoneCall }

/** La clave estable de una fila: `id_registro` NO es único entre tipos (el de
 *  DISPONIBILIDAD es un id_empleado, porque esa tabla no tiene id propio). */
export const claveFila = (f) => `${f.tipo}-${f.id_registro}`

function CeldaTipo({ fila }) {
  const t = TIPO[fila.tipo] ?? { label: fila.tipo, icono: User, variant: 'secondary' }
  const Icono = t.icono
  return (
    <Badge variant={t.variant}>
      <Icono />
      {t.label}
    </Badge>
  )
}

function CeldaResultado({ fila }) {
  if (!fila.resultado) return <span className="text-xs text-muted-foreground">—</span>
  const IconoMedio = MEDIO_ICON[fila.medio]
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={RESULTADO_VARIANT[fila.resultado] ?? 'secondary'}>
        {RESULTADO_LABEL_CORTO[fila.resultado] ?? fila.resultado}
      </Badge>
      {IconoMedio && <IconoMedio className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </div>
  )
}

/**
 * Dos vistas del mismo dato elegidas por CSS y no por JS, igual que `TablaAlertas`: así no
 * parpadea en la primera pintura ni depende de `matchMedia`.
 */
export default function TablaActividad({ items, onVerDetalle }) {
  const vacio = items.length === 0
  const mensajeVacio = 'No hay registros en este período. Probá ampliando el rango de fechas.'

  return (
    <div className="space-y-2">
      {/* Teléfono: una tarjeta por registro */}
      <div className="space-y-2 md:hidden">
        {vacio && (
          <p className="border rounded-xl py-8 text-center text-sm text-muted-foreground">
            {mensajeVacio}
          </p>
        )}
        {items.map((f) => (
          <button
            key={claveFila(f)}
            type="button"
            onClick={() => onVerDetalle(f)}
            className="w-full text-left rounded-xl border bg-background p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <CeldaTipo fila={f} />
              <span className="text-xs text-muted-foreground tabular-nums">
                {fmtFechaHora(f.fecha)}
              </span>
            </div>
            <div>
              <div className="font-medium text-[15px] leading-tight text-pretty">
                {f.sujeto_nombre ?? '(sin nombre)'}
              </div>
              {f.sujeto_ci && (
                <div className="text-xs text-muted-foreground font-mono tabular-nums">{f.sujeto_ci}</div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <CeldaResultado fila={f} />
              <span className="text-xs text-muted-foreground">
                {f.indicador ? FUENTE_LABEL[f.indicador] ?? f.indicador : ''}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {f.registrado_por ? `Registró: ${f.registrado_por}` : 'Sin registrar quién'}
            </div>
          </button>
        ))}
      </div>

      {/* Escritorio: la tabla */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Persona / supervisor</TableHead>
              <TableHead>Indicador</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Quién registró</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vacio && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {mensajeVacio}
                </TableCell>
              </TableRow>
            )}
            {items.map((f) => (
              <TableRow key={claveFila(f)}>
                <TableCell className="text-sm tabular-nums whitespace-nowrap">
                  {fmtFechaHora(f.fecha)}
                </TableCell>
                <TableCell><CeldaTipo fila={f} /></TableCell>
                <TableCell>
                  <div className="font-medium">{f.sujeto_nombre ?? '(sin nombre)'}</div>
                  {f.sujeto_ci && (
                    <div className="text-xs text-muted-foreground font-mono tabular-nums">{f.sujeto_ci}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {f.indicador ? FUENTE_LABEL[f.indicador] ?? f.indicador : '—'}
                </TableCell>
                <TableCell><CeldaResultado fila={f} /></TableCell>
                <TableCell className="text-sm">{f.registrado_por ?? '—'}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => onVerDetalle(f)}>
                    Detalle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Armar la página con filtros, tabla y paginación**

Reemplazar el cuerpo de `frontend/src/pages/ActividadPage.jsx` (manteniendo el docstring del
componente que ya tiene):

```jsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SelectField from '@/components/ui/select-field'
import PaginationBar from '@/components/ui/pagination-bar'
import EstadoLista from '@/components/ui/estado-lista'
import TablaActividad from '@/components/actividad/TablaActividad'
import { useActividadState } from '@/hooks/useActividadState'

// El Select no admite value="" como item, así que "todos" necesita un centinela — mismo
// recurso que ya usa SeguimientoPage.
const TODOS = '__todos__'

export default function ActividadPage() {
  const s = useActividadState()

  const itemsRegistradores = [
    { value: TODOS, label: 'Quién registró: todos' },
    ...s.registradores.map((r) => ({
      value: r.registrado_por,
      label: `${r.registrado_por} (${r.cantidad})`,
    })),
  ]

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Registro de actividad</h2>
        <p className="text-sm text-muted-foreground">
          Contactos a afiliadores y a supervisores, y disponibilidades confirmadas, en orden
          cronológico.
        </p>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="desde" className="text-xs text-muted-foreground">Desde</Label>
            <Input id="desde" type="date" value={s.desde}
              onChange={(e) => s.setDesde(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hasta" className="text-xs text-muted-foreground">Hasta</Label>
            <Input id="hasta" type="date" value={s.hasta}
              onChange={(e) => s.setHasta(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Quién registró</Label>
            <SelectField
              value={s.registradoPor || TODOS}
              onValueChange={(v) => s.setRegistradoPor(v === TODOS ? '' : v)}
              items={itemsRegistradores}
              triggerClassName="w-full sm:w-56"
            />
          </div>
        </div>
        <Input
          value={s.q}
          onChange={(e) => s.setQ(e.target.value)}
          placeholder="Buscar por nombre o CI…"
          className="w-full sm:max-w-sm"
        />
      </div>

      {s.isError ? (
        <EstadoLista error={s.error} onReintentar={s.refetch} />
      ) : s.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <TablaActividad items={s.items} onVerDetalle={s.setDetalle} />
          <PaginationBar page={s.page} pageSize={s.pageSize} total={s.total} onPageChange={s.setPage} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verificar**

```powershell
cd C:\temp\RRHH\Lab\seguimiento_app\frontend
npm run build
```

Con `npm run dev` y el backend arriba, comprobar a mano:
- La lista trae filas y el contador de `PaginationBar` coincide con el `total` de
  `GET /actividad` en la pestaña de red.
- Elegir a alguien en "Quién registró" deja sólo sus filas y el conteo coincide con el
  número que muestra el select.
- Cambiar de página no vacía la tabla (no debe parpadear).
- Cambiar un filtro estando en la página 3 vuelve a la 1.
- Poner "Desde" en el futuro muestra el mensaje de lista vacía, no un error.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useActividadState.js frontend/src/components/actividad/TablaActividad.jsx frontend/src/pages/ActividadPage.jsx
git commit -m "Listar la actividad con filtros de fecha, registrador y persona"
```

---

## Task 6: El detalle de un registro

**Files:**
- Create: `frontend/src/components/actividad/DetalleActividadDialog.jsx`
- Modify: `frontend/src/lib/disponibilidad.js`, `frontend/src/pages/ActividadPage.jsx`

**Interfaces:**
- Consumes: `s.detalle` / `s.setDetalle` del hook (Task 5); la fila cruda de `GET /actividad`.
- Produces: `<DetalleActividadDialog fila={...} onClose={...} />` y
  `DISPONIBILIDAD_LABEL` (mapa `código -> etiqueta`) en `lib/disponibilidad.js`

- [ ] **Step 1: Exponer el mapa de etiquetas de disponibilidad**

`lib/disponibilidad.js` exporta hoy `DISPONIBILIDADES` (un array de `{value, label}` para el
select), `ORIGEN_LABEL` y `DISPONIBILIDAD_VARIANT`, pero **no** un mapa código → etiqueta, que
es lo que necesita el diálogo. Agregarlo **derivado del array**, no escrito a mano — así
agregar una disponibilidad sigue siendo un solo cambio:

```js
/** `código -> etiqueta`, derivado de DISPONIBILIDADES para que no puedan divergir. */
export const DISPONIBILIDAD_LABEL = Object.fromEntries(
  DISPONIBILIDADES.map((d) => [d.value, d.label]),
)
```

- [ ] **Step 2: Crear el diálogo**

Crear `frontend/src/components/actividad/DetalleActividadDialog.jsx`:

```jsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { fmtFechaHora, fmtFechaCorta } from '@/lib/format'
import { RESULTADO_LABEL, RESULTADO_VARIANT, FUENTE_LABEL } from '@/lib/contacto'
import { DISPONIBILIDAD_LABEL } from '@/lib/disponibilidad'

const MOTIVO_LABEL = {
  SALUD: 'Salud',
  PERSONAL_FAMILIAR: 'Personal/familiar',
  OTRO_TRABAJO: 'Consiguió otro trabajo',
  NO_LE_GUSTA_TURNO: 'No le gusta el turno/proyecto',
  PAGO_COMISIONES: 'Pago/comisiones',
  DIFICULTAD_SISTEMA: 'Dificultad con el sistema',
  SIN_MOTIVO_CLARO: 'Sin motivo claro',
  OTRO: 'Otro',
}

const TITULO = {
  AFILIADOR: 'Contacto al afiliador',
  SUPERVISOR: 'Contacto al supervisor',
  DISPONIBILIDAD: 'Disponibilidad confirmada',
}

function Campo({ label, children }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <p className="text-sm">
      <span className="font-medium">{label}:</span> {children}
    </p>
  )
}

/**
 * El detalle completo de un registro de la línea de tiempo.
 *
 * La lista muestra sólo las columnas comunes a los 3 tipos; lo específico de cada uno vive
 * en `detalle` (un JSONB armado por `actividad_service`) y se despliega acá.
 */
export default function DetalleActividadDialog({ fila, onClose }) {
  if (!fila) return null
  const d = fila.detalle ?? {}
  const afiliadores = d.afiliadores ?? []

  return (
    <Dialog open={!!fila} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="text-lg font-bold">
            {TITULO[fila.tipo] ?? fila.tipo}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {fila.sujeto_nombre ?? '(sin nombre)'}
            {fila.sujeto_ci ? ` · CI ${fila.sujeto_ci}` : ''}
          </p>
        </DialogHeader>

        <div className="space-y-2 max-h-96 overflow-y-auto py-1">
          <div className="flex items-center justify-between gap-2">
            {fila.resultado ? (
              <Badge variant={RESULTADO_VARIANT[fila.resultado] ?? 'secondary'}>
                {RESULTADO_LABEL[fila.resultado] ?? fila.resultado}
              </Badge>
            ) : <span />}
            <span className="text-xs text-muted-foreground tabular-nums">
              {fmtFechaHora(fila.fecha)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {fila.indicador ? FUENTE_LABEL[fila.indicador] ?? fila.indicador : 'Sin indicador'}
            {fila.registrado_por ? ` · registró: ${fila.registrado_por}` : ''}
          </p>

          <Campo label="Medio">{fila.medio}</Campo>
          <Campo label="Motivo">{MOTIVO_LABEL[d.motivo_bajo_rendimiento] ?? d.motivo_bajo_rendimiento}</Campo>
          <Campo label="Disponibilidad">{DISPONIBILIDAD_LABEL[d.disponibilidad] ?? d.disponibilidad}</Campo>
          <Campo label="Próxima acción">{d.proxima_accion}</Campo>
          <Campo label="Próximo seguimiento">
            {d.fecha_proximo_seguimiento ? fmtFechaCorta(d.fecha_proximo_seguimiento) : null}
          </Campo>
          {d.notas && <p className="text-sm text-muted-foreground">{d.notas}</p>}

          {/* La lista congelada del contacto al supervisor. Sale del snapshot y no de la
              alerta de hoy: la métrica que motivó el mensaje ya no existe al día siguiente,
              porque la alerta se recalcula. */}
          {afiliadores.length > 0 && (
            <div className="border-t pt-2 space-y-1">
              <p className="text-sm font-medium">
                Se le habló de {afiliadores.length} persona{afiliadores.length === 1 ? '' : 's'}:
              </p>
              <ul className="space-y-0.5">
                {afiliadores.map((a) => (
                  <li key={a.id_empleado} className="text-sm text-muted-foreground">
                    {a.nombre ?? a.id_empleado}
                    {a.metrica ? ` — ${a.metrica}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Enchufarlo en la página**

En `ActividadPage.jsx`, agregar el import y, antes del `</div>` final del componente:

```jsx
      <DetalleActividadDialog fila={s.detalle} onClose={() => s.setDetalle(null)} />
```

- [ ] **Step 4: Verificar**

```powershell
npm run build
```

A mano, con datos de los 3 tipos en dev: abrir el detalle de un contacto a afiliador (tiene
que mostrar motivo y notas), de uno a supervisor (la lista de afiliadores con su métrica) y
de una disponibilidad (la etiqueta, sin resultado ni medio). Cerrar con Escape y con el
click afuera.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/disponibilidad.js frontend/src/components/actividad/DetalleActividadDialog.jsx frontend/src/pages/ActividadPage.jsx
git commit -m "Mostrar el detalle completo de cada registro de actividad"
```

---

## Task 7: El botón de exportar

**Files:**
- Create: `frontend/src/lib/download.js`, `frontend/src/hooks/useExportarXlsx.js`,
  `frontend/src/components/ui/aviso-export.jsx`
- Modify: `frontend/src/pages/ActividadPage.jsx`

**Interfaces:**
- Consumes: `getActividadXlsx` (Task 4), `s.filtros` (Task 5), `GET /actividad/export.xlsx` (Task 3).
- Produces: `descargarBlob(blob, nombre)`, `nombreDesdeContentDisposition(headers, porDefecto)`,
  `useExportarXlsx({ nombrePorDefecto, etiqueta })` → `{ exportar, exportando, aviso, limpiarAviso }`,
  `<AvisoExport mensaje onCerrar />`

- [ ] **Step 1: Copiar los 3 archivos de `rrhh-app`**

Copiar **tal cual**, sólo adaptando los docstrings que hablan de la planilla y de UC-16 (que
no aplican a esta app):

| Origen | Destino |
|---|---|
| `rrhh-app/frontend/src/lib/download.js` | `frontend/src/lib/download.js` |
| `rrhh-app/frontend/src/hooks/useExportarXlsx.js` | `frontend/src/hooks/useExportarXlsx.js` |
| `rrhh-app/frontend/src/components/ui/aviso-export.jsx` | `frontend/src/components/ui/aviso-export.jsx` |

Lo que **no** hay que tocar:

- El `URL.revokeObjectURL` de `download.js`: cada `createObjectURL` retiene el blob en memoria
  del navegador hasta que se navega fuera; en una SPA que nunca recarga, exportar diez veces
  deja diez copias retenidas.
- La comparación `exportadas < disponibles` de `useExportarXlsx`: es la razón de existir del
  hook.
- El `nombreDesdeContentDisposition`: el sello de tiempo lo pone el backend a propósito, para
  que el reloj del navegador no decida cómo se llama el archivo.

- [ ] **Step 2: Agregar el botón a la página**

En `ActividadPage.jsx`:

```jsx
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import AvisoExport from '@/components/ui/aviso-export'
import useExportarXlsx from '@/hooks/useExportarXlsx'
import { getActividadXlsx } from '@/api/actividad'
```

Dentro del componente, después de `const s = useActividadState()`:

```jsx
  const xlsx = useExportarXlsx({ nombrePorDefecto: 'actividad.xlsx', etiqueta: 'registros' })
```

Y en el bloque de filtros, después del buscador:

```jsx
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="touch"
            className="sm:h-9"
            disabled={xlsx.exportando || !s.total}
            onClick={() => xlsx.exportar(() => getActividadXlsx(s.filtros))}
          >
            <Download className="h-4 w-4" />
            {xlsx.exportando ? 'Generando…' : 'Exportar a Excel'}
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {s.total} registro{s.total === 1 ? '' : 's'}
          </span>
        </div>
        <AvisoExport mensaje={xlsx.aviso} onCerrar={xlsx.limpiarAviso} />
```

Nota: se le pasa `s.filtros` y **no** `page`/`pageSize` — el archivo lleva el resultado del
filtro, no la página que se está viendo.

- [ ] **Step 3: Verificar**

```powershell
npm run build
```

A mano: exportar sin filtros y confirmar que el archivo baja, abre en Excel, y tiene las 15
columnas con la fila de encabezado congelada. Después filtrar por una persona y confirmar que
el archivo trae **sólo** esas filas. Verificar que el botón queda deshabilitado cuando el
filtro no devuelve nada.

Para probar el aviso de recorte: bajar `LIMITE_EXPORT` del backend a `2`, reiniciar, exportar,
confirmar que aparece el cartel ámbar diciendo cuántas de cuántas salieron, y **volver a
dejarlo en 5000**.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/download.js frontend/src/hooks/useExportarXlsx.js frontend/src/components/ui/aviso-export.jsx frontend/src/pages/ActividadPage.jsx
git commit -m "Exportar el registro de actividad filtrado a Excel"
```

---

## Task 8: Verificación end-to-end y documentación

**Files:**
- Modify: `CLAUDE.md`
- Verify: los 3 scripts de las tasks 1-3, corridos de nuevo

- [ ] **Step 1: Re-correr las 3 verificaciones**

```powershell
& $PY $SCRATCH\verificar_task1.py
& $PY $SCRATCH\verificar_task2.py
& $PY $SCRATCH\verificar_task3.py
```

Las tres tienen que dar `FALLOS: ninguno`. Si alguna se rompió durante el frontend, ese es el
momento de descubrirlo.

- [ ] **Step 2: Verificar que no se rompió nada de lo anterior**

Las 4 rutas de alerta tienen que seguir devolviendo **exactamente la misma cantidad de filas**
que antes de esta entrega — el spec no toca ninguna de sus queries, así que cualquier cambio
es un bug:

```powershell
foreach ($r in "inactividad","turnos","reincidencia","produccion-mtd") {
  $n = (Invoke-RestMethod "http://127.0.0.1:8010/alertas/$r").Count
  Write-Host "$r : $n"
}
```

Y en el navegador: las 5 pestañas de Seguimiento siguen funcionando, se puede registrar una
llamada, y esa llamada **aparece en el Registro de actividad** al recargar (la prueba de que
las dos mitades hablan del mismo dato). Borrar la fila de prueba después.

- [ ] **Step 3: Borrar las filas de prueba**

Cualquier fila insertada durante las tasks 1-7 se borra ahora, con `bex_ingeniero` y
`RRHH_PG_PASSWORD`, igual que en las entregas anteriores. Confirmar con un `COUNT(*)` que las
3 tablas quedaron como estaban.

- [ ] **Step 4: Documentar en `CLAUDE.md`**

Agregar una sección `## Registro de actividad: la consulta del movimiento (2026-09-07)` antes
de `## Migraciones aplicadas en rrhh_bd (producción)`, cubriendo:

- El pedido y por qué no existía (sólo había historial por persona).
- La decisión de la línea de tiempo unificada y de los 3 filtros, con lo que se dejó afuera.
- ⚠️ Que `useActividadState` **no** reusa `useAlertaListState` y por qué (cliente vs. servidor)
  — es exactamente el tipo de "esto parece duplicado, unifiquémoslo" que alguien va a
  proponer en seis meses.
- ⚠️ Que `registrado_por` es texto libre y el select muestra los valores sin normalizar.
- ⚠️ Que `seguimiento_disponibilidad` no tiene historial, así que su rama muestra la última
  confirmación de cada persona, no una secuencia.
- ⚠️ Que `openpyxl` está pineado en `3.1.5` por el venv compartido del servidor.
- Que **no hubo migraciones** — la primera entrega de esta app que no toca el esquema.
- Qué se verificó y contra qué base.

Actualizar además la tabla de endpoints de la sección "Backend — qué endpoint hace qué" con
las 3 rutas nuevas.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "Documentar el registro de actividad y su export a Excel"
```

---

## Fuera de alcance de este plan

El despliegue a producción (`deploy-backend.ps1` + `deploy-frontend.ps1`) **no** es una tarea
de este plan: es una acción sobre un servidor compartido y se hace con confirmación explícita
del usuario, como todas las anteriores. Cuando se haga, el orden es backend primero (que
instala `openpyxl` en el venv compartido) y frontend después, y hay que verificar que
`sistema-personal` y `vetados` siguen respondiendo — comparten el venv.
