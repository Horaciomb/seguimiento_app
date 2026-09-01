# -*- coding: utf-8 -*-
"""Aplica una migración SQL de esta app contra rrhh_bd (prod) o rrhh_bd_dev.

Por qué existe: `seguimiento_llamada` y `seguimiento_disponibilidad` son las únicas tablas
propias de esta app — no las trae Lab 001, así que hay que crearlas a mano con DDL. Las
migraciones 001 y 002 se aplicaron con un script ad-hoc armado en el momento y descartado;
CLAUDE.md quedó pidiendo justamente versionar el script en vez de rehacerlo cada vez.

Conecta como `bex_ingeniero` (dueño de las tablas — `bex_app` NO puede hacer DDL), con la
contraseña en la variable de entorno RRHH_PG_PASSWORD (mismo patrón que usa Lab 001 para
sus propias migraciones). Todas las migraciones de este repo son idempotentes, así que
volver a correr una ya aplicada es un no-op seguro.

Uso:
    # dev
    python migrations/aplicar_migracion.py 003_create_seguimiento_disponibilidad.sql
    # producción (pide confirmación escrita)
    python migrations/aplicar_migracion.py 003_create_seguimiento_disponibilidad.sql --prod

Después de ejecutar el SQL imprime la verificación (columnas, constraints, grants de
bex_app) para no tener que abrirla a mano.
"""
import argparse
import io
import os
import sys
from pathlib import Path

import psycopg2

# Los comentarios del SQL y de este script llevan acentos; sin esto, la consola de Windows
# (cp1252) los rompe o directamente revienta al imprimir.
sys.stdout.reconfigure(encoding="utf-8")

HOST = "10.0.0.2"
PORT = 5432
USUARIO = "bex_ingeniero"
BD_DEV = "rrhh_bd_dev"
BD_PROD = "rrhh_bd"

AQUI = Path(__file__).resolve().parent


def tablas_del_sql(sql: str) -> list[str]:
    """Nombres de tabla que el SQL toca, para verificar sólo esas al final."""
    tablas = []
    for linea in sql.splitlines():
        limpia = linea.strip().lower()
        # El orden importa y hay que cortar al primer match: sin el break, la línea
        # "CREATE TABLE IF NOT EXISTS x (" matchea también el prefijo "create table " y
        # deja "if" como si fuera un nombre de tabla.
        for prefijo in ("create table if not exists ", "create table ", "alter table "):
            if limpia.startswith(prefijo):
                nombre = limpia[len(prefijo):].split("(")[0].split()[0].strip()
                if nombre and nombre not in tablas:
                    tablas.append(nombre)
                break
    return tablas


def verificar(cur, tabla: str) -> None:
    print(f"\n===== {tabla} =====")

    print("-- columnas --")
    cur.execute(
        """SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_name = %s ORDER BY ordinal_position""",
        (tabla,),
    )
    for fila in cur.fetchall():
        print("  ", fila)

    print("-- constraints --")
    cur.execute(
        """SELECT conname, pg_get_constraintdef(oid)
           FROM pg_constraint WHERE conrelid = %s::regclass ORDER BY conname""",
        (tabla,),
    )
    for fila in cur.fetchall():
        print("  ", fila)

    print("-- privilegios de bex_app --")
    cur.execute(
        """SELECT privilege_type FROM information_schema.role_table_grants
           WHERE table_name = %s AND grantee = 'bex_app' ORDER BY privilege_type""",
        (tabla,),
    )
    print("  ", [f[0] for f in cur.fetchall()] or "(ninguno — la app no va a poder leerla)")

    cur.execute(f"SELECT count(*) FROM {tabla}")
    print("-- filas actuales:", cur.fetchone()[0])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("archivo", help="nombre del .sql dentro de backend/migrations/")
    ap.add_argument("--prod", action="store_true", help="aplicar en rrhh_bd (producción)")
    args = ap.parse_args()

    ruta = AQUI / args.archivo
    if not ruta.exists():
        print(f"No existe {ruta}", file=sys.stderr)
        return 1

    contrasena = os.environ.get("RRHH_PG_PASSWORD")
    if not contrasena:
        print("Falta la variable de entorno RRHH_PG_PASSWORD.", file=sys.stderr)
        return 1

    bd = BD_PROD if args.prod else BD_DEV
    sql = io.open(ruta, encoding="utf-8").read()

    print(f"Migración : {ruta.name}")
    print(f"Destino   : {bd} en {HOST}:{PORT} como {USUARIO}")

    # rrhh_bd es una base compartida en producción: no se toca sin una confirmación
    # explícita en el momento, aunque el comando ya lleve --prod.
    if args.prod:
        print("\n*** PRODUCCIÓN (base compartida con las otras apps de RRHH) ***")
        if input("Escribí APLICAR para continuar: ").strip() != "APLICAR":
            print("Cancelado, no se ejecutó nada.")
            return 1

    conexion = psycopg2.connect(
        host=HOST, port=PORT, dbname=bd, user=USUARIO, password=contrasena
    )
    conexion.autocommit = True
    cur = conexion.cursor()

    cur.execute("SELECT current_database(), current_user")
    print("\nConectado a:", cur.fetchone())

    cur.execute(sql)
    print(">>> SQL ejecutado sin errores.")

    for tabla in tablas_del_sql(sql):
        verificar(cur, tabla)

    cur.close()
    conexion.close()
    print("\nListo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
