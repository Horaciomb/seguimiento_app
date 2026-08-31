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

### La única tabla propia: `seguimiento_llamada`

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
`seguimiento_llamada` no está en ese inventario, así que un re-clon de dev la borra (mismo
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
  locales de 8 dígitos) y un mensaje inicial editable. Es un `<a target="_blank">` renderizado
  vía el prop `render` de `@base-ui/react` sobre el componente `Button` — abre el chat en una
  pestaña nueva, **no registra nada por sí solo**.
- **"Registrar" queda separado del botón de WhatsApp a propósito**: la respuesta de la
  persona llega después de la conversación, no en el momento de abrir el chat, así que
  acoplar los dos hubiera forzado a llenar el formulario antes de tener qué contar.
- **Dos columnas nuevas en `seguimiento_llamada`** (`migrations/002_add_medio_y_motivo.sql`,
  aplicada en `rrhh_bd_dev`, **pendiente en prod** igual que `001`):
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

## Verificado el 2026-08-28

Contra `rrhh_bd_dev`: las 4 queries de `alertas_service.py` corren sin error (119
inactividad, 6 turnos, 32 reincidencia, 105 producción MTD — los números no van a coincidir
con los que documenta Lab 001 para una fecha puntual, dev es un clon que cambia con el
tiempo). `POST /llamadas` + historial + enriquecimiento de "última llamada" probados
end-to-end vía HTTP real. Frontend: `npm run build` compila sin errores (3007 módulos). No
se pudo probar visualmente en navegador esta sesión (la automatización de Chrome no
respondía) — falta un recorrido manual en el navegador antes de darlo por completo.
