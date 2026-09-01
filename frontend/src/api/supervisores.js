import client from './client'

export const postContactoSupervisor = (datos) => client.post('/contactos-supervisor', datos)
// `fuente` acota el 'último contacto' al indicador que se está mirando.
export const getUltimosContactosSupervisor = (fuente) =>
  client.get('/contactos-supervisor/ultimos', { params: fuente ? { fuente } : undefined })
export const getHistorialSupervisor = (idPersonaSupervisor) =>
  client.get(`/contactos-supervisor/historial/${idPersonaSupervisor}`)
