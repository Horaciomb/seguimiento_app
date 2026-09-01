import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'
import MutationDialog from '@/components/ui/mutation-dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SelectField from '@/components/ui/select-field'
import { RESULTADOS, MEDIOS } from '@/lib/contacto'
import { metricaDeFila } from '@/lib/supervisores'

function estadoInicial() {
  return {
    resultado: '',
    medio_contacto: 'WHATSAPP',
    proxima_accion: '',
    fecha_proximo_seguimiento: '',
    notas: '',
    registrado_por: '',
  }
}

/**
 * Registro del llamado de atención al supervisor.
 *
 * Calcado de `RegistrarLlamadaDialog` salvo dos campos que NO están acá a propósito:
 *  - `disponibilidad`: es un atributo del afiliador, se averigua hablando con él.
 *  - `motivo_bajo_rendimiento`: es el motivo que da el afiliador; meter acá el que supone
 *    el supervisor ensuciaría el reporte de "cuántos se van por X motivo".
 *
 * Manda el snapshot de los afiliadores con su métrica ya formateada — la misma línea que
 * salió en el WhatsApp — porque la alerta se recalcula todos los días y sin eso el
 * historial no podría reconstruir de qué se habló.
 */
export default function RegistrarContactoSupervisorDialog({ grupo, fuenteId, etiquetaFuente, onClose, mutation }) {
  const [form, setForm] = useState(estadoInicial())

  useEffect(() => {
    if (grupo) setForm(estadoInicial())
  }, [grupo])

  if (!grupo) return null

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const enviar = () => {
    mutation.mutate({
      id_persona_supervisor: grupo.id_persona_supervisor,
      supervisor_nombre: grupo.nombre,
      fuente: fuenteId,
      resultado: form.resultado,
      medio_contacto: form.medio_contacto,
      afiliadores: grupo.afiliadores.map((a) => ({
        id_empleado: a.id_empleado,
        nombre: a.nombre_completo,
        metrica: metricaDeFila(a, fuenteId),
      })),
      proxima_accion: form.proxima_accion || undefined,
      fecha_proximo_seguimiento: form.fecha_proximo_seguimiento || undefined,
      notas: form.notas || undefined,
      registrado_por: form.registrado_por || undefined,
    })
  }

  return (
    <MutationDialog
      open={!!grupo}
      onClose={onClose}
      title="Registrar contacto al supervisor"
      description={`${grupo.nombre} · ${grupo.telefono ?? 'sin teléfono'}`}
      icon={Users}
      accent="emerald"
      mutation={mutation}
      onSubmit={enviar}
      canSubmit={!!form.resultado}
      submitLabel="Guardar"
      pendingLabel="Guardando…"
      errorMessage="No se pudo registrar el contacto al supervisor."
    >
      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Queda registrado sobre <strong className="text-foreground tabular-nums">{grupo.afiliadores.length}</strong>{' '}
        afiliadores de su equipo en alerta de {etiquetaFuente}. La lista se guarda congelada, con el
        número de cada uno tal como está hoy.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="medio_contacto_sup">Medio</Label>
          <SelectField
            id="medio_contacto_sup"
            value={form.medio_contacto}
            onValueChange={(v) => set('medio_contacto', v)}
            items={MEDIOS}
            triggerClassName="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resultado_sup">Resultado</Label>
          <SelectField
            id="resultado_sup"
            value={form.resultado}
            onValueChange={(v) => set('resultado', v)}
            items={RESULTADOS}
            placeholder="¿Qué pasó?"
            triggerClassName="w-full"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="proxima_accion_sup">Próxima acción</Label>
        <Input
          id="proxima_accion_sup"
          value={form.proxima_accion}
          onChange={(e) => set('proxima_accion', e.target.value)}
          placeholder="Ej: revisar sus números en 3 días"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fecha_proximo_seguimiento_sup">Fecha de próximo seguimiento</Label>
        <Input
          id="fecha_proximo_seguimiento_sup"
          type="date"
          value={form.fecha_proximo_seguimiento}
          onChange={(e) => set('fecha_proximo_seguimiento', e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notas_sup">Notas</Label>
        <Textarea
          id="notas_sup"
          value={form.notas}
          onChange={(e) => set('notas', e.target.value)}
          placeholder="Qué explicación dio, con qué se comprometió…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="registrado_por_sup">Quién contactó</Label>
        <Input
          id="registrado_por_sup"
          value={form.registrado_por}
          onChange={(e) => set('registrado_por', e.target.value)}
          placeholder="Tu nombre"
        />
      </div>
    </MutationDialog>
  )
}
