import { useState, useCallback } from 'react'
import { buscarProduto } from '../services/api'

export function useProductSearch() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)

  const search = useCallback(async (termo) => {
    setLoading(true)
    setError(null)
    try {
      const data = await buscarProduto(termo)
      setResultado(data)
    } catch (err) {
      setResultado(null)
      setError(err.message || 'Não foi possível consultar o produto.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { search, loading, error, resultado }
}
