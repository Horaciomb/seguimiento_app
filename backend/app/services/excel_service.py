"""Generación de archivos Excel (.xlsx).

Copiado de `rrhh-app/backend/app/services/excel_service.py`, mismo criterio con el que se
copió todo `components/ui/` del frontend: el patrón ya está probado ahí y sus dos detalles
finos ya costaron un error una vez.

Genérico a propósito —recibe `(encabezado, extractor)` y filas, no sabe nada de actividad—
para que el router decida qué columnas salen.
"""
from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Any, Callable, Sequence

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

# Ancho máximo de columna, en caracteres. Sin techo, una observación larga produce una columna
# de 500 caracteres que hace ilegible toda la hoja.
ANCHO_MAXIMO = 60
ANCHO_MINIMO = 10

# UTC-4 FIJO. Bolivia no tiene horario de verano, no hace falta una base de husos.
# 🔴 NO se usa el offset del servidor: eso ata el contenido del archivo a donde corra el
# proceso, y el dia que se despliegue en otro lado las fechas se corren sin que nadie lo note.
_HUSO_BOLIVIA = timezone(timedelta(hours=-4))

_CABECERA_FONDO = PatternFill("solid", fgColor="1F2937")
_CABECERA_FUENTE = Font(color="FFFFFF", bold=True)


def _texto(valor: Any) -> Any:
    """Normaliza un valor para que Excel lo muestre como corresponde.

    - `None` -> celda vacía, no el string "None".
    - `bool`  -> "Sí"/"No": Excel muestra TRUE/FALSE en inglés y el archivo lo lee gente que
      no tiene por qué leer inglés.
    - `list`  -> unido con " · ", igual que en pantalla (los horarios de entrevista).
    - `datetime` con tz -> naive. **Excel no soporta datetimes con zona horaria** y openpyxl
      lanza `ValueError: Excel does not support timezones in datetimes`. Se convierte a hora
      local de Bolivia (UTC-4) antes de sacarle el tzinfo, porque mostrar el UTC correría
      todas las fechas 4 horas y a la medianoche cambiaría el día.
    """
    if valor is None:
        return None
    if isinstance(valor, bool):
        return "Sí" if valor else "No"
    if isinstance(valor, list):
        return " · ".join(str(v) for v in valor) if valor else None
    if isinstance(valor, datetime) and valor.tzinfo is not None:
        return valor.astimezone(_HUSO_BOLIVIA).replace(tzinfo=None)
    return valor


def construir_xlsx(
    *,
    titulo_hoja: str,
    columnas: Sequence[tuple[str, Callable[[Any], Any]]],
    filas: Sequence[Any],
) -> BytesIO:
    """Arma un .xlsx en memoria y devuelve el buffer listo para `StreamingResponse`.

    `columnas` es una lista de `(encabezado, extractor)`. El extractor recibe la fila y
    devuelve el valor crudo; `_texto` se encarga de normalizarlo. Se pasa como lista de tuplas
    y no como dict para que **el orden de las columnas sea explícito** y no dependa del orden
    de inserción de un diccionario.

    Escribe en memoria y no a un archivo temporal a propósito: los datasets que exporta esta
    app están topados y caben holgadamente; un temporal agregaría limpieza y permisos de disco
    en el servidor a cambio de nada.
    """
    wb = Workbook()
    ws = wb.active
    # Excel corta los nombres de hoja en 31 caracteres y prohíbe : \\ / ? * [ ]
    ws.title = titulo_hoja[:31]

    encabezados = [c[0] for c in columnas]
    ws.append(encabezados)
    for celda in ws[1]:
        celda.fill = _CABECERA_FONDO
        celda.font = _CABECERA_FUENTE
        celda.alignment = Alignment(vertical="center")

    for fila in filas:
        ws.append([_texto(extraer(fila)) for _, extraer in columnas])

    # Ancho por contenido, topado. `len(str(...))` sobre el valor ya normalizado: medir el
    # objeto crudo daría el largo de su `repr`, no el del texto que ve el usuario.
    for i, encabezado in enumerate(encabezados, start=1):
        largos = [len(str(encabezado))]
        for celda in ws[get_column_letter(i)][1:]:
            if celda.value is not None:
                largos.append(len(str(celda.value)))
        ws.column_dimensions[get_column_letter(i)].width = min(
            max(max(largos) + 2, ANCHO_MINIMO), ANCHO_MAXIMO
        )

    # Fila de encabezados congelada: sin esto, en 500 filas se pierde de vista qué es cada
    # columna apenas se hace scroll.
    ws.freeze_panes = "A2"

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
