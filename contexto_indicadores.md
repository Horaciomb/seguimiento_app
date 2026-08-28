# Contexto de los indicadores de control

Referencia técnica de los tres "indicadores de control" del proyecto (inactividad,
cobertura por turno, producción MTD vs. histórico) y el export de reincidencia de
turnos que deriva del segundo. Explica **qué mide cada uno, de qué bases y tablas
sale el dato, cómo se calcula paso a paso, y qué significa cada columna** — es una
referencia atemporal sobre los indicadores en sí, no una bitácora de sesión (eso
vive en `CLAUDE.md`).

Para el detalle de *qué le pidió JP y qué se le entregó* (columnas del Excel,
filtros, orden), ver `CLAUDE.md` — acá el foco es cómo funciona el mecanismo por
dentro.

---

## 0. Lo que los tres indicadores comparten

Antes de entrar a cada uno, cuatro piezas que reaparecen en los tres — están
escritas una sola vez en el código (`14_alerta_inactividad_afiliadores.py`) y las
reusan `15_actividad_por_turno.py` y `18_produccion_mtd_vs_historico.py` importando
las funciones por ruta, justamente para que la lógica delicada (el puente de ZAS,
las salvaguardas de identificador) no se escriba dos veces y termine divergiendo.

### 0.1 La población: quién entra a los tres indicadores

Los tres corren, sin excepción, sobre la misma consulta (`SQL_AFILIADORES` en
`14_alerta_inactividad_afiliadores.py`, función `obtener_afiliadores_activos()`):

```sql
SELECT eu.id_empleado, eu.id_persona, p.ci, nombre_completo, supervisor,
       ciudad, departamento, unidad_negocio, campana,
       COALESCE(cam.id_unidad_negocio, eu.id_unidad_negocio) AS id_unidad_medicion,
       eu.telefono, eu.codigo_bex, eu.fecha_ingreso
  FROM empleado_unidad eu
  JOIN persona p   ON p.id_persona = eu.id_persona
  JOIN cargo   cg  ON cg.id_cargo  = eu.id_cargo
  JOIN unidad_negocio un ...
  LEFT JOIN campana cam ...
 WHERE eu.activo
   AND eu.fecha_baja IS NULL
   AND cg.codigo = 'AFILIADOR'
```

**Los tres miden únicamente al cargo `AFILIADOR`, activo y sin fecha de baja.**
Un supervisor, un líder o un reclutador no entra a ninguno de los tres, aunque
produzca. `id_unidad_medicion` es la unidad **de campaña** si el empleado tiene
campaña asignada (ej. BILLE cuelga de BNB) — es contra esa base de producción que
se mide, no contra la unidad "de papel" del contrato.

`supervisor` sale de `empleado_unidad.id_persona_supervisor` (referencia blanda,
sin FK) con fallback a `'(sin asignar)'` — nunca de `id_usuario_supervisor`, que
está en 0 para toda la población (verificado 2026-08-20).

### 0.2 De dónde sale la producción real: las 4 bases externas

El dato de "quién afilió y cuándo" **no vive en `rrhh_bd`** — vive en las bases de
producción de cada unidad, en `10.0.0.2:5432`:

| Unidad | Base | Tabla(s) que usan estos indicadores |
|---|---|---|
| YAPE | `yape_bd` | `fact_activaciones` (siempre) + `fact_consolidados` / `fact_consolidados_reactivaciones` (sólo el indicador #1, ver 0.4) |
| BNB | `bnb_bd` | `fact_afiliaciones` |
| BILLE | `bille_bd` | `fact_afiliaciones` |
| ZAS | `zas_bd` | `fact_afiliaciones` |

`campana.prod_db` es el dato que dice contra cuál de las cuatro medir cada
campaña — no está hardcodeado en el código (`cargar_campanas()` en
`11_calcular_actividad_afiliacion_pg.py`, reusada por los tres indicadores).
Una campaña sin `prod_db` (ALTOKE) no se mide: es correcto, no un olvido.

### 0.3 Cómo se cruza `empleado_unidad` con la fila de producción

No hay una columna común entre `rrhh_bd` y las 4 bases externas: hay que cruzar
por un identificador de negocio, y **cuál columna usar depende de la unidad**
(`CAMPO_CRUCE` en `11_calcular_actividad_afiliacion_pg.py`):

| Unidad | Columna de `empleado_unidad` | Cómo resuelve |
|---|---|---|
| YAPE / BNB / BILLE | `telefono` | Directo — el campo `codigo_bex` de esas 3 bases en realidad guarda el celular, no un código de negocio |
| ZAS | `codigo_bex` | **Indirecto**, vía puente (ver 0.3.1) |

#### 0.3.1 El puente de ZAS

`empleado_unidad.codigo_bex` para ZAS tiene el formato `ZAS-ZAS-390` (con el
prefijo de unidad duplicado). Ese valor **no** es el que usa
`zas_bd.fact_afiliaciones` — para eso hay que pasar por
`zas_bd.dim_ejecutivo` (función `obtener_bridge_zas()`):

```
'ZAS-ZAS-390'  →  se le saca el 'ZAS-' →  'ZAS-390'
                                            ↓ dim_ejecutivo.id_empleado
                                          'BXLP109'  (codigo_bex real, el que usa fact_afiliaciones)
```

Si el `id_legado` no aparece en el diccionario (`dim_ejecutivo` no lo tiene), el
empleado cae en `SIN MEDICION` con motivo `"codigo_bex no resuelve en
dim_ejecutivo"` — nunca se inventa un cero.

### 0.4 Por qué YAPE es un caso aparte (sólo indicador #1)

`yape_bd.fact_consolidados` **acumula** en vez de ser una tabla de eventos (una
afiliación real puede generar varias filas) y **tarda casi una semana en
completar un día** — mide bien un mes cerrado, pero miente sobre "hoy" o "ayer".
Por eso:

- **Indicador #1** (necesita el dato de ayer, día a día) une
  `fact_consolidados` + `fact_consolidados_reactivaciones` **con**
  `fact_activaciones` (la fuente cruda de JotForm, que sí llega el mismo día),
  deduplicando por `id_unico` / `id_unico_jotform`. Las dos aportan: activaciones
  cruzan el 89,3% de los afiliadores, consolidados el 92,0%, con solapamiento
  del 99%.
- **Indicadores #2 y #3** necesitan **hora exacta** (para saber en qué turno cae
  cada afiliación) — `fact_consolidados` es `DATE`, sin hora. Por eso los dos usan
  **únicamente `fact_activaciones`** para YAPE (`FUENTE_HORARIA` en
  `15_actividad_por_turno.py`, reusada por el #3).

### 0.5 Las dos salvaguardas de identificador (`resolver_identificadores()`)

Antes de contar nada, cada identificador resuelto (teléfono o `codigo_bex`) pasa
por dos chequeos, compartidos por los tres indicadores:

1. **Un identificador no puede pertenecer a dos personas ACTIVAS a la vez.**
   Si dos empleados activos resuelven al mismo valor, **ninguno de los dos** se
   mide — no se puede saber de quién es la venta. Motivo:
   `"identificador '<valor>' compartido por varias personas activas"`.
2. **La misma persona con dos períodos activos y el mismo identificador**
   (reingreso sin cerrar el período anterior). No es ambigüedad —se sabe de
   quién es la venta— pero contarla dos veces (una por cada `id_empleado`)
   infla la producción. Se atribuye al período con `fecha_ingreso` **más
   reciente**; el período viejo queda `SIN MEDICION`, no en cero, para no
   fabricar una alerta de un empleo fantasma. Motivo:
   `"periodo duplicado: ... se atribuye al mas reciente"`.

En los tres indicadores, **`SIN MEDICION` nunca es un cero**: es "no se puede
afirmar nada", y las vistas lo tratan distinto de un 0 real (ver
`.claude/rules/20-trampas-conocidas.md`, sección de identificadores ambiguos).

---

## 1. Indicador #1 — Inactividad diaria de afiliadores

**Qué mide:** al afiliador activo y de alta —con el que la empresa cuenta para
trabajar hoy— que lleva N días **hábiles** sin registrar una sola afiliación.
Existe para que a alguien lo llamen antes de que su inactividad se vuelva una
baja no registrada.

**Naturaleza:** foto. Cada corrida de `--escribir` reemplaza la tabla entera —no
hay serie histórica de "cuántos días estuvo inactivo en julio" (si algún día hace
falta, es otra tabla, a propósito).

**Script:** `03_carga_pg/migration_scripts/14_alerta_inactividad_afiliadores.py`.

### 1.1 Tablas y vista en `rrhh_bd`

| Objeto | Tipo | Rol |
|---|---|---|
| `alerta_inactividad_afiliador` | Tabla, FOTO | La llena `--escribir`. Una fila por afiliador activo (los ~385 de hoy), no sólo los que alertan |
| `alerta_inactividad_notificacion` | Tabla, **persiste** entre corridas | Dedup: guarda hasta qué nivel de urgencia ya se le mostró a JP a cada empleado dentro de su racha vigente. La llena únicamente `--marcar-notificado` |
| `vw_alerta_inactividad` | Vista | Le agrega nombre/supervisor/geografía/`tramo` a la foto |

**`alerta_inactividad_afiliador`** (`schema/19_create_alerta_inactividad.sql`):

| Columna | Significado |
|---|---|
| `id_empleado` | PK, FK a `empleado_unidad` |
| `fecha_ultima_afiliacion` | Última afiliación real observada en la base de producción de su unidad. `NULL` = nunca afilió o no se pudo medir (se distingue por `estado_medicion`, nunca por el `NULL` a secas) |
| `dias_inactividad` | Días **hábiles** (lunes a viernes) entre el ancla (ver 1.2) y ayer. Hoy nunca se cuenta |
| `estado_medicion` | `MEDIDO` · `NUNCA AFILIO` (en desuso desde 2026-08-24, ver 1.2) · `SIN MEDICION` |
| `motivo_sin_medicion` | Texto libre — por qué no se pudo medir (identificador ambiguo, sin identificador, etc.) |
| `identificador_produccion` | El teléfono o `codigo_bex` resuelto, para trazabilidad |
| `fecha_calculo` | Cuándo corrió el script. Única defensa contra una foto congelada (la vista expone `horas_desde_el_calculo`) |

**`alerta_inactividad_notificacion`** (`schema/26_create_alerta_inactividad_notificacion.sql`,
2026-08-26 — la única tabla del proyecto que persiste entre corridas a propósito):

| Columna | Significado |
|---|---|
| `id_empleado` | PK, FK a `empleado_unidad` |
| `fecha_ancla` | La misma ancla que usó `dias_inactividad()` cuando se marcó — identifica la racha vigente |
| `nivel_maximo_notificado` | 1, 2 o 3 (ver la acción sugerida en 1.3) — el más alto ya mostrado dentro de esta racha |
| `fecha_primera_notificacion` | Desde cuándo se lo está llamando por esta racha |
| `fecha_ultima_notificacion` | Último marcado, misma racha o no |

**`vw_alerta_inactividad`** agrega sobre la tabla: `tramo` (ver 1.4), `ciudad`,
`departamento`, `unidad_negocio`, `campana`, `telefono`, `fecha_ingreso`,
`horas_desde_el_calculo`.

### 1.2 El ancla: desde cuándo se cuentan los días

`ancla_mes_vigente()` — el punto de partida se acota al **mes en curso** (regla
de JP, 2026-08-24, para no arrastrar meses de historia en un caso con 157 días):

1. Ingresó a mitad de este mes → cuenta desde su `fecha_ingreso`.
2. Ingresó antes de este mes → cuenta desde el 1° del mes en curso, **nunca
   antes** (aunque su última venta real haya sido hace meses).
3. Ya vendió este mes → cuenta desde esa última venta.

Quien **nunca vendió** cuenta igual que cualquiera (cae en la regla 2 o 1 según
su ingreso) — no es una categoría aparte sin alerta. `fecha_ultima_afiliacion`
en la tabla/vista sigue mostrando la venta real sin acotar, como dato de
contexto; sólo el ancla que entra a `dias_inactividad()` se acota al mes.

Ventana evaluada: `[ancla + 1 día hábil, HOY − 1 día]`. **Hoy nunca se evalúa**
— sólo días cerrados. Una afiliación en sábado o domingo **corta la racha**
aunque esos días no sumen como inactividad (si no, se marcaría inactivo a
quien vendió el fin de semana).

### 1.3 Acción sugerida — `nivel_accion()` / `accion_sugerida()`

Un único corte de días define, a la vez, qué texto mostrar y cuándo hay que
volver a mostrarle la alerta a JP (ver 1.5):

| Días de inactividad | Nivel | Texto |
|---|---|---|
| 3-6 | 1 | "Llamar para hacer seguimiento" |
| 7-14 | 2 | "Llamar para ver si está activo" |
| 15+ | 3 | "Revisar planilla con Encargados" |

### 1.4 `tramo` (sólo en la vista, no en la tabla)

| Tramo | Condición |
|---|---|
| `SIN MEDICION` | `estado_medicion = 'SIN MEDICION'` |
| `REVISAR BAJA` | `dias_inactividad >= 20` |
| `CRITICO` | `dias_inactividad >= 10` |
| `SEGUIMIENTO` | `dias_inactividad >= 3` |
| `AL DIA` | resto (0-2 días) |

### 1.5 El mecanismo de "no repetir llamadas" (`filtrar_para_jp()`, 2026-08-26)

De toda la alerta (`dias_inactividad >= 3`), sólo se le muestra a JP quien:

- **Nunca se le mostró** dentro de esta racha (no hay fila en
  `alerta_inactividad_notificacion` con la misma `fecha_ancla`), o
- **Subió de nivel** desde la última vez que se le mostró (ej. pasó de nivel 1 a
  nivel 2 dentro de la misma racha).

Seguir apareciendo con el mismo nivel, en la misma racha, no genera una nueva
notificación. Si la racha termina (vendió) y vuelve a caer en inactividad más
adelante, el `fecha_ancla` cambia y vuelve a contar como nueva.

`marcar_notificados()` sólo corre con `--marcar-notificado`, y sólo si el Excel
efectivamente se terminó de escribir (si la escritura falla, la excepción se
propaga antes de llegar a esta función — nada se marca como avisado si el
reporte no llegó a ningún lado).

### 1.6 Entrega

`14b_alerta_inactividad_jp.ps1` (PUMA), tarea `RRHH - Alerta inactividad para
JP`: escribe el Excel directo a la carpeta OneDrive de JP y llama
`--marcar-notificado` en la misma corrida. Detalle operativo completo en
`docs/operacion/alerta_inactividad_jp.md`.

---

## 2. Indicador #2 — Cobertura por turno

**Qué mide:** cuánto produce cada afiliador activo en cada uno de los 4 turnos
del día, para detectar carga sospechosa fuera de horario (¿la madrugada de esta
persona es un hábito, o fue una vez?).

**Naturaleza: HISTÓRICA, no una foto** — a diferencia del indicador #1. Es la
única forma de responder la pregunta de arriba; una foto sólo respondería por el
último turno calculado.

**Script:** `03_carga_pg/migration_scripts/15_actividad_por_turno.py`.

### 2.1 Los turnos (fijos, no configurables)

| Turno | Horario |
|---|---|
| MADRUGADA | 00:00 – 07:59 |
| MAÑANA | 08:00 – 12:59 |
| TARDE | 13:00 – 17:59 |
| NOCHE | 18:00 – 23:59 |

Los rangos viven **en el código** (no en una tabla): cambiarlos cambiaría el
significado de toda la serie histórica, así que no es un parámetro que se mueva
sin pensarlo. La hora es **local** en las 4 bases de producción (verificado, no
convertida).

### 2.2 Tablas y vista en `rrhh_bd`

| Objeto | Tipo | Rol |
|---|---|---|
| `actividad_turno_afiliador` | Tabla, **HISTÓRICA** | PK `(id_empleado, fecha, turno)`. La llena `--escribir` |
| `config_umbral_turno` | Tabla | Los umbrales de alerta, por unidad y turno |
| `vw_alerta_turnos` | Vista | Aplica el umbral y calcula `alerta` — el umbral vive en la vista, no en la tabla, así que cambiarlo recolorea toda la historia sin recalcular nada |

**`actividad_turno_afiliador`** (`schema/20_create_actividad_turno.sql`):

| Columna | Significado |
|---|---|
| `id_empleado`, `fecha`, `turno` | Clave primaria compuesta |
| `cantidad` | Afiliaciones de ese empleado en ese turno y fecha |
| `estado_medicion` | `MEDIDO` · `SIN MEDICION` (nunca se guarda `cantidad=0` para quien no se pudo medir — el CHECK `ck_actividad_turno_coherencia` lo impide) |
| `motivo_sin_medicion`, `identificador_produccion`, `fecha_calculo` | Igual que en el indicador #1 |

**`config_umbral_turno`**:

| Columna | Significado |
|---|---|
| `unidad_codigo` | Código de unidad, o `'*'` = default (para que una unidad nueva no quede sin umbral) |
| `turno` | Uno de los 4 |
| `operador` | `<` (alerta por defecto bajo) o `>` (alerta por exceso) |
| `umbral` | El número de corte |
| `nota` | Texto libre — de dónde salió ese número y si es política de negocio o calibración estadística |

Resolución: primero se busca la fila de la unidad específica; si no existe, se
usa la de `'*'`.

**Umbrales vigentes** (política del 2026-08-21, "vara pareja" para las 3
unidades — ver 2.4): NOCHE `>10`, MADRUGADA `>10` en YAPE/BNB/ZAS. MAÑANA `<5`
y TARDE `<5` para todas (`'*'`, sin fila por unidad).

**`vw_alerta_turnos`** agrega: `dia_semana`, `es_dia_habil`, nombre/supervisor/
geografía, `operador` y `umbral` resueltos, y la columna clave:

```sql
alerta = (estado_medicion = 'MEDIDO' AND
          CASE operador WHEN '<' THEN cantidad < umbral
                         WHEN '>' THEN cantidad > umbral END)
```

`SIN MEDICION` **nunca** alerta — no se puede afirmar que alguien no produjo si
no se lo pudo medir.

### 2.3 Fuente de producción

Reusa `FUENTE_HORARIA` (ver 0.4): YAPE sólo `fact_activaciones`; BNB/BILLE/ZAS
`fact_afiliaciones`. El cálculo cuenta, por identificador, las filas de esa
tabla cuya hora cae dentro del rango del turno, para la fecha pedida.

### 2.4 🔴 El problema conocido de MAÑANA/TARDE (sin calibrar)

Con `operador = '<'`, la tasa de alerta tiene como **piso la tasa de ceros** del
grupo. El grano es `(afiliador, día, turno)`, y quien produce 1-5 afiliaciones
por DÍA (la mediana) deja 2 o 3 turnos en cero por construcción — no por mal
desempeño. Con eso, `<5` alerta al **90-95%** de MAÑANA/TARDE, y **no se arregla
moviendo el número**: `<1` alerta a ese piso, `<0` no alerta a nadie, no hay
nada útil en el medio. La solución de fondo (cambiar el grano a "proporción
diurna sobre el total del día de la persona") es código, no un `UPDATE`, y
queda abierta. Detalle completo en `.claude/rules/20-trampas-conocidas.md`.

**Consecuencia práctica (2026-08-28):** la hoja "alerta" del Excel para JP se
acotó a **sólo NOCHE/MADRUGADA** — con los 4 turnos, la alerta alcanzaba a 741
de una posible ~1.544 combinaciones (703 de ellas MAÑANA/TARDE, puro ruido del
umbral sin calibrar). MAÑANA/TARDE siguen en la hoja "detalle" (oculta, sin
filtrar) para quien necesite auditarlas.

🔴 **Bug conocido, sin corregir:** `accion_a_tomar()` da mensajes pensados para
el caso original (MAÑANA/TARDE, `cantidad` 0-4: "Llamada para confirmar
asistencia" / "Llamada para continuar productividad"). Desde que la hoja
"alerta" se acotó a NOCHE/MADRUGADA (`cantidad` típicamente >10, por el
operador `>`), esa función cae siempre en su rama final y devuelve cadena
vacía — **la columna ACCIÓN A TOMAR sale en blanco** en el Excel actual. Pendiente
de ajustar los cortes de `accion_a_tomar()` para que tengan sentido con la
población que realmente ve la hoja hoy.

### 2.5 Entrega

`15_actividad_por_turno_jp.ps1` (PUMA), tarea `RRHH - Actividad por turno para
JP`: corre con `--dias 1` (los 4 turnos del último día completo, no sólo el
turno que tocó cerrar a esa hora). Detalle en
`docs/operacion/indicadores_turno_produccion_jp.md`.

---

## 3. Export de reincidencia NOCHE/MADRUGADA

No es un cálculo propio — es una **lectura** de `vw_alerta_turnos` dentro de una
ventana de días, para responder "¿a quién hay que llamar primero?" con el dato
que el indicador #2 ya calculó y publicó.

**Script:** `03_carga_pg/migration_scripts/17_exportar_alerta_turnos.py`.

### 3.1 Lógica

```sql
SELECT fecha, turno, unidad_negocio, campana, id_empleado, ci, nombre_completo,
       supervisor, telefono, ciudad, departamento, cantidad, operador, umbral
  FROM vw_alerta_turnos
 WHERE alerta
   AND turno = ANY(['NOCHE','MADRUGADA'])
   AND fecha >= (hoy - ventana)      -- ventana default 30 días
```

Sólo NOCHE/MADRUGADA **desde su diseño original** (2026-08-21) — es la campaña
operativa real de corrección de horario; MAÑANA/TARDE quedaron fuera desde el
principio, antes incluso de que el indicador #2 heredara el mismo criterio para
su propia hoja "alerta" (2026-08-28).

`armar_resumen_por_persona()` agrupa por `id_empleado`: cuenta `veces_en_alerta`,
`primera_fecha` y `ultima_fecha` de esa persona dentro de la ventana.
`supervisor`, `unidad_negocio`, `campana` y `telefono` se toman de la **primera**
fila que se ve de esa persona (snapshot, no se actualizan si cambiaron a mitad
de la ventana).

**Filtro para JP:** `--minimo-veces` (default 3) — sólo entran a
`resumen_por_persona` quienes reincidieron de verdad. La hoja `detalle` **nunca**
se filtra: conserva a todo el mundo, incluida la gente con 1-2 alertas, para
auditoría.

### 3.2 Entrega

`17_exportar_alerta_turnos_jp.ps1` (PUMA), tarea `RRHH - Reincidencia turnos
para JP`. Sólo lee `rrhh_bd` — no sale a las bases de producción, así que es
independiente del horario de cálculo del indicador #2 en el servidor.

---

## 4. Indicador #3 — Producción MTD vs. histórico

**Qué mide:** lo que cada afiliador activo produjo desde el día 1 del mes en
curso hasta HOY, contra el promedio de lo que produjo en el mismo tramo de días
(no el mes completo) de los meses anteriores. Nunca compara un mes parcial
contra uno cerrado — eso sesgaría siempre a la baja.

**Naturaleza:** foto. El "día de corte" es siempre HOY; cada corrida de
`--escribir` reemplaza la tabla entera.

**Scripts:** `18_produccion_mtd_vs_historico.py` (cálculo, capa "Cálculo" según
el criterio "Cálculo → Alertas → Comunicación" del diseño original — sin
alertas ni exportación acá a propósito) y `18b_exportar_produccion_mtd.py`
(exportador aparte, sin lógica de cálculo propia).

### 4.1 Tabla y vista en `rrhh_bd`

**`produccion_mtd_vs_historico`** (`schema/24_create_produccion_mtd.sql`):

| Columna | Significado |
|---|---|
| `id_empleado` | PK, FK a `empleado_unidad` |
| `dia_corte` | Día del mes de la corrida (ej. 21) — el mismo día se usa para recortar los meses históricos |
| `produccion_actual_mtd` | Afiliaciones desde el día 1 del mes en curso hasta hoy |
| `promedio_historico_mtd` | Promedio de "día 1 al mismo `dia_corte`" en los meses históricos con dato real |
| `meses_historicos` | Cuántos de los N meses de ventana (default 3) tuvieron dato real — nunca se rellena con 0 lo que no existió (alguien con 2 meses de antigüedad tiene `meses_historicos=2`, no 3) |
| `variacion_pct` | `(actual - promedio) / promedio`. `NULL` si el promedio es 0 o si no hay `MEDIDO` |
| `estado_medicion` | `MEDIDO` · `SIN HISTORICO` · `SIN MEDICION` (ver 4.2) |
| `motivo_sin_medicion`, `identificador_produccion`, `fecha_calculo` | Igual que en los otros dos indicadores |

Un `CHECK` de coherencia (`ck_produccion_mtd_coherencia`) obliga a que cada
estado tenga exactamente los campos que le corresponden (ej. `SIN MEDICION`
exige los 3 numéricos en `NULL` y `meses_historicos=0`).

**`vw_produccion_mtd_vs_historico`** agrega nombre/supervisor/geografía sobre la
tabla, sin recalcular nada — respeta correcciones manuales que se le hayan
hecho a la foto.

### 4.2 Los tres estados — "el cero es un dato, el no-medido no", aplicado dos veces

| Estado | Significa |
|---|---|
| `MEDIDO` | Hay al menos 1 mes histórico con dato. `promedio_historico_mtd` puede ser `0.00` (afilió cero esos meses) — es un dato real, no un no-medido |
| `SIN HISTORICO` | El identificador SÍ se pudo medir, pero la persona no tiene ningún mes anterior completo (alta reciente). Se sabe cuánto lleva este mes; no hay con qué compararlo todavía |
| `SIN MEDICION` | El identificador no se pudo resolver (código sintético de ZAS, ambigüedad) — no se puede afirmar nada, ni siquiera del mes actual |

### 4.3 Fuente de producción

Reusa `FUENTE_HORARIA` de `15_actividad_por_turno.py` (mismas tablas:
`fact_activaciones` para YAPE, `fact_afiliaciones` para el resto) — **no** usa
`fact_consolidados`, ni siquiera para los meses históricos ya cerrados, para
que el criterio de medición sea el mismo en toda la comparación (mismo motivo
que el indicador #2, ver 0.4).

### 4.4 Filtro y acción para JP (`18b_exportar_produccion_mtd.py`, 2026-08-28)

`18b` no tiene lógica de cálculo propia: LEE la vista y aplica, sólo para la
hoja "alerta" del Excel de JP, cuatro filtros en este orden:

1. `estado_medicion = 'MEDIDO'` — fuera `SIN HISTORICO` y `SIN MEDICION`, no hay
   con qué comparar.
2. `promedio_historico_mtd >= 10` — la "cantidad esperada" tiene que ser un
   volumen real, no ruido.
3. `produccion_actual_mtd <= promedio_historico_mtd` — fuera quien ya está por
   encima de lo esperado.
4. Fuera de quien ya está en la alerta del indicador #1 (`vw_alerta_inactividad`,
   tramo `SEGUIMIENTO`/`CRITICO`/`REVISAR BAJA`) o del #2 —
   **sólo NOCHE/MADRUGADA**, último cálculo de cada uno de esos dos turnos (no
   una ventana de días: es "¿está en alerta AHORA?").

🔴 **Por qué la exclusión del #2 usa sólo NOCHE/MADRUGADA:** medido antes de
aplicar el filtro, usar los 4 turnos excluía a 377 de 386 afiliadores (el mismo
piso de MAÑANA/TARDE sin calibrar, ver 2.4) — hubiera vaciado el indicador.

`VARIACIÓN` para JP se calcula **en cantidad, no en porcentaje**
(`produccion_actual_mtd - promedio_historico_mtd`, siempre ≤ 0 dado el filtro
3), a diferencia de `variacion_pct` que ya trae la vista.

**Acción a tomar**, por `produccion_actual_mtd / promedio_historico_mtd`:

| Cumplimiento | Acción |
|---|---|
| ≥ 80% | "Llamada de motivación" |
| 50% – 80% | "Llamada de seguimiento" |
| < 50% | "Coordinación con subgerente" |

### 4.5 Entrega

`18b_exportar_produccion_mtd_jp.ps1` (PUMA), tarea `RRHH - Produccion MTD para
JP`. Sólo lee `rrhh_bd` — la foto que publica `RRHH_Produccion_MTD` en el
servidor una vez al día (06:50); múltiples envíos el mismo día muestran el
mismo corte.

---

## 5. Cuadro comparativo

| | #1 Inactividad | #2 Turnos | Reincidencia (17) | #3 Producción MTD |
|---|---|---|---|---|
| Naturaleza | Foto | **Histórica** | Lectura de #2 | Foto |
| Grano | 1 fila / afiliador activo | 1 fila / (afiliador, fecha, turno) | 1 fila / afiliador (resumen) | 1 fila / afiliador activo |
| Población | AFILIADOR activo, sin baja | Igual | (deriva de #2) | Igual |
| Tabla base | `alerta_inactividad_afiliador` | `actividad_turno_afiliador` | — | `produccion_mtd_vs_historico` |
| Vista | `vw_alerta_inactividad` | `vw_alerta_turnos` | (usa `vw_alerta_turnos`) | `vw_produccion_mtd_vs_historico` |
| Refresco | Servidor, cada hora (`--escribir`) | Servidor, 4x/día (`00:30/08:30/13:30/18:30`) | No calcula — lee | Servidor, 1x/día (06:50) |
| Dedup para JP | Sí (`alerta_inactividad_notificacion`) | No | No | No |
| YAPE fuente | `fact_consolidados`+`reactivaciones`+`fact_activaciones` | `fact_activaciones` sólo | (hereda de #2) | `fact_activaciones` sólo |
| Entrega a JP | `14b_alerta_inactividad_jp.ps1` | `15_actividad_por_turno_jp.ps1` | `17_exportar_alerta_turnos_jp.ps1` | `18b_exportar_produccion_mtd_jp.ps1` |

---

## 6. Dónde seguir leyendo

| Necesito... | Voy a |
|---|---|
| El detalle operativo de cada entrega a JP (rutas, tareas programadas, comandos) | `docs/operacion/alerta_inactividad_jp.md` y `docs/operacion/indicadores_turno_produccion_jp.md` |
| Por qué cada decisión de diseño se tomó así (fechas, discusiones, casos reales) | `CLAUDE.md`, buscar por el número del indicador |
| Trampas ya conocidas de este proyecto (identificador sintético, `fact_consolidados` acumulando, etc.) | `.claude/rules/20-trampas-conocidas.md` |
| El diseño original de cada indicador | `docs/superpowers/specs/2026-08-2*-*.md` |
