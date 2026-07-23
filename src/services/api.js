// ApiService: ponto único de contato com o backend/proxy do catálogo.
// O front NUNCA chama credito.mersan.co diretamente — sempre passa pelo
// Worker em /worker/index.js, que esconde a API real, resolve CORS e
// controla o cache (borda + revalidação em segundo plano). Não há mais
// cache no navegador aqui — o frescor é responsabilidade só do Worker.
//
// Fluxo real (descoberto via DevTools no sistema "Busca Preço" da própria
// Mersan): primeiro busca os dados do produto (que já trazem nome, cor,
// preço, e o número de referência no formato que a API de estoque espera),
// depois usa essa referência para buscar o estoque.

const LOJA = 261 // nunca exibir outras lojas

class ApiService {
  /**
   * Busca os dados do produto (nome, cor, preço, e a referência real
   * usada pelo endpoint de estoque).
   */
  static async buscarDadosProduto(termo) {
    const resp = await fetch(`/api/produto?termo=${encodeURIComponent(termo)}`)
    const data = await safeJson(resp)

    if (!resp.ok) {
      throw new Error(data?.error || 'Produto não encontrado.')
    }

    return data
  }

  /**
   * Consulta o estoque de uma referência (de uma cor específica) na loja
   * 261, via proxy. A cor é obrigatória na prática: a mesma referência pode
   * ser compartilhada por mais de uma cor na Mersan, então sem a cor o
   * estoque de uma cor pode "vazar" pra outra — e o cache do Worker
   * colidiria entre elas se a URL não incluísse a cor.
   */
  static async buscarEstoque(referencia, cor) {
    const params = new URLSearchParams({ referencia })
    if (cor) params.set('cor', cor)

    const resp = await fetch(`/api/estoque?${params.toString()}`)
    const data = await safeJson(resp)

    if (!resp.ok) {
      throw new Error(data?.error || 'Não foi possível consultar o estoque.')
    }

    return data
  }

  /**
   * Fluxo completo: primeiro os dados do produto, depois o estoque,
   * usando a referência retornada pela própria consulta de produto.
   */
  static async buscarProduto(termo) {
    const dadosProduto = await ApiService.buscarDadosProduto(termo)
    const estoque = await ApiService.buscarEstoque(dadosProduto.referencia, dadosProduto.cor)

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
