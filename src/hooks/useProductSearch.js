import { useState, useCallback, useEffect, useRef } from 'react'
import { buscarProduto } from '../services/api'

// Atualiza sozinho a cada 30 minutos, enquanto a pessoa está com o produto
// aberto na tela — sem precisar buscar de novo manualmente. Mantém o
// tamanho/estoque sempre em dia mesmo se ninguém tocar na tela.
const AUTO_REFRESH_MS = 30 * 60 * 1000 // 30 minutos

export function useProductSearch() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)

  // Guarda o último termo buscado, para o auto-refresh saber o que repetir.
  const termoAtualRef = useRef(null)

  const executarBusca = useCallback(async (termo, { silenciosa = false } = {}) => {
    if (!silenciosa) setLoading(true)
    setError(null)
    try {
      const data = await buscarProduto(termo)
      setResultado(data)
    } catch (err) {
      // Numa atualização silenciosa em segundo plano, não apaga o resultado
      // já exibido nem mostra erro — só tenta de novo no próximo ciclo.
      if (!silenciosa) {
        setResultado(null)
        setError(err.message || 'Não foi possível consultar o produto.')
      }
    } finally {
      if (!silenciosa) setLoading(false)
    }
  }, [])

  const search = useCallback(
    (termo) => {
      termoAtualRef.current = termo
      return executarBusca(termo)
    },
    [executarBusca]
  )

  // Enquanto houver um produto na tela, verifica de novo a cada 30 minutos.
  useEffect(() => {
    if (!resultado) return undefined

    const intervalId = setInterval(() => {
      if (termoAtualRef.current) {
        executarBusca(termoAtualRef.current, { silenciosa: true })
      }
    }, AUTO_REFRESH_MS)

    return () => clearInterval(intervalId)
  }, [resultado, executarBusca])

  return { search, loading, error, resultado }
}
