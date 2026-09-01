import { MessageCircle, ClipboardCheck, History, Users, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from '@/components/ui/accordion'
import { fmtFechaHora } from '@/lib/format'
import { armarLinkWhatsapp, armarLinkWhatsappSupervisor } from '@/lib/whatsapp'
import { RESULTADO_LABEL, RESULTADO_VARIANT } from '@/lib/contacto'
import { CLAVE_SIN_SUPERVISOR, metricaDeFila } from '@/lib/supervisores'
import { DISPONIBILIDAD_VARIANT } from '@/lib/disponibilidad'

/** Cuándo se le habló por última vez a ESTE supervisor (no al afiliador). */
function UltimoContactoSupervisor({ ultimo }) {
  if (!ultimo) return <span className="text-xs text-muted-foreground">Nunca contactado</span>
  return (
    <span className="flex items-center gap-1.5 flex-wrap text-xs">
      <Badge variant={RESULTADO_VARIANT[ultimo.resultado] ?? 'secondary'}>
        {RESULTADO_LABEL[ultimo.resultado] ?? ultimo.resultado}
      </Badge>
      {ultimo.medio_contacto === 'WHATSAPP' && <MessageCircle className="h-3 w-3 text-green-600 shrink-0" />}
      <span className="text-muted-foreground tabular-nums">
        {fmtFechaHora(ultimo.fecha_contacto)} · {ultimo.cantidad_afiliadores} afiliadores
      </span>
    </span>
  )
}

/**
 * Los 3 botones del supervisor. Dos situaciones distintas, que no hay que confundir:
 *
 *  - Sin `id_persona_supervisor` (grupo "(sin asignar)"): no hay a quién contactar ni
 *    contra quién registrar nada. El grupo es de sólo lectura: es la lista de gente a la
 *    que hay que asignarle un líder en Lab 001.
 *  - Con id pero sin teléfono: sí se puede registrar el contacto (por llamada, o el que
 *    haya sido) y ver su historial; sólo el botón de WhatsApp queda deshabilitado.
 */
function AccionesSupervisor({ grupo, fuenteId, onRegistrar, onVerHistorial }) {
  if (!grupo.id_persona_supervisor) {
    return (
      <span className="text-xs text-muted-foreground">
        Sin líder asignado — hay que asignarlo en el sistema de personal
      </span>
    )
  }

  const linkWhatsapp = armarLinkWhatsappSupervisor(
    grupo.telefono,
    grupo.nombre,
    grupo.etiquetaFuente,
    grupo.afiliadores.map((a) => ({ nombre: a.nombre_completo, detalle: metricaDeFila(a, fuenteId) })),
  )

  return (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-1">
      <Button
        size="touch"
        className="bg-green-600 hover:bg-green-700 text-white px-2 text-xs sm:h-8 sm:gap-1 sm:px-2.5"
        title={linkWhatsapp ? 'Escribirle con la lista de su equipo' : 'Sin teléfono'}
        disabled={!linkWhatsapp}
        render={<a href={linkWhatsapp ?? undefined} target="_blank" rel="noopener noreferrer" />}
      >
        <MessageCircle className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        WhatsApp
      </Button>
      <Button
        size="touch"
        variant="outline"
        className="px-2 text-xs sm:h-8 sm:gap-1 sm:px-2.5"
        onClick={() => onRegistrar(grupo)}
      >
        <ClipboardCheck className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        Registrar
      </Button>
      <Button
        size="touch"
        variant="outline"
        className="px-2 text-xs sm:h-8 sm:gap-1 sm:px-2.5"
        onClick={() => onVerHistorial(grupo)}
      >
        <History className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        Historial
      </Button>
    </div>
  )
}

/** Una persona del equipo, dentro del panel desplegado. */
function FilaAfiliador({ fila, fuenteId }) {
  const linkWhatsapp = armarLinkWhatsapp(fila.telefono, fila.nombre_completo)
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b last:border-b-0">
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm font-medium leading-tight text-pretty">{fila.nombre_completo}</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          CI {fila.ci ?? '—'} · {fila.telefono ?? 'sin teléfono'}
        </div>
        <div className="text-xs text-foreground/80 tabular-nums">{metricaDeFila(fila, fuenteId)}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {fila.disponibilidad && (
          <Badge variant={DISPONIBILIDAD_VARIANT[fila.disponibilidad] ?? 'secondary'}>
            {fila.disponibilidad_label}
          </Badge>
        )}
        <Button
          size="icon-sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          title={linkWhatsapp ? 'Escribirle a la persona' : 'Sin teléfono'}
          disabled={!linkWhatsapp}
          render={<a href={linkWhatsapp ?? undefined} target="_blank" rel="noopener noreferrer" />}
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

/**
 * La alerta vista por líder a cargo: un acordeón por supervisor, con cuánta gente suya
 * está en alerta del indicador elegido y el botón para escribirle con esa lista.
 *
 * Existe porque el llamado de atención va al supervisor, no al afiliador: la lista plana
 * de las otras 4 pestañas sirve para hablar con la persona, esta para hablar con quien la
 * tiene a cargo. Por eso acá el sujeto de las 3 acciones es el supervisor y los
 * afiliadores viven dentro del panel.
 *
 * No tiene una vista de escritorio aparte como `TablaAlertas`: la cabecera del grupo ya es
 * una tarjeta, y en pantalla ancha sólo cambia a que los botones vayan en fila (`sm:`).
 */
export default function TablaSupervisores({ grupos, fuenteId, etiquetaFuente, ultimoPorSupervisor, onRegistrar, onVerHistorial }) {
  if (!grupos.length) {
    return (
      <p className="border rounded-xl py-8 text-center text-sm text-muted-foreground">
        No hay supervisores con gente en esta lista ahora mismo.
      </p>
    )
  }

  return (
    <Accordion>
      {grupos.map((grupo) => {
        const sinLider = grupo.clave === CLAVE_SIN_SUPERVISOR
        const Icono = sinLider ? UserX : Users
        return (
          <AccordionItem key={grupo.clave} value={String(grupo.clave)}>
            <AccordionTrigger className="px-3 py-3">
              <Icono className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-[15px] leading-tight text-pretty">{grupo.nombre}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {grupo.telefono ?? (sinLider ? '' : 'sin teléfono')}
                </span>
              </span>
              <Badge variant={grupo.afiliadores.length >= 5 ? 'rose' : 'amber'} className="shrink-0 tabular-nums">
                {grupo.afiliadores.length}
              </Badge>
            </AccordionTrigger>

            <div className="px-3 pb-3 space-y-2 border-t pt-2">
              <UltimoContactoSupervisor ultimo={ultimoPorSupervisor[grupo.id_persona_supervisor]} />
              <AccionesSupervisor
                grupo={{ ...grupo, etiquetaFuente }}
                fuenteId={fuenteId}
                onRegistrar={onRegistrar}
                onVerHistorial={onVerHistorial}
              />
            </div>

            <AccordionPanel>
              <div className="px-3 pb-3 border-t pt-1">
                {grupo.afiliadores.map((fila) => (
                  <FilaAfiliador key={fila.id_empleado} fila={fila} fuenteId={fuenteId} />
                ))}
              </div>
            </AccordionPanel>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
