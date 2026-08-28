import client from './client'

export const getInactividad = () => client.get('/alertas/inactividad')
export const getTurnos = () => client.get('/alertas/turnos')
export const getReincidencia = (params) => client.get('/alertas/reincidencia', { params })
export const getProduccionMtd = () => client.get('/alertas/produccion-mtd')
