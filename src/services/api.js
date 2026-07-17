// ApiService: ponto único de contato com o backend/proxy do catálogo.
// O front NUNCA chama credito.mersan.co diretamente — sempre passa pelo
// Worker em /worker/index.js, que esconde a API real, resolve CORS e
// cacheia por 30 minutos.
//
// Fluxo real (descoberto via DevTools no sistema "Busca Preço" da própria
// Mersan): primeiro busca os dados do produto (que já trazem nome, cor,
// preço, e o número de referência no formato que a API de estoque espera),
// depois usa essa referência para buscar o estoque.

import { getCached, setCached } from './cache'

const LOJA = 261 // nunca exibir outras lojas

class ApiService {
  /**
   * Busca os dados do produto (nome, cor, preço, e a referência real
   * usada pelo endpoint de estoque).
   */
  static async buscarDadosProduto(termo) {
    const cacheKey = `produto_${termo}`
    const cached = getCached(cacheKey)
    if (cached) return cached

    const resp = await fetch(`/api/produto?termo=${encodeURIComponent(termo)}`)
    const data = await safeJson(resp)

    if (!resp.ok) {
      throw new Error(data?.error || 'Produto não encontrado.')
    }

    setCached(cacheKey, data)
    return data
  }

  /**
   * Consulta o estoque de uma referência na loja 261, via proxy.
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
   * Fluxo completo: primeiro os dados do produto, depois o estoque,
   * usando a referência retornada pela própria consulta de produto.
   */
  static async buscarProduto(termo) {
    const dadosProduto = await ApiService.buscarDadosProduto(termo)
    const estoque = await ApiService.buscarEstoque(dadosProduto.referencia)

    // Chave da foto: código de barras do produto (o mesmo que o painel
    // administrativo usa ao cadastrar a foto). Se a foto não existir no R2,
    // o componente ProductResult cai para a imagem padrão automaticamente.
    const chaveFoto = dadosProduto.codigoBarras || termo

    return {
      referencia: dadosProduto.referencia,
      nome: dadosProduto.nome,
      cor: dadosProduto.cor,
      preco: dadosProduto.preco,
      precoOriginal: dadosProduto.precoOriginal,
      emPromocao: dadosProduto.emPromocao,
      foto: `/produto-foto/${encodeURIComponent(chaveFoto)}`,
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
