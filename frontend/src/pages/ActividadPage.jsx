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
