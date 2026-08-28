import axios from 'axios'

// Sin auth a propósito: uso interno, un solo usuario, sin login. Ver CLAUDE.md.
const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

export default client
