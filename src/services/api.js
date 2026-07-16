// ApiService: ponto único de contato com o backend/proxy do catálogo.
// O front NUNCA chama credito.mersan.co diretamente — sempre passa pelas
// funções serverless em /functions/api, que escondem a API real, resolvem
// CORS e cacheiam por 30 minutos (ver functions/api/estoque.js).
//
// Isso também cumpre a regra de cache do briefing no lado do cliente:
// se o mesmo vendedor pesquisar o mesmo produto de novo dentro de 30 min,
// nem chega a bater no proxy.

import { getCached, setCached } from './cache'

const LOJA = 261 // nunca exibir outras lojas

class ApiService {
  /**
   * Consulta o estoque de um produto na loja 261, via proxy.
   * Retorna: { referencia, loja, estoque: [{ tamanho, pares }], atualizadoEm }
   */
  static async buscarEstoque(referencia) {
    const cacheKey = `estoque_${referencia}`
    const cached = getCached(cacheKey)
    if (cached) return cached

    const resp = await fetch(`/api/estoque?referencia=${encodeURIComponent(referencia)}`)
    const data = await safeJson(resp)

    if (!resp.ok) {
      throw new Error(data?.error || 'Não foi possível consultar o estoque.')
    }

    setCached(cacheKey, data)
    return data
  }

  /**
   * Consulta os dados do produto (nome, cor, preço). Ainda não integrado
   * ao endpoint real da Mersan — ver functions/api/produto.js.
   * Retorna null em vez de lançar erro, para não travar a busca por estoque.
   */
  static async buscarDadosProduto(termo) {
    const resp = await fetch(`/api/produto?termo=${encodeURIComponent(termo)}`)
    if (!resp.ok) return null
    return safeJson(resp)
  }

  /**
   * Fluxo completo pedido no briefing: primeiro dados do produto, depois
   * estoque. Hoje só o estoque está realmente disponível; nome/cor/preço
   * ficam null até o endpoint de produto ser conectado.
   */
  static async buscarProduto(termo) {
    const [dadosProduto, estoque] = await Promise.all([
      ApiService.buscarDadosProduto(termo).catch(() => null),
      ApiService.buscarEstoque(termo)
    ])

    return {
      referencia: termo,
      nome: dadosProduto?.nome ?? null,
      cor: dadosProduto?.cor ?? null,
      preco: dadosProduto?.preco ?? null,
      foto: null, // sistema próprio de fotos entra na Etapa 3
      loja: LOJA,
      estoque: estoque.estoque,
      atualizadoEm: estoque.atualizadoEm
    }
  }
}

async function safeJson(resp) {
  try {
    return await resp.json()
  } catch {
    return null
  }
}

export default ApiService

// Mantido para compatibilidade com o hook já existente (useProductSearch).
export const buscarProduto = ApiService.buscarProduto

export const CONFIG = { LOJA }
