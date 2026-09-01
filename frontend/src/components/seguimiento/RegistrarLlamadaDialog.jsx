import { useState, useEffect } from 'react'
import { PhoneCall } from 'lucide-react'
import MutationDialog from '@/components/ui/mutation-dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SelectField from '@/components/ui/select-field'
import { DISPONIBILIDADES } from '@/lib/disponibilidad'

const RESULTADOS = [
  { value: 'CONTESTO', label: 'Contestó' },
  { value: 'NO_CONTESTO', label: 'No contestó' },
  { value: 'NUMERO_INCORRECTO', label: 'Número incorrecto' },
  { value: 'COMPROMISO', label: 'Compromiso de mejora' },
  { value: 'RESUELTO', label: 'Resuelto' },
  { value: 'ESCALADO', label: 'Escalado / revisar con RRHH' },
  { value: 'OTRO', label: 'Otro' },
]

const MEDIOS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'LLAMADA', label: 'Llamada' },
  { value: 'OTRO', label: 'Otro' },
]

// El motivo es la información que esta app existe para recopilar: por qué el afiliador
// dice que bajó su rendimiento. Categorizado (con "Otro" de escape) para poder reportar
// "cuántos se van por X motivo" sin leer notas de texto libre a mano.
const MOTIVOS = [
  { value: 'SALUD', label: 'Salud' },
  { value: 'PERSONAL_FAMILIAR', label: 'Personal / familiar' },
  { value: 'OTRO_TRABAJO', label: 'Consiguió otro trabajo' },
  { value: 'NO_LE_GUSTA_TURNO', label: 'No le gusta el turno/proyecto' },
  { value: 'PAGO_COMISIONES', label: 'Pago / comisiones' },
  { value: 'DIFICULTAD_SISTEMA', label: 'Dificultad con el sistema o capacitación' },
  { value: 'SIN_MOTIVO_CLARO', label: 'Sin motivo claro' },
  { value: 'OTRO', label: 'Otro (detallar en notas)' },
]

function estadoInicial(medioSugerido, disponibilidadActual) {
  return {
    resultado: '',
    medio_contacto: medioSugerido || 'WHATSAPP',
    // Precargado con lo que ya se sabe (confirmado antes, o heredado de reclutamiento):
    // así el campo sirve tanto para confirmarlo como para corregirlo, y quien llama ve de
    // entrada qué figura hoy. Si no hay nada, queda vacío y es la ocasión de preguntarlo.
    disponibilidad: disponibilidadActual || '',
    motivo_bajo_rendimiento: '',
    proxima_accion: '',
    fecha_proximo_seguimiento: '',
    notas: '',
    registrado_por: '',
  }
}

// Campos numéricos propios de cada fuente que vale la pena congelar en `snapshot_metrica`,
// para que el registro conserve sentido aunque la alerta de origen ya haya cambiado.
const CAMPOS_SNAPSHOT = [
  'dias_inactividad', 'tramo', 'turno', 'cantidad', 'umbral',
  'veces_en_alerta', 'produccion_actual_mtd', 'promedio_historico_mtd', 'cumplimiento_pct',
]

export default function RegistrarLlamadaDialog({ fila, fuente, medioSugerido, onClose, mutation }) {
  const [form, setForm] = useState(estadoInicial())

  useEffect(() => {
    if (fila) setForm(estadoInicial(medioSugerido, fila.disponibilidad))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fila])

  if (!fila) return null

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const snapshot = Object.fromEntries(
    CAMPOS_SNAPSHOT.filter((k) => fila[k] !== undefined).map((k) => [k, fila[k]]),
  )

  const enviar = () => {
    mutation.mutate({
      id_empleado: fila.id_empleado,
      fuente,
      resultado: form.resultado,
      medio_contacto: form.medio_contacto,
      motivo_bajo_rendimiento: form.motivo_bajo_rendimiento || undefined,
      disponibilidad: form.disponibilidad || undefined,
      proxima_accion: form.proxima_accion || undefined,
      fecha_proximo_seguimiento: form.fecha_proximo_seguimiento || undefined,
      notas: form.notas || undefined,
      registrado_por: form.registrado_por || undefined,
      snapshot_metrica: snapshot,
    })
  }

  return (
    <MutationDialog
      open={!!fila}
      onClose={onClose}
      title="Registrar contacto"
      description={`${fila.nombre_completo} · ${fila.telefono ?? 'sin teléfono'}`}
      icon={PhoneCall}
      accent="indigo"
      mutation={mutation}
      onSubmit={enviar}
      canSubmit={!!form.resultado}
      submitLabel="Guardar"
      pendingLabel="Guardando…"
      errorMessage="No se pudo registrar el contacto."
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="medio_contacto">Medio</Label>
          <SelectField
            id="medio_contacto"
            value={form.medio_contacto}
            onValueChange={(v) => set('medio_contacto', v)}
            items={MEDIOS}
            triggerClassName="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resultado">Resultado</Label>
          <SelectField
            id="resultado"
            value={form.resultado}
            onValueChange={(v) => set('resultado', v)}
            items={RESULTADOS}
            placeholder="¿Qué pasó?"
            triggerClassName="w-full"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="disponibilidad">Disponibilidad</Label>
        <SelectField
          id="disponibilidad"
          value={form.disponibilidad}
          onValueChange={(v) => set('disponibilidad', v)}
          items={DISPONIBILIDADES}
          placeholder="¿En qué horario trabaja?"
          triggerClassName="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Queda guardado para la persona y se ve en la lista — no hace falta volver a preguntarlo.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="motivo_bajo_rendimiento">Motivo del bajo rendimiento</Label>
        <SelectField
          id="motivo_bajo_rendimiento"
          value={form.motivo_bajo_rendimiento}
          onValueChange={(v) => set('motivo_bajo_rendimiento', v)}
          items={MOTIVOS}
          placeholder="Si contó por qué, elegí la categoría más cercana"
          triggerClassName="w-full"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="proxima_accion">Próxima acción</Label>
        <Input
          id="proxima_accion"
          value={form.proxima_accion}
          onChange={(e) => set('proxima_accion', e.target.value)}
          placeholder="Ej: volver a escribir en 2 días"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fecha_proximo_seguimiento">Fecha de próximo seguimiento</Label>
        <Input
          id="fecha_proximo_seguimiento"
          type="date"
          value={form.fecha_proximo_seguimiento}
          onChange={(e) => set('fecha_proximo_seguimiento', e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notas">Notas</Label>
        <Textarea
          id="notas"
          value={form.notas}
          onChange={(e) => set('notas', e.target.value)}
          placeholder="Detalle de lo que contó, o el motivo si elegiste 'Otro'…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="registrado_por">Quién contactó</Label>
        <Input
          id="registrado_por"
          value={form.registrado_por}
          onChange={(e) => set('registrado_por', e.target.value)}
          placeholder="Tu nombre"
        />
      </div>
    </MutationDialog>
  )
}
