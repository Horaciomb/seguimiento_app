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
# "Proyecto", igual que lo arma la pantalla de Seguimiento: el CÓDIGO de la unidad y, sólo
# si la campaña difiere, `UNIDAD / CAMPANA` (`YAPE`, `ZAS`, `BNB / BILLE`).
#
# ⚠️ `codigo` y NO `nombre`: las 3 vistas de Lab 001 exponen el código, así que joinear el
# nombre daría "YAPE - Afiliaciones QR BCP Bolivia / YAPE - Afiliaciones QR BCP" — largo,
# redundante y DISTINTO de lo que la otra pantalla viene mostrando para la misma persona.
_PROYECTO = """
           CASE WHEN {un}.codigo IS NULL THEN NULL
                WHEN {ca}.codigo IS NOT NULL AND {ca}.codigo <> {un}.codigo
                     THEN {un}.codigo || ' / ' || {ca}.codigo
                ELSE {un}.codigo END
"""

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
""" + _PROYECTO.format(un="un", ca="ca") + """ AS proyecto,
           jsonb_build_object(
               'motivo_bajo_rendimiento',   sl.motivo_bajo_rendimiento,
               'proxima_accion',            sl.proxima_accion,
               'fecha_proximo_seguimiento', sl.fecha_proximo_seguimiento,
               'notas',                     sl.notas
           ) AS detalle
    FROM seguimiento_llamada sl
    LEFT JOIN empleado_unidad eu ON eu.id_empleado = sl.id_empleado
    LEFT JOIN persona p          ON p.id_persona   = eu.id_persona
    LEFT JOIN unidad_negocio un  ON un.id_unidad_negocio = eu.id_unidad_negocio
    LEFT JOIN campana ca         ON ca.id_campana        = eu.id_campana

    UNION ALL

    -- El nombre sale del snapshot desnormalizado, NO del join: si en Lab 001 le corrigen el
    -- nombre al supervisor, el historial tiene que seguir diciendo a quién se contactó.
    -- El join a `persona` es sólo para el CI.
    SELECT 'SUPERVISOR'::varchar, scs.id, scs.fecha_contacto, scs.registrado_por,
           scs.id_persona_supervisor, scs.supervisor_nombre, ps.ci,
           scs.fuente, scs.resultado, scs.medio_contacto,
           sp.proyecto,
           jsonb_build_object(
               'cantidad_afiliadores',      scs.cantidad_afiliadores,
               'afiliadores',               scs.afiliadores,
               'proxima_accion',            scs.proxima_accion,
               'fecha_proximo_seguimiento', scs.fecha_proximo_seguimiento,
               'notas',                     scs.notas
           )
    FROM seguimiento_contacto_supervisor scs
    LEFT JOIN persona ps ON ps.id_persona = scs.id_persona_supervisor
    -- El proyecto de un contacto a supervisor sale de SU GENTE, no de él: el mensaje habla
    -- de N afiliadores, que pueden ser de proyectos distintos ("YAPE, ZAS" si se mezclaron).
    --
    -- ⚠️ Decisión del usuario (2026-09-11) sabiendo el costo: esto resuelve el proyecto de
    -- HOY de cada afiliador, no el que tenía el día del contacto. Es el único campo de esta
    -- rama que NO queda congelado — `nombre` y `metrica` sí salen del snapshot. Si alguien
    -- cambia de proyecto, el historial de supervisores se relee distinto.
    --
    -- El DISTINCT va en un subselect y no en el `string_agg`: Postgres sólo admite
    -- `ORDER BY` sobre la misma expresión del DISTINCT dentro de un agregado.
    LEFT JOIN LATERAL (
        SELECT string_agg(p, ', ' ORDER BY p) AS proyecto
        FROM (
            SELECT DISTINCT
""" + _PROYECTO.format(un="un2", ca="ca2") + """ AS p
            FROM jsonb_array_elements(scs.afiliadores) a
            JOIN empleado_unidad eu2     ON eu2.id_empleado       = (a->>'id_empleado')::bigint
            LEFT JOIN unidad_negocio un2 ON un2.id_unidad_negocio = eu2.id_unidad_negocio
            LEFT JOIN campana ca2        ON ca2.id_campana        = eu2.id_campana
        ) d
        WHERE p IS NOT NULL
    ) sp ON TRUE

    UNION ALL

    -- `seguimiento_disponibilidad` es una fila POR EMPLEADO (estado actual, no historial):
    -- esta rama muestra la ÚLTIMA confirmación de cada persona, no la secuencia de cambios.
    -- Por eso `id_registro` es el id_empleado y no un id propio: la tabla no tiene uno.
    SELECT 'DISPONIBILIDAD'::varchar, sd.id_empleado, sd.fecha_actualizacion, sd.registrado_por,
           sd.id_empleado,
           NULLIF(TRIM(CONCAT_WS(' ', p2.nombres, p2.apellido_paterno, p2.apellido_materno)), ''),
           p2.ci,
           NULL::varchar, NULL::varchar, NULL::varchar,
""" + _PROYECTO.format(un="un3", ca="ca3") + """,
           jsonb_build_object('disponibilidad', sd.disponibilidad)
    FROM seguimiento_disponibilidad sd
    LEFT JOIN empleado_unidad eu3 ON eu3.id_empleado = sd.id_empleado
    LEFT JOIN persona p2          ON p2.id_persona   = eu3.id_persona
    LEFT JOIN unidad_negocio un3  ON un3.id_unidad_negocio = eu3.id_unidad_negocio
    LEFT JOIN campana ca3         ON ca3.id_campana        = eu3.id_campana
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
