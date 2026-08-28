import client from './client'

export const postLlamada = (datos) => client.post('/llamadas', datos)
export const getHistorial = (idEmpleado) => client.get(`/llamadas/historial/${idEmpleado}`)
