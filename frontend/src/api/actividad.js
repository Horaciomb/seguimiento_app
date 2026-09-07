import client from './client'

export const getActividad = (params) => client.get('/actividad', { params })
export const getRegistradores = () => client.get('/actividad/registradores')

/**
 * El `.xlsx`. `responseType: 'blob'` es obligatorio: sin eso axios intenta parsear el
 * binario como texto y el archivo llega corrupto.
 */
export const getActividadXlsx = (params) =>
  client.get('/actividad/export.xlsx', { params, responseType: 'blob' })
