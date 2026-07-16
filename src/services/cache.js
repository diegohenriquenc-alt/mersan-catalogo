// Cache inteligente de consultas de produto.
// Regra do briefing: resultado válido por 30 minutos; após isso, atualiza automaticamente.

const CACHE_PREFIX = 'mersan_cache_'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutos

export function getCached(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null

    const { data, timestamp } = JSON.parse(raw)
    const isExpired = Date.now() - timestamp > CACHE_TTL_MS
    if (isExpired) {
      localStorage.removeItem(CACHE_PREFIX + key)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function setCached(key, data) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() })
    )
  } catch {
    // Armazenamento cheio ou indisponível: falha silenciosamente,
    // a consulta simplesmente vai direto na API.
  }
}
