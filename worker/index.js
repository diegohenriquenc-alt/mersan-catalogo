// Worker único do Catálogo Mersan.
//
// Rotas:
//  /produto/{codigo}             -> página do produto com meta tags Open
//                                    Graph dinâmicas (Etapa 4)
//  /api/produto?termo=...        -> dados do produto na API da Mersan
//  /api/estoque?referencia=...   -> estoque na loja 261
//  /produto-foto/{codigo}        -> serve a foto do produto (armazenada no KV)
//  /api/admin/login              -> valida a senha do painel administrativo
//  /api/admin/foto (POST)        -> envia/troca a foto de um produto
//  /api/admin/foto (DELETE)      -> exclui a foto de um produto
//  /api/admin/fotos (GET)        -> lista as fotos já cadastradas
//  /api/admin/estoque-cadastrados (GET)  -> estoque real de cada produto
//                                    cadastrado, incluindo os zerados
//                                    (o /api/catalogo público já filtra
//                                    os zerados antes de responder)
//  /api/admin/categoria-manual (POST)    -> aplica uma categoria à mão
//                                    a uma lista de produtos, protegida
//                                    contra sobrescrita pela planilha
//  qualquer outra rota           -> site estático (React) via binding ASSETS

const MERSAN_BASE = 'https://credito.mersan.co/api/v1'
const LOJA = 261
const CACHE_TTL_SECONDS = 5 * 60 // 5 minutos — teto: acima disso o cache.match nem encontra mais a entrada
const CACHE_TTL_SOFT_SECONDS = 90 // 1,5 min — acima disso (mas ainda dentro do teto) serve o cache normalmente e revalida em segundo plano, sem atrasar o cliente
const PARCELA_MINIMA = 29.99
const MAX_PARCELAS = 10

// env.FOTOS.list() só devolve até 1000 chaves por chamada (e antes o
// código nem pedia isso — ficava travado em 200). Com o catálogo
// crescendo (300+ produtos), uma chamada só pode não trazer tudo. Essa
// função dá a volta em todas as "páginas" até pegar a lista completa,
// então nenhum produto fica invisível pro site.
async function listarTodasFotos(env) {
  let todas = []
  let cursor = undefined
  for (let seguranca = 0; seguranca < 20; seguranca++) {
    const pagina = await env.FOTOS.list({ limit: 1000, cursor })
    todas = todas.concat(pagina.keys)
    if (pagina.list_complete || !pagina.cursor) break
    cursor = pagina.cursor
  }
  return todas
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/produto/')) {
      return handleProdutoPage(request, url, env, ctx)
    }

    if (url.pathname.startsWith('/selecao/')) {
      return handleSelecaoPage(request, url, env, ctx)
    }

    if (url.pathname === '/api/produto') {
      return handleProduto(request, url, ctx)
    }

    if (url.pathname === '/api/estoque') {
      return handleEstoque(request, url, ctx)
    }

    if (url.pathname.startsWith('/produto-foto/')) {
      return handleServirFoto(url, env)
    }

    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      return handleAdminLogin(request, env)
    }

    if (url.pathname === '/api/admin/foto' && request.method === 'POST') {
      return handleAdminUploadFoto(request, env, ctx)
    }

    if (url.pathname === '/api/admin/foto/renomear' && request.method === 'POST') {
      return handleAdminRenomearFoto(request, env)
    }

    if (url.pathname === '/api/admin/foto' && request.method === 'DELETE') {
      return handleAdminExcluirFoto(request, url, env)
    }

    if (url.pathname === '/api/admin/fotos' && request.method === 'GET') {
      return handleAdminListarFotos(request, env)
    }

    if (url.pathname === '/api/fotos-publicas' && request.method === 'GET') {
      return handleFotosPublicas(env)
    }

    if (url.pathname === '/api/catalogo' && request.method === 'GET') {
      return handleCatalogoPronto(env, ctx)
    }

    if (url.pathname === '/api/catalogo-debug' && request.method === 'GET') {
      return handleCatalogoDebug(env)
    }

    if (url.pathname === '/api/catalogo-forcar' && request.method === 'GET') {
      return handleCatalogoForcar(env)
    }

    if (url.pathname === '/api/vendedores' && request.method === 'GET') {
      return handleVendedoresPublico(env)
    }

    if (url.pathname === '/api/admin/vendedores' && request.method === 'GET') {
      return handleAdminListarVendedores(request, env)
    }

    if (url.pathname === '/api/admin/vendedores' && request.method === 'POST') {
      return handleAdminSalvarVendedor(request, env)
    }

    if (url.pathname === '/api/admin/vendedores' && request.method === 'DELETE') {
      return handleAdminExcluirVendedor(request, url, env)
    }

    if (url.pathname === '/api/admin/planilha-generos' && request.method === 'POST') {
      return handleAdminSalvarPlanilhaGeneros(request, env)
    }

    if (url.pathname === '/api/admin/recalcular-categorias' && request.method === 'POST') {
      return handleAdminRecalcularCategorias(request, env)
    }

    if (url.pathname === '/api/admin/categoria-manual' && request.method === 'POST') {
      return handleAdminCategoriaManual(request, env)
    }

    if (url.pathname === '/api/admin/estoque-cadastrados' && request.method === 'GET') {
      return handleAdminEstoqueCadastrados(request, env)
    }

    if (url.pathname === '/ir-vendedor' && request.method === 'GET') {
      return handleIrVendedor(request, url, env)
    }
    if (url.pathname === '/api/selecao' && request.method === 'GET') {
  return handleObterSelecao(request, url, env)
    }
    if (url.pathname === '/ir-vendedor-carrinho' && request.method === 'GET') {
  return handleIrVendedorCarrinho(request, url, env)
    }

    // Qualquer outra rota: serve o site estático (React) normalmente,
    // mas força o navegador a nunca guardar o HTML principal em cache —
    // sem isso, quem já visitou o site uma vez pode ficar preso numa
    // versão antiga por dias, mesmo abrindo o link de novo.
    const respostaAssets = await env.ASSETS.fetch(request)
    if (url.pathname === '/' || url.pathname.endsWith('.html')) {
      const resposta = new Response(respostaAssets.body, respostaAssets)
      resposta.headers.set('Cache-Control', 'no-cache')
      return resposta
    }
    return respostaAssets
  },

  // Roda sozinho a cada 5 minutos (configurado no wrangler.jsonc). Consulta
  // a Mersan por conta própria pra todos os produtos cadastrados, deixando
  // o cache sempre "quente" — assim, quase ninguém precisa esperar a
  // consulta ao vivo pra Mersan, o catálogo abre rápido quase sempre.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(preAquecerCatalogoAgendado(env))
  }
}

// ---------- Produto / Estoque ----------

// Busca e normaliza os dados de um produto na API da Mersan. Usada tanto
// pelo endpoint JSON (/api/produto) quanto pela página do produto, que
// precisa desses dados para montar as meta tags de compartilhamento.
async function buscarDadosProdutoMersan(termo, signal) {
  const mersanUrl = `${MERSAN_BASE}/buscapreco/${encodeURIComponent(termo)}/${LOJA}`

  const resp = await fetch(mersanUrl, {
    headers: { Accept: 'application/json' },
    signal
  })

  if (!resp.ok) {
    throw new Error(`A API da Mersan retornou status ${resp.status}.`)
  }

  const dados = await resp.json()
  const lista = Array.isArray(dados?.precos) ? dados.precos : []

  if (lista.length === 0) {
    throw new Error('Produto não encontrado.')
  }

  const item = lista.find((p) => p.cdEmpresa === LOJA) || lista[0]

  // A matriz (empresa 1) cadastra promoções que valem pra todas as lojas,
  // mas às vezes a linha específica da loja 261 ainda não reflete esse
  // preço promocional (fica com vlPrecoPromocao zerado mesmo a promoção
  // estando ativa). Nesses casos, usamos o preço promocional da matriz
  // mesmo assim — o preço normal e todo o resto continuam vindo da 261.
  const itemMatriz = lista.find((p) => p.cdEmpresa === 1)
  let precoPromocao = item.vlPrecoPromocao
  if ((!precoPromocao || precoPromocao <= 0) && itemMatriz?.vlPrecoPromocao > 0) {
    precoPromocao = itemMatriz.vlPrecoPromocao
  }

  const emPromocao = precoPromocao > 0 && precoPromocao < item.vlPreco

  return {
    referencia: item.cdReferencia,
    nome: item.dsProduto,
    cor: item.cdCor,
    tamanho: item.dsTamanho,
    preco: emPromocao ? precoPromocao : item.vlPreco,
    precoOriginal: item.vlPreco,
    emPromocao,
    codigoBarras: item.cdProduto,
    codigoSku: item.cdSKU
  }
}

// Lê o instante em que uma entrada do cache de borda foi gravada (guardado
// num cabeçalho próprio na própria resposta cacheada) e devolve a idade dela
// em segundos. Sem o cabeçalho (não deveria acontecer, mas é defensivo),
// trata como "muito velha" pra forçar revalidação em vez de confiar cego.
function idadeDoCacheEmSegundos(respostaCache) {
  const timestamp = respostaCache.headers.get('X-Cache-Atualizado-Em')
  if (!timestamp) return Infinity
  const idadeMs = Date.now() - new Date(timestamp).getTime()
  return idadeMs / 1000
}

async function handleProduto(request, url, ctx) {
  const termo = url.searchParams.get('termo')

  if (!termo) {
    return jsonResponse({ error: 'Parâmetro "termo" é obrigatório.' }, 400)
  }

  // Modo de depuração temporário: mostra a resposta BRUTA da Mersan, sem
  // nenhum filtro nosso, pra investigar divergência de preço promocional.
  if (url.searchParams.has('debug')) {
    const mersanUrl = `${MERSAN_BASE}/buscapreco/${encodeURIComponent(termo)}/${LOJA}`
    const resp = await fetch(mersanUrl, { headers: { Accept: 'application/json' } })
    const texto = await resp.text()
    return new Response(texto, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const cache = caches.default
  const cacheKey = new Request(url.toString(), request)

  const cached = await cache.match(cacheKey)
  if (cached) {
    // Cache "velho, mas ainda dentro do teto": devolve na hora pro cliente e
    // busca a versão nova em segundo plano, sem ninguém esperar por isso.
    if (idadeDoCacheEmSegundos(cached) > CACHE_TTL_SOFT_SECONDS) {
      ctx.waitUntil(revalidarProdutoEmSegundoPlano(termo, cache, cacheKey))
    }
    return cached
  }

  let payload
  try {
    payload = await buscarDadosProdutoMersan(termo)
  } catch (err) {
    const status = err.message === 'Produto não encontrado.' ? 404 : 502
    return jsonResponse({ error: err.message }, status)
  }

  const response = jsonResponse(payload, 200, {
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    'X-Cache-Atualizado-Em': new Date().toISOString()
  })

  ctx.waitUntil(cache.put(cacheKey, response.clone()))

  return response
}

// Reaproveitada tanto por um cache "velho, mas usável" (revalidação em
// segundo plano) quanto poderia ser por outros gatilhos no futuro. Se a
// Mersan falhar aqui, não faz nada — a entrada antiga do cache continua
// valendo até o teto normal ou até a próxima tentativa.
async function revalidarProdutoEmSegundoPlano(termo, cache, cacheKey) {
  try {
    const payload = await buscarDadosProdutoMersan(termo)
    const response = jsonResponse(payload, 200, {
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      'X-Cache-Atualizado-Em': new Date().toISOString()
    })
    await cache.put(cacheKey, response)
  } catch {
    // Sem fallback nesta fase (fora de escopo) — só não atualiza agora.
  }
}

// Busca o estoque bruto da Mersan e já consolida por tamanho: se a mesma
// numeração aparecer em mais de uma linha (comum na resposta da Mersan),
// soma as quantidades e devolve só UM item por tamanho — o cliente nunca
// vê duplicidade, e a quantidade somada só serve internamente pra saber
// se aquele tamanho está disponível ou não.
//
// IMPORTANTE: a "referência" da Mersan às vezes é COMPARTILHADA entre
// cores diferentes do mesmo modelo (confirmado ao vivo: referência
// "001 540 ARM232" tem as cores PRETO e OCRE, com grades de tamanho
// diferentes). Por isso, sempre que soubermos a cor do item, filtramos
// também por ela (campo "ds_cor" na resposta bruta) — sem isso, o estoque
// de uma cor "vaza" para a página da outra cor.
async function buscarEstoqueMersan(referencia, cor, signal) {
  const mersanUrl = `${MERSAN_BASE}/buscapreco/estoque/${encodeURIComponent(referencia)}/${LOJA}`

  const resp = await fetch(mersanUrl, {
    headers: { Accept: 'application/json' },
    signal
  })

  if (!resp.ok) {
    throw new Error(`A API da Mersan retornou status ${resp.status}.`)
  }

  const registros = await resp.json()
  const lista = Array.isArray(registros) ? registros : [registros]
  const corAlvo = cor ? String(cor).trim().toUpperCase() : null

  const porTamanho = new Map()
  for (const item of lista) {
    if (!item || item.cd_empresa !== LOJA || Number(item.qt_stock) <= 0) continue
    if (corAlvo && String(item.ds_cor || '').trim().toUpperCase() !== corAlvo) continue
    const tamanho = item.ds_tamanho
    porTamanho.set(tamanho, (porTamanho.get(tamanho) || 0) + Number(item.qt_stock))
  }

  return Array.from(porTamanho.entries())
    .map(([tamanho, pares]) => ({ tamanho, pares }))
    .sort((a, b) => parseFloat(a.tamanho) - parseFloat(b.tamanho))
}

async function handleEstoque(request, url, ctx) {
  const referencia = url.searchParams.get('referencia')
  const cor = url.searchParams.get('cor')

  if (!referencia) {
    return jsonResponse({ error: 'Parâmetro "referencia" é obrigatório.' }, 400)
  }

  const cache = caches.default
  const cacheKey = new Request(url.toString(), request)

  const cached = await cache.match(cacheKey)
  if (cached) {
    // Mesmo princípio do produto: serve o que já tem e revalida em segundo
    // plano se estiver velho, sem travar a resposta pro cliente.
    if (idadeDoCacheEmSegundos(cached) > CACHE_TTL_SOFT_SECONDS) {
      ctx.waitUntil(revalidarEstoqueEmSegundoPlano(referencia, cor, cache, cacheKey))
    }
    return cached
  }

  let estoqueLoja261
  try {
    estoqueLoja261 = await buscarEstoqueMersan(referencia, cor)
  } catch {
    return jsonResponse(
      { error: 'Não foi possível conectar à API da Mersan.' },
      502
    )
  }

  const payload = {
    referencia,
    loja: LOJA,
    estoque: estoqueLoja261,
    atualizadoEm: new Date().toISOString()
  }

  const response = jsonResponse(payload, 200, {
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    'X-Cache-Atualizado-Em': new Date().toISOString()
  })

  ctx.waitUntil(cache.put(cacheKey, response.clone()))

  return response
}

// Mesmo padrão de revalidarProdutoEmSegundoPlano, só que pro estoque. Se a
// Mersan falhar, não faz nada — a entrada antiga do cache continua valendo
// até o teto normal ou até a próxima tentativa.
async function revalidarEstoqueEmSegundoPlano(referencia, cor, cache, cacheKey) {
  try {
    const estoqueLoja261 = await buscarEstoqueMersan(referencia, cor)
    const payload = {
      referencia,
      loja: LOJA,
      estoque: estoqueLoja261,
      atualizadoEm: new Date().toISOString()
    }
    const response = jsonResponse(payload, 200, {
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      'X-Cache-Atualizado-Em': new Date().toISOString()
    })
    await cache.put(cacheKey, response)
  } catch {
    // Sem fallback nesta fase (fora de escopo) — só não atualiza agora.
  }
}

// ---------- Página do produto com Open Graph dinâmico (Etapa 4) ----------
//
// O WhatsApp (e Facebook, etc.) não executa JavaScript ao gerar a prévia de
// um link — ele só lê o HTML bruto. Por isso, para a prévia mostrar a foto
// e o nome certos de cada produto, o próprio servidor (aqui) precisa
// devolver o HTML já com as meta tags corretas, antes do React assumir a
// tela no navegador da pessoa.

async function handleProdutoPage(request, url, env, ctx) {
  const codigo = decodeURIComponent(url.pathname.replace('/produto/', ''))

  // Cache de 30 minutos por produto: sem isso, toda pessoa que abre a
  // mesma página consultava a API da Mersan de novo, deixando o
  // carregamento lento. Com o cache, só a primeira pessoa em cada janela
  // de 30 minutos espera a consulta real.
  const cache = caches.default
  const cacheKey = new Request(url.toString(), request)

  const cached = await cache.match(cacheKey)
  if (cached) {
    return cached
  }

  // Pega o HTML base (o mesmo que o site inteiro usa) para depois trocar
  // só as meta tags de compartilhamento.
  const baseRequest = new Request(new URL('/', request.url), request)
  const htmlResp = await env.ASSETS.fetch(baseRequest)
  let html = await htmlResp.text()

  if (!codigo) {
    return new Response(html, htmlResp)
  }

  let dadosProduto = null
  try {
    dadosProduto = await buscarDadosProdutoMersan(codigo)
  } catch {
    // Sem dados: a página carrega normalmente e o React mostra o erro
    // (ou "não encontrado") do lado do cliente. As meta tags ficam padrão.
    return new Response(html, htmlResp)
  }

  const titulo = `${dadosProduto.nome} - Mersan Calçados`
  const descricao = 'Mersan Calçados • Loja 261'
  // Usa sempre o código da própria URL — é exatamente o mesmo código usado
  // no cadastro da foto (a chave no KV). Usar o código de barras que a
  // Mersan retorna aqui era o bug que fazia a prévia do WhatsApp falhar em
  // alguns produtos: quando o admin cadastra pela referência (ou qualquer
  // código diferente do "cdProduto" oficial), os dois divergiam e a busca
  // da foto dava 404 nesse momento específico (o resto do site sempre
  // funcionou, porque em todo outro lugar já se usa o código da URL).
  const chaveFoto = normalizarCodigo(codigo)
  const imagemUrl = `${url.origin}/produto-foto/${encodeURIComponent(chaveFoto)}`

  html = html
    .replace(
      '<title>Mersan Calçados - Catálogo Loja 261</title>',
      `<title>${escapeHtml(titulo)}</title>`
    )
    .replaceAll(
      'content="Mersan Calçados • Loja 261"',
      `content="${escapeHtml(titulo)}"`
    )
    .replaceAll(
      'content="Consulte produtos e estoque da Mersan Calçados - Loja 261"',
      `content="${escapeHtml(descricao)}"`
    )
    .replace(
      '<meta property="og:image" content="https://mersan-catalogo.mersancalcados.workers.dev/og-image.png" />',
      `<meta property="og:image" content="${imagemUrl}" />\n    <meta property="og:image:type" content="image/jpeg" />`
    )

  const response = new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
    }
  })

  ctx.waitUntil(cache.put(cacheKey, response.clone()))

  return response
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// Prévia (Open Graph) da página de "minha seleção" (1 ou mais produtos
// escolhidos, seja pelo carrinho ou pelo botão comprar de um produto só).
// Sem essa função, o link caía direto no site estático (React), que só
// tem as meta tags genéricas — por isso a prévia do WhatsApp tinha
// parado de mostrar a foto do produto.
async function handleSelecaoPage(request, url, env, ctx) {
  const id = url.pathname.replace('/selecao/', '').split('/')[0]

  const baseRequest = new Request(new URL('/', request.url), request)
  const htmlResp = await env.ASSETS.fetch(baseRequest)
  let html = await htmlResp.text()

  if (!id) {
    return new Response(html, htmlResp)
  }

  const selecao = await getSelecao(env, id)
  if (!selecao || !Array.isArray(selecao.itens) || selecao.itens.length === 0) {
    return new Response(html, htmlResp)
  }

  const quantidade = selecao.itens.length
  const titulo =
    quantidade === 1
      ? 'Minha seleção (1 produto) - Mersan Calçados'
      : `Minha seleção (${quantidade} produtos) - Mersan Calçados`
  const descricao = 'Mersan Calçados • Loja 261'
  const chaveFoto = normalizarCodigo(selecao.itens[0].codigo)
  const imagemUrl = `${url.origin}/produto-foto/${encodeURIComponent(chaveFoto)}`

  html = html
    .replace(
      '<title>Mersan Calçados - Catálogo Loja 261</title>',
      `<title>${escapeHtml(titulo)}</title>`
    )
    .replaceAll(
      'content="Mersan Calçados • Loja 261"',
      `content="${escapeHtml(titulo)}"`
    )
    .replaceAll(
      'content="Consulte produtos e estoque da Mersan Calçados - Loja 261"',
      `content="${escapeHtml(descricao)}"`
    )
    .replace(
      '<meta property="og:image" content="https://mersan-catalogo.mersancalcados.workers.dev/og-image.png" />',
      `<meta property="og:image" content="${imagemUrl}" />\n    <meta property="og:image:type" content="image/jpeg" />`
    )

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  })
}

// ---------- Fotos (Etapa 3) ----------
// Usando Workers KV em vez de R2: funciona no plano gratuito do Cloudflare
// sem exigir cartão de crédito cadastrado. Limite gratuito: 1GB de
// armazenamento e milhares de fotos (recomenda-se manter cada foto
// comprimida/redimensionada antes do envio — o painel já faz isso sozinho).

function normalizarCodigo(codigo) {
  return codigo.trim().replace(/\s+/g, '_')
}

// A referência que vem da Mersan às vezes traz o número do calçado colado
// no final (ex: "001 145 8106-41"). Para o cliente, mostramos só a parte
// fixa da referência, sem esse sufixo de tamanho.
function referenciaParaCliente(referencia) {
  if (!referencia) return referencia
  return referencia.replace(/[-\s]\d{2,3}$/, '').trim()
}

async function handleServirFoto(url, env) {
  const codigo = decodeURIComponent(url.pathname.replace('/produto-foto/', ''))
  const chave = normalizarCodigo(codigo)

  const resultado = await env.FOTOS.getWithMetadata(chave, 'arrayBuffer')

  if (!resultado || !resultado.value) {
    return new Response('Foto não encontrada', { status: 404 })
  }

  return new Response(resultado.value, {
    headers: {
      'Content-Type': resultado.metadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400' // 1 dia
    }
  })
}

function autenticado(request, env) {
  const senha = request.headers.get('X-Admin-Password')
  return Boolean(env.ADMIN_PASSWORD) && senha === env.ADMIN_PASSWORD
}

async function handleAdminLogin(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }
  return jsonResponse({ ok: true })
}

// Prazo máximo que o enriquecimento em segundo plano espera por cada
// chamada à Mersan antes de desistir e registrar o timeout. Generosos o
// bastante pra não estourar em condições normais (medido ao vivo: produto
// tem média de 1,8s/pico 4,1s; estoque tem média de 11s/pico 26,5s e ~20%
// de falha) — só existem pra não deixar a tarefa em segundo plano pendurada
// indefinidamente se a Mersan estiver realmente fora do ar.
const TIMEOUT_PRODUTO_NOVO_MS = 8000
const TIMEOUT_ESTOQUE_NOVO_MS = 20000
const LOG_TIMEOUTS_MERSAN_CHAVE = '_catalogo_log_timeouts_mersan'

async function lerCategoriaAtual(env, chave) {
  try {
    const atual = await env.FOTOS.getWithMetadata(chave, 'arrayBuffer')
    return {
      categoria: atual?.metadata?.categoria || '',
      categoriaManual: Boolean(atual?.metadata?.categoriaManual)
    }
  } catch {
    return { categoria: '', categoriaManual: false }
  }
}

// Grava a ocorrência do timeout no console (visível em "wrangler tail"/nos
// logs da Cloudflare) e também um contador simples no KV, pra dar pra
// acompanhar a frequência ao longo do tempo sem precisar estar com o log
// aberto no momento exato em que acontece. Prefixo "_catalogo_" de propósito
// — é o mesmo prefixo que já é ignorado em todo lugar que lista fotos de
// produto (listarTodasFotos + filtros), então esta chave nunca aparece
// como se fosse um produto cadastrado.
async function registrarTimeoutMersan(env, tipo, codigo) {
  console.error(`[cadastro-foto] timeout consultando a Mersan (${tipo}) — código ${codigo}`)
  try {
    const bruto = await env.FOTOS.get(LOG_TIMEOUTS_MERSAN_CHAVE)
    const contagem = bruto ? JSON.parse(bruto) : {}
    contagem[tipo] = (contagem[tipo] || 0) + 1
    contagem.ultimoCodigo = codigo
    contagem.ultimoTipo = tipo
    contagem.ultimoEm = new Date().toISOString()
    await env.FOTOS.put(LOG_TIMEOUTS_MERSAN_CHAVE, JSON.stringify(contagem))
  } catch {
    // O log é best-effort — nunca deixa o enriquecimento quebrar por causa dele.
  }
}

// Roda em segundo plano, DEPOIS que a foto já foi salva e o cliente já
// recebeu a resposta de sucesso. Busca nome/preço/categoria/estoque na
// Mersan com prazo (ver TIMEOUT_*_NOVO_MS acima); se estourar, registra e
// desiste — o produto fica sem esses dados até o próximo ciclo do
// aquecimento automático, que roda de qualquer forma a cada 5 minutos e
// tenta de novo.
async function enriquecerFotoNovaEmSegundoPlano(env, chave) {
  let dadosProduto = null
  let categoria = ''

  const controladorProduto = new AbortController()
  const tempoLimiteProduto = setTimeout(() => controladorProduto.abort(), TIMEOUT_PRODUTO_NOVO_MS)
  try {
    dadosProduto = await buscarDadosProdutoMersan(chave, controladorProduto.signal)
    const indice = indexarCategoriasPorCodigo(await getCategoriasPlanilha(env))
    const daPlanilha = indice[normalizarCodigoInterno(dadosProduto.codigoSku)]
    if (daPlanilha) categoria = daPlanilha
  } catch (err) {
    if (err?.name === 'AbortError') {
      await registrarTimeoutMersan(env, 'produto', chave)
    }
    return
  } finally {
    clearTimeout(tempoLimiteProduto)
  }

  try {
    const fotoAtual = await env.FOTOS.getWithMetadata(chave, 'arrayBuffer')
    if (fotoAtual && fotoAtual.value) {
      await env.FOTOS.put(chave, fotoAtual.value, {
        metadata: {
          contentType: fotoAtual.metadata?.contentType || 'image/jpeg',
          tamanho: fotoAtual.metadata?.tamanho || fotoAtual.value.byteLength,
          categoria
        }
      })
    }
  } catch {
    // Se falhar aqui, o próximo ciclo do aquecimento tenta de novo.
  }

  if (!dadosProduto.referencia || dadosProduto.referencia.includes('não encontrado')) return

  const controladorEstoque = new AbortController()
  const tempoLimiteEstoque = setTimeout(() => controladorEstoque.abort(), TIMEOUT_ESTOQUE_NOVO_MS)
  try {
    const estoque = await buscarEstoqueMersan(dadosProduto.referencia, dadosProduto.cor, controladorEstoque.signal)
    const estoqueTotal = estoque.reduce((soma, i) => soma + (i.pares || 0), 0)
    if (estoqueTotal > 0) {
      await upsertCatalogoNovo(env, {
        codigo: chave,
        categoria,
        codigoSku: dadosProduto.codigoSku,
        promocao: dadosProduto.emPromocao,
        nome: dadosProduto.nome,
        tamanho: dadosProduto.tamanho,
        preco: dadosProduto.preco,
        precoOriginal: dadosProduto.precoOriginal,
        referencia: dadosProduto.referencia,
        cor: dadosProduto.cor,
        estoqueTotal
      })
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      await registrarTimeoutMersan(env, 'estoque', chave)
    }
  } finally {
    clearTimeout(tempoLimiteEstoque)
  }
}

async function handleAdminUploadFoto(request, env, ctx) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const form = await request.formData()
  const codigo = form.get('codigo')
  const arquivo = form.get('arquivo')

  if (!codigo || !arquivo) {
    return jsonResponse({ error: 'Envie "codigo" e "arquivo".' }, 400)
  }

  const chave = normalizarCodigo(codigo)
  const bytes = await arquivo.arrayBuffer()

  // Limite de segurança: o KV aceita até 25MB por valor.
  if (bytes.byteLength > 24 * 1024 * 1024) {
    return jsonResponse({ error: 'Arquivo grande demais (máximo 24MB).' }, 400)
  }

  // Salva a foto IMEDIATAMENTE, sem esperar a Mersan responder — a consulta
  // de nome/preço/estoque pode demorar até ~26s e falhar em ~1 a cada 5
  // tentativas (medido ao vivo contra a API da Mersan), e não pode segurar
  // o "Salvar". Isso acontece depois, em segundo plano
  // (enriquecerFotoNovaEmSegundoPlano): categoria e estoque chegam assim
  // que a Mersan responder, ou no próximo ciclo do aquecimento automático
  // (a cada 5 min) se ela não responder a tempo — o mesmo caminho que
  // qualquer produto novo já segue hoje.
  //
  // Se este código já tinha foto cadastrada (edição de foto existente),
  // mantém a categoria que já estava salva em vez de zerar — evita que uma
  // simples troca de imagem "perca" a categoria por alguns instantes.
  const { categoria: categoriaAnterior, categoriaManual: categoriaManualAnterior } = await lerCategoriaAtual(env, chave)

  await env.FOTOS.put(chave, bytes, {
    metadata: {
      contentType: arquivo.type || 'image/jpeg',
      tamanho: bytes.byteLength,
      categoria: categoriaAnterior,
      categoriaManual: categoriaManualAnterior
    }
  })

  ctx.waitUntil(enriquecerFotoNovaEmSegundoPlano(env, chave))

  return jsonResponse({ ok: true, codigo: chave })
}

// Muda o código/referência de uma foto já cadastrada, sem trocar a imagem.
// Como o KV usa o código como chave, "renomear" aqui significa: ler os
// bytes+metadata da chave antiga e regravar na chave nova, depois apagar
// a antiga.
async function handleAdminRenomearFoto(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const corpo = await request.json().catch(() => null)
  const codigoAntigo = corpo?.codigoAntigo
  const codigoNovo = corpo?.codigoNovo

  if (!codigoAntigo || !codigoNovo) {
    return jsonResponse({ error: 'Envie "codigoAntigo" e "codigoNovo".' }, 400)
  }

  const chaveAntiga = normalizarCodigo(codigoAntigo)
  const chaveNova = normalizarCodigo(codigoNovo)

  if (chaveAntiga === chaveNova) {
    return jsonResponse({ ok: true, codigo: chaveNova })
  }

  const resultado = await env.FOTOS.getWithMetadata(chaveAntiga, 'arrayBuffer')
  if (!resultado || !resultado.value) {
    return jsonResponse({ error: 'Foto não encontrada para o código atual.' }, 404)
  }

  const jaExiste = await env.FOTOS.get(chaveNova)
  if (jaExiste) {
    return jsonResponse(
      { error: 'Já existe uma foto cadastrada com essa referência. Exclua a antiga primeiro se quiser substituir.' },
      409
    )
  }

  await env.FOTOS.put(chaveNova, resultado.value, {
    metadata: resultado.metadata || {}
  })
  await env.FOTOS.delete(chaveAntiga)

  return jsonResponse({ ok: true, codigo: chaveNova })
}

async function handleAdminExcluirFoto(request, url, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const codigo = url.searchParams.get('codigo')
  if (!codigo) {
    return jsonResponse({ error: 'Parâmetro "codigo" é obrigatório.' }, 400)
  }

  const chave = normalizarCodigo(codigo)
  await env.FOTOS.delete(chave)

  // Tira o produto do catálogo na hora, sem esperar o próximo ciclo de
  // aquecimento — tanto da gaveta de "recém-cadastrados" (se ele tiver
  // sido excluído antes mesmo de ser varrido por um lote) quanto de
  // qualquer lote onde ele já tenha entrado.
  const novos = await getCatalogoNovos(env)
  if (novos.some((p) => p.codigo === chave)) {
    await env.FOTOS.put(CATALOGO_NOVOS_CHAVE, JSON.stringify(novos.filter((p) => p.codigo !== chave)))
  }

  const indiceBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)
  const totalLotes = indiceBruto ? JSON.parse(indiceBruto).totalLotes || 0 : 0
  if (totalLotes > 0) {
    const lotesBrutos = await Promise.all(
      Array.from({ length: totalLotes }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
    )
    for (let i = 0; i < lotesBrutos.length; i++) {
      if (!lotesBrutos[i]) continue
      const lista = JSON.parse(lotesBrutos[i])
      if (lista.some((p) => p.codigo === chave)) {
        await env.FOTOS.put(`${CATALOGO_LOTE_PREFIXO}${i}`, JSON.stringify(lista.filter((p) => p.codigo !== chave)))
        break
      }
    }
  }

  return jsonResponse({ ok: true })
}

async function handleAdminListarFotos(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const chavesFotos = await listarTodasFotos(env)
  const fotos = chavesFotos
    .filter(
      (k) =>
        k.name !== VENDEDORES_CHAVE &&
        k.name !== CATALOGO_CACHE_CHAVE &&
        k.name !== CATALOGO_CURSOR_CHAVE &&
        k.name !== CATEGORIAS_PLANILHA_CHAVE &&
        k.name !== CATALOGO_NOVOS_CHAVE &&
        !k.name.startsWith('_catalogo') &&
        !k.name.startsWith(SELECOES_PREFIXO)
    )
    .map((k) => ({
      codigo: k.name,
      tamanho: k.metadata?.tamanho || null,
      categoria: k.metadata?.categoria || '',
      categoriaManual: Boolean(k.metadata?.categoriaManual),
      modificadoEm: k.metadata?.atualizadoEm || null
    }))

  return jsonResponse({ fotos, truncado: false })
}

// ---------- Vitrine pública (lista de fotos, sem senha) ----------

async function handleFotosPublicas(env) {
  const chavesFotos = await listarTodasFotos(env)
  const produtos = chavesFotos
    .filter((k) => k.name !== VENDEDORES_CHAVE && k.name !== CATALOGO_CACHE_CHAVE)
    .map((k) => ({
      codigo: k.name,
      categoria: k.metadata?.categoria || ''
    }))

  return jsonResponse({ produtos, truncado: false })
}

// ---------- Vendedores ----------
// Guardados como uma lista única em JSON dentro do mesmo KV das fotos,
// numa chave reservada que nunca é usada como código de produto.

const VENDEDORES_CHAVE = '_vendedores'
const SELECOES_PREFIXO = '_selecao_'

// Toda chave do KV que NÃO é a foto de um produto de verdade. Usada pelo
// pré-aquecimento (preAquecerCatalogoLote) e pelo debug (handleCatalogoDebug)
// pra saber quais chaves ignorar. Antes, os dois só excluíam VENDEDORES_CHAVE
// e o prefixo "_catalogo" — as chaves "_selecao_..." (um link novo a cada
// clique em "Falar com o vendedor") e "_categorias_planilha" entravam junto
// como se fossem produtos, e cada uma delas gastava uma vaga inteira num
// lote tentando "atualizar" um código que nunca vai existir na Mersan.
// Confirmado ao vivo: 119 das 278 chaves do KV eram "_selecao_..." — quase
// metade do catálogo pré-aquecido era lixo, o que multiplicava o tempo pra
// um produto de verdade ser atualizado de novo (e, consequentemente, o
// tempo de espera do cliente quando o cache já tinha expirado).
function ehChaveDeProduto(nome) {
  return (
    nome !== VENDEDORES_CHAVE &&
    nome !== CATEGORIAS_PLANILHA_CHAVE &&
    !nome.startsWith('_catalogo') &&
    !nome.startsWith(SELECOES_PREFIXO)
  )
}

function gerarIdSelecao() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
}

// Sem expirationTtl, cada clique em "Falar com o vendedor" criava uma
// chave nova que nunca mais saía do KV. Com o tempo, essas chaves passaram
// a ser a maioria (confirmado ao vivo: 119 de 278 chaves eram "_selecao_"),
// e o pré-aquecimento do catálogo (preAquecerCatalogoLote) as contava junto
// com produtos de verdade — cada uma delas some, um lote inteiro era gasto
// tentando "atualizar" um link que nunca existiu na Mersan, atrasando a
// atualização real dos produtos e fazendo o cliente esperar bem mais na
// tela do produto. 30 dias é tempo de sobra pra qualquer link de WhatsApp
// já compartilhado ter sido aberto.
const SELECAO_TTL_SEGUNDOS = 30 * 24 * 60 * 60 // 30 dias

async function salvarSelecao(env, itens) {
  const id = gerarIdSelecao()
  await env.FOTOS.put(
    `${SELECOES_PREFIXO}${id}`,
    JSON.stringify({ itens, criadoEm: new Date().toISOString() }),
    { expirationTtl: SELECAO_TTL_SEGUNDOS }
  )
  return id
}

async function getSelecao(env, id) {
  const bruto = await env.FOTOS.get(`${SELECOES_PREFIXO}${id}`)
  if (!bruto) return null
  try {
    return JSON.parse(bruto)
  } catch {
    return null
  }
}

async function handleObterSelecao(request, url, env) {
  const id = url.searchParams.get('id')
  if (!id) {
    return jsonResponse({ error: 'Parâmetro "id" é obrigatório.' }, 400)
  }
  const selecao = await getSelecao(env, id)
  if (!selecao) {
    return jsonResponse({ error: 'Seleção não encontrada.' }, 404)
  }
  return jsonResponse(selecao, 200)
}

async function getVendedores(env) {
  const bruto = await env.FOTOS.get(VENDEDORES_CHAVE)
  if (!bruto) return []
  try {
    const lista = JSON.parse(bruto)
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

async function salvarVendedores(env, lista) {
  await env.FOTOS.put(VENDEDORES_CHAVE, JSON.stringify(lista))
}

// Lista pública: só nome e id, nunca o WhatsApp (fica só no servidor).
async function handleVendedoresPublico(env) {
  const lista = await getVendedores(env)
  const publico = lista.map((v) => ({ id: v.id, nome: v.nome }))
  return jsonResponse({ vendedores: publico })
}

async function handleAdminListarVendedores(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }
  const lista = await getVendedores(env)
  return jsonResponse({ vendedores: lista })
}

async function handleAdminSalvarVendedor(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const corpo = await request.json().catch(() => null)
  const nome = corpo?.nome?.trim()
  const whatsapp = corpo?.whatsapp?.replace(/\D/g, '') // só dígitos

  if (!nome || !whatsapp) {
    return jsonResponse({ error: 'Envie "nome" e "whatsapp".' }, 400)
  }

  const lista = await getVendedores(env)
  const id = corpo?.id || crypto.randomUUID()
  const existente = lista.findIndex((v) => v.id === id)
  const registro = { id, nome, whatsapp }

  if (existente >= 0) {
    lista[existente] = registro
  } else {
    lista.push(registro)
  }

  await salvarVendedores(env, lista)
  return jsonResponse({ ok: true, vendedor: registro })
}

// ---------- Categorias por planilha de gênero/faixa etária ----------
// O navegador já manda o mapa PRONTO (código -> categoria), calculado a
// partir da planilha que a loja baixa do sistema de estoque. Aqui só
// guardamos esse mapa inteiro como UM bloco único no KV — não como um
// item por código — porque o plano gratuito do Cloudflare só permite 1.000
// gravações por dia; se cada código virasse uma gravação, planilhas de
// dezenas de milhares de itens estourariam esse limite na hora.

const CATEGORIAS_PLANILHA_CHAVE = '_categorias_planilha'

// O "Código" da planilha e o codigoSku da Mersan são o mesmo identificador
// interno, mas podem chegar com formatações diferentes (texto x número,
// espaços, zeros à esquerda, caracteres invisíveis). Normalizamos os dois
// lados antes de comparar — nunca comparamos por nome ou descrição.
function normalizarCodigoInterno(valor) {
  // O Excel costuma exportar coluna numérica como texto com ".0" no final
  // (ex: "12345.0"). Sem remover isso antes, o ponto seria descartado junto
  // com os outros não-dígitos e "12345.0" viraria "123450" — um código
  // diferente do "12345" real, quebrando o cruzamento com a Mersan.
  const semSufixoDecimal = String(valor ?? '').trim().replace(/\.0+$/, '')
  const digitos = semSufixoDecimal.replace(/\D/g, '')
  return digitos.replace(/^0+/, '') || digitos
}

function indexarCategoriasPorCodigo(mapa) {
  const indice = {}
  for (const codigo of Object.keys(mapa || {})) {
    const chave = normalizarCodigoInterno(codigo)
    if (chave) indice[chave] = mapa[codigo]
  }
  return indice
}

async function getCategoriasPlanilha(env) {
  const bruto = await env.FOTOS.get(CATEGORIAS_PLANILHA_CHAVE)
  if (!bruto) return {}
  try {
    const mapa = JSON.parse(bruto)
    return mapa && typeof mapa === 'object' ? mapa : {}
  } catch {
    return {}
  }
}

async function salvarCategoriasPlanilha(env, mapa) {
  await env.FOTOS.put(CATEGORIAS_PLANILHA_CHAVE, JSON.stringify(mapa))
}

// Substitui o mapa inteiro a cada envio — a loja sempre manda a planilha
// completa (não só os itens novos), então não há necessidade de mesclar
// com o que já existia; a versão nova já é a fonte de verdade completa.
// Depois de salvar, já reaplica a planilha nova em cima de todos os
// produtos já cadastrados (mesma lógica do botão "Recalcular categorias")
// — categoria nunca fica presa numa planilha antiga esperando um clique
// manual extra ou o próximo ciclo do cron.
async function handleAdminSalvarPlanilhaGeneros(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const corpo = await request.json().catch(() => null)
  const mapa = corpo?.mapa

  if (!mapa || typeof mapa !== 'object') {
    return jsonResponse({ error: 'Envie "mapa" (código -> categoria).' }, 400)
  }

  await salvarCategoriasPlanilha(env, mapa)
  const resultadoRecalculo = await recalcularCategoriasInterno(env)

  return jsonResponse({
    ok: true,
    totalCodigos: Object.keys(mapa).length,
    recalculo: resultadoRecalculo
  })
}

// Aplica a planilha já carregada em cima dos produtos que JÁ estão
// cadastrados (fotos existentes), sem precisar recadastrar nada. Só
// reescreve a foto (mesmos bytes, metadata nova) quando a categoria
// realmente muda — evita gravações desnecessárias no KV.
async function recalcularCategoriasInterno(env) {
  const indice = indexarCategoriasPorCodigo(await getCategoriasPlanilha(env))

  // O código usado pra cadastrar a foto (código de barras) não é o mesmo
  // "Código" da planilha (que é o SKU interno da Mersan). Cruzamos usando
  // o codigoSku que já fica guardado nos lotes do catálogo pronto — sem
  // precisar consultar a Mersan de novo aqui.
  const indiceBrutoCatalogo = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)
  const totalLotesCatalogo = indiceBrutoCatalogo ? JSON.parse(indiceBrutoCatalogo).totalLotes || 0 : 0
  const lotesGuardados = await Promise.all(
    Array.from({ length: totalLotesCatalogo }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
  )
  const skuPorCodigo = {}
  for (const bruto of lotesGuardados) {
    if (!bruto) continue
    for (const produto of JSON.parse(bruto)) {
      if (produto.codigoSku) skuPorCodigo[produto.codigo] = String(produto.codigoSku)
    }
  }

  const chavesFotos = await listarTodasFotos(env)
  const fotos = chavesFotos.filter(
    (k) =>
      k.name !== VENDEDORES_CHAVE &&
      k.name !== CATALOGO_CACHE_CHAVE &&
      k.name !== CATALOGO_CURSOR_CHAVE &&
      k.name !== CATEGORIAS_PLANILHA_CHAVE &&
      !k.name.startsWith('_catalogo') &&
      !k.name.startsWith(SELECOES_PREFIXO)
  )

  let atualizados = 0
  let encontrados = 0
  let semSku = 0
  let protegidosPorCategoriaManual = 0

  for (const chaveInfo of fotos) {
    if (chaveInfo.metadata?.categoriaManual) { protegidosPorCategoriaManual++; continue }

    const sku = skuPorCodigo[chaveInfo.name]
    if (!sku) { semSku++; continue }

    // Mesma normalização usada na bipagem/cron (indexarCategoriasPorCodigo
    // + normalizarCodigoInterno) — antes este recálculo comparava o SKU
    // "cru" contra as chaves da planilha sem normalizar, então um código
    // com zero à esquerda ou formatação diferente casava na bipagem mas
    // deixava de casar aqui, ficando com categoria desatualizada.
    const categoriaNova = indice[normalizarCodigoInterno(sku)]
    if (!categoriaNova) continue
    encontrados++

    const categoriaAtual = chaveInfo.metadata?.categoria || ''
    if (categoriaAtual === categoriaNova) continue

    const resultado = await env.FOTOS.getWithMetadata(chaveInfo.name, 'arrayBuffer')
    if (!resultado || !resultado.value) continue

    await env.FOTOS.put(chaveInfo.name, resultado.value, {
      metadata: {
        contentType: resultado.metadata?.contentType || 'image/jpeg',
        tamanho: resultado.metadata?.tamanho || resultado.value.byteLength,
        categoria: categoriaNova
      }
    })
    atualizados++
  }

  return {
    totalFotos: fotos.length,
    encontradosNaPlanilha: encontrados,
    atualizados,
    semDadosDeSku: semSku,
    protegidosPorCategoriaManual
  }
}

async function handleAdminRecalcularCategorias(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const resultado = await recalcularCategoriasInterno(env)
  return jsonResponse({ ok: true, ...resultado })
}

// Aplica uma categoria escolhida à mão a um lote de produtos selecionados
// no painel admin. Marca categoriaManual=true, que protege esses produtos
// de serem sobrescritos depois por uma planilha nova ou por
// "Recalcular categorias" (ver preAquecerCatalogoLote e
// recalcularCategoriasInterno) — só volta a mudar se o admin escolher de
// novo por aqui.
async function handleAdminCategoriaManual(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const corpo = await request.json().catch(() => null)
  const codigos = Array.isArray(corpo?.codigos) ? corpo.codigos : null
  const categoria = typeof corpo?.categoria === 'string' ? corpo.categoria : null

  if (!codigos || codigos.length === 0 || !categoria) {
    return jsonResponse({ error: 'Envie "codigos" (lista) e "categoria".' }, 400)
  }

  let atualizados = 0
  let naoEncontrados = 0

  for (const codigo of codigos) {
    const resultado = await env.FOTOS.getWithMetadata(codigo, 'arrayBuffer')
    if (!resultado || !resultado.value) { naoEncontrados++; continue }

    await env.FOTOS.put(codigo, resultado.value, {
      metadata: {
        contentType: resultado.metadata?.contentType || 'image/jpeg',
        tamanho: resultado.metadata?.tamanho || resultado.value.byteLength,
        categoria,
        categoriaManual: true
      }
    })
    atualizados++
  }

  return jsonResponse({ ok: true, atualizados, naoEncontrados })
}

async function handleAdminExcluirVendedor(request, url, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const id = url.searchParams.get('id')
  if (!id) {
    return jsonResponse({ error: 'Parâmetro "id" é obrigatório.' }, 400)
  }

  const lista = await getVendedores(env)
  const nova = lista.filter((v) => v.id !== id)
  await salvarVendedores(env, nova)
  return jsonResponse({ ok: true })
}

// Uma página HTML mínima com um botão manual. É o último degrau de
// segurança: se por qualquer motivo o redirecionamento automático não
// puder ser feito, a pessoa ainda assim vê algo clicável, nunca uma tela
// genuinamente em branco.
function paginaLinkManual(linkWhatsApp, mensagemTopo) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mersan Calçados</title>
<meta http-equiv="refresh" content="0; url=${escapeHtml(linkWhatsApp)}">
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px 20px;">
  <p style="margin-bottom:24px;">${escapeHtml(mensagemTopo)}</p>
  <a href="${escapeHtml(linkWhatsApp)}" style="display:inline-block;padding:14px 28px;background:#25D366;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">
    Abrir WhatsApp
  </a>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  })
}



async function handleIrVendedor(request, url, env) {
  const vendedorId = url.searchParams.get('vendedor')
  const codigo = url.searchParams.get('codigo')
  const tamanho = url.searchParams.get('tamanho')
  const parcelasEscolhidas = Number(url.searchParams.get('parcelas')) || null

  if (!vendedorId || !codigo) {
    return new Response('Link inválido.', { status: 400 })
  }

  const lista = await getVendedores(env)
  const vendedor = lista.find((v) => v.id === vendedorId)

  if (!vendedor) {
    return new Response('Vendedor não encontrado. Peça para recadastrar esse vendedor no painel admin.', { status: 404 })
  }

  const numeroValido = /^\d{10,15}$/.test(vendedor.whatsapp || '')
  if (!numeroValido) {
    return new Response(
      `O WhatsApp cadastrado para "${vendedor.nome}" está inválido ("${vendedor.whatsapp || 'vazio'}"). Corrija no painel admin (só números, com DDI e DDD, ex: 5511999999999).`,
      { status: 500 }
    )
  }

  let referencia = codigo
  let preco = null
  try {
    const controlador = new AbortController()
    const tempoLimite = setTimeout(() => controlador.abort(), 4000)
    const dados = await buscarDadosProdutoMersan(codigo, controlador.signal)
    clearTimeout(tempoLimite)
    referencia = dados.referencia || codigo
    preco = dados.preco
  } catch {
    // Sem dados do produto (demorou, ou deu erro): segue só com o código.
  }

  // Usa a mesma "seleção" curta do carrinho, mesmo pra 1 produto só — assim
  // a mensagem do WhatsApp fica sempre no formato reduzido, com link pra
  // página de seleção (que já mostra foto, nome e preço bonitinhos), em
  // vez do formato antigo com todos os detalhes escritos na mensagem.
  const idSelecao = await salvarSelecao(env, [{ codigo, tamanho }])
  const linkSelecao = `${url.origin}/selecao/${idSelecao}`

  const linhas = [
    '\u{1F6CD}\u{FE0F} Tenho interesse neste produto da Mersan Calçados.',
    '',
    '\u{1F4E6} Itens selecionados: 1',
    ''
  ]

  const partes = [`Ref. ${referenciaParaCliente(referencia)}`]
  if (tamanho) partes.push(`Tam. ${tamanho}`)
  linhas.push(`• ${partes.join(' | ')}`)
  linhas.push('')

  if (preco != null) {
    linhas.push(`\u{1F4B0} Total: R$ ${preco.toFixed(2).replace('.', ',')}`)

    const maxParcelas = Math.min(MAX_PARCELAS, Math.max(1, Math.floor(preco / PARCELA_MINIMA)))
    const parcelasFinal =
      parcelasEscolhidas && parcelasEscolhidas >= 1 && parcelasEscolhidas <= maxParcelas
        ? parcelasEscolhidas
        : maxParcelas

    if (parcelasFinal > 1) {
      const valorParcela = (preco / parcelasFinal).toFixed(2).replace('.', ',')
      linhas.push(`Parcelamento: ${parcelasFinal}x de R$ ${valorParcela}`)
    }
    linhas.push('')
  }

  linhas.push('\u{1F517} Ver minha seleção:')
  linhas.push(linkSelecao)
  linhas.push('')
  linhas.push('Gostaria de mais informações.')

  const mensagem = linhas.join('\n')
  const linkWhatsApp = `https://wa.me/${vendedor.whatsapp}?text=${encodeURIComponent(mensagem)}`

  try {
    return Response.redirect(linkWhatsApp, 302)
  } catch {
    return paginaLinkManual(linkWhatsApp, `Toque no botão abaixo para falar com ${vendedor.nome}:`)
  }
}


async function handleIrVendedorCarrinho(request, url, env) {
  const vendedorId = url.searchParams.get('vendedor')
  const itensBrutos = url.searchParams.get('itens')
  const parcelasEscolhidas = Number(url.searchParams.get('parcelas')) || null

  if (!vendedorId || !itensBrutos) {
    return new Response('Link inválido.', { status: 400 })
  }

  let itens
  try {
    itens = JSON.parse(itensBrutos)
  } catch {
    return new Response('Link inválido.', { status: 400 })
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return new Response('Carrinho vazio.', { status: 400 })
  }

  const lista = await getVendedores(env)
  const vendedor = lista.find((v) => v.id === vendedorId)

  if (!vendedor) {
    return new Response('Vendedor não encontrado.', { status: 404 })
  }

  const numeroValido = /^\d{10,15}$/.test(vendedor.whatsapp || '')
  if (!numeroValido) {
    return new Response(
      `O WhatsApp cadastrado para "${vendedor.nome}" parece inválido. Peça para o administrador corrigir no painel.`,
      { status: 500 }
    )
  }

  const itensDetalhados = []
  let total = 0

  for (const item of itens) {
    const codigo = item?.codigo
    const tamanho = item?.tamanho
    if (!codigo) continue

    let referencia = codigo
    let preco = null
    try {
      const controlador = new AbortController()
      const tempoLimite = setTimeout(() => controlador.abort(), 4000)
      const dados = await buscarDadosProdutoMersan(codigo, controlador.signal)
      clearTimeout(tempoLimite)
      referencia = dados.referencia || codigo
      preco = dados.preco
    } catch {
      // Sem dados: segue só com o código no lugar da referência.
    }

    if (preco != null) total += preco
    itensDetalhados.push({ codigo, tamanho, referencia })
  }

  const idSelecao = await salvarSelecao(env, itens.map((i) => ({ codigo: i.codigo, tamanho: i.tamanho })))
  const linkSelecao = `${url.origin}/selecao/${idSelecao}`

  const linhas = [
    '\u{1F6CD}\u{FE0F} Tenho interesse nestes produtos da Mersan Calçados.',
    '',
    `\u{1F4E6} Itens selecionados: ${itensDetalhados.length}`,
    ''
  ]

  for (const item of itensDetalhados) {
    const partes = [`Ref. ${referenciaParaCliente(item.referencia)}`]
    if (item.tamanho) partes.push(`Tam. ${item.tamanho}`)
    linhas.push(`• ${partes.join(' | ')}`)
  }

  linhas.push('')

  if (total > 0) {
    linhas.push(`\u{1F4B0} Total: R$ ${total.toFixed(2).replace('.', ',')}`)

    const maxParcelas = Math.min(MAX_PARCELAS, Math.max(1, Math.floor(total / PARCELA_MINIMA)))
    const parcelasFinal =
      parcelasEscolhidas && parcelasEscolhidas >= 1 && parcelasEscolhidas <= maxParcelas
        ? parcelasEscolhidas
        : maxParcelas

    if (parcelasFinal > 1) {
      const valorParcela = (total / parcelasFinal).toFixed(2).replace('.', ',')
      linhas.push(`Parcelamento: ${parcelasFinal}x de R$ ${valorParcela}`)
    }
    linhas.push('')
  }

  linhas.push('\u{1F517} Ver minha seleção:')
  linhas.push(linkSelecao)
  linhas.push('')
  linhas.push('Gostaria de mais informações.')

  const mensagem = linhas.join('\n')
  const linkWhatsApp = `https://wa.me/${vendedor.whatsapp}?text=${encodeURIComponent(mensagem)}`

  try {
    return Response.redirect(linkWhatsApp, 302)
  } catch {
    return paginaLinkManual(linkWhatsApp, `Toque no botão abaixo para falar com ${vendedor.nome}:`)
  }
    }

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders
    }
  })
}

// ---------- Catálogo pronto (performance) ----------
//
// Em vez do catálogo perguntar produto por produto pra Mersan toda vez
// que alguém abre a página (lento), essa função monta a lista JÁ PRONTA
// de uma vez e guarda no Cache API por 30 minutos. A primeira pessoa
// depois desses 30 minutos "paga" a espera da consulta; todo mundo
// depois disso recebe a lista pronta na hora.

const CATALOGO_CACHE_CHAVE = '_catalogo_pronto'
const CATALOGO_CURSOR_CHAVE = '_catalogo_cursor'
const CATALOGO_LOTE_TAMANHO = 10
const CATALOGO_LOTE_PREFIXO = '_catalogo_lote_'
const CATALOGO_NOVOS_CHAVE = '_catalogo_novos'

// Produtos recém-cadastrados que ainda não foram "varridos" por nenhum
// lote do aquecimento automático. Fica numa gaveta própria, separada dos
// lotes, pra não interferir no ciclo normal — só existe pra cobrir a
// lacuna entre "acabei de cadastrar" e "o aquecimento chegou nesse item".
async function getCatalogoNovos(env) {
  const bruto = await env.FOTOS.get(CATALOGO_NOVOS_CHAVE)
  if (!bruto) return []
  try {
    const lista = JSON.parse(bruto)
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

async function upsertCatalogoNovo(env, item) {
  const lista = await getCatalogoNovos(env)
  const semEsse = lista.filter((p) => p.codigo !== item.codigo)
  semEsse.push(item)
  // Limite de segurança: nunca deixa crescer sem parar. No dia a dia
  // isso fica vazio quase sempre, já que o aquecimento absorve os itens
  // em poucos minutos e limpa a lista sozinho.
  const limitada = semEsse.slice(-100)
  await env.FOTOS.put(CATALOGO_NOVOS_CHAVE, JSON.stringify(limitada))
}

// Cada lote escreve numa chave PRÓPRIA (_catalogo_lote_0, _catalogo_lote_1,
// ...), nunca lendo nem misturando com o que já existia. Isso elimina de
// vez o problema de duas execuções (o aquecedor automático e um teste
// manual, por exemplo) se atropelarem: cada uma mexe só na sua própria
// gaveta, nunca na do outro.
async function preAquecerCatalogoLote(env) {
  const chavesFotos = await listarTodasFotos(env)
  const codigos = chavesFotos
    .filter((k) => ehChaveDeProduto(k.name))
    .map((k) => ({
      codigo: k.name,
      categoria: k.metadata?.categoria || '',
      categoriaManual: Boolean(k.metadata?.categoriaManual)
    }))

  if (codigos.length === 0) {
    // Não zera o catálogo aqui: se a listagem vier vazia por uma falha
    // passageira do KV, isso não pode apagar um catálogo que já estava
    // funcionando. Só não faz nada e tenta de novo no próximo ciclo.
    return []
  }

  const totalLotes = Math.ceil(codigos.length / CATALOGO_LOTE_TAMANHO)

  const cursorBruto = await env.FOTOS.get(CATALOGO_CURSOR_CHAVE)
  let indiceLote = cursorBruto ? parseInt(cursorBruto, 10) : 0
  if (!Number.isFinite(indiceLote) || indiceLote >= totalLotes) indiceLote = 0

  const inicio = indiceLote * CATALOGO_LOTE_TAMANHO
  const lote = codigos.slice(inicio, inicio + CATALOGO_LOTE_TAMANHO)

  const cache = caches.default
  // Precisa ser o MESMO domínio que os clientes reais usam pra bater no
  // Worker — o Cache API da Cloudflare guarda a entrada pela URL completa
  // (inclui o host). Esse valor já esteve apontando pra um domínio que não
  // existe (diegohenriquenc.workers.dev, não resolve em DNS público),
  // então esse pré-aquecimento gravava cache num endereço que nenhum
  // cliente de verdade jamais consulta — o trabalho era feito, mas o
  // resultado nunca era reaproveitado por ninguém.
  const origem = 'https://mersan-catalogo.mersancalcados.workers.dev'

  const indiceCategorias = indexarCategoriasPorCodigo(await getCategoriasPlanilha(env))

  const erros = []
  const resultados = await Promise.all(
    lote.map(async (item) => {
      try {
        const dados = await buscarDadosProdutoMersan(item.codigo)

        // Assim que sabemos o código interno do produto, já aplicamos a
        // categoria da planilha aqui mesmo — inclusive gravando na foto.
        // Sem isso, a categoria só entrava no catálogo depois de um ciclo
        // extra de aquecimento, e produtos ficavam sem categoria à toa.
        let categoriaItem = item.categoria
        const categoriaPlanilha = indiceCategorias[normalizarCodigoInterno(dados.codigoSku)]
        // Categoria escolhida à mão pelo admin nunca é sobrescrita pela
        // planilha automaticamente — só muda se o admin trocar de novo.
        if (!item.categoriaManual && categoriaPlanilha && categoriaPlanilha !== categoriaItem) {
          categoriaItem = categoriaPlanilha
          try {
            const fotoAtual = await env.FOTOS.getWithMetadata(item.codigo, 'arrayBuffer')
            if (fotoAtual && fotoAtual.value) {
              await env.FOTOS.put(item.codigo, fotoAtual.value, {
                metadata: {
                  contentType: fotoAtual.metadata?.contentType || 'image/jpeg',
                  tamanho: fotoAtual.metadata?.tamanho || fotoAtual.value.byteLength,
                  categoria: categoriaPlanilha
                }
              })
            }
          } catch {
            // Se a gravação falhar, o catálogo desta rodada já sai correto
            // mesmo assim; a próxima rodada tenta gravar de novo.
          }
        }

        // Aproveita essa mesma consulta pra já deixar pronta a resposta
        // individual do produto (/api/produto) — é a página do produto
        // que se beneficia disso, abrindo instantânea depois.
        const urlProduto = `${origem}/api/produto?termo=${encodeURIComponent(item.codigo)}`
        await cache.put(
          new Request(urlProduto),
          jsonResponse(dados, 200, { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` })
        )

        if (!dados.referencia || dados.referencia.includes('não encontrado')) { erros.push({ codigo: item.codigo, motivo: 'sem referência' }); return null }

        const estoque = await buscarEstoqueMersan(dados.referencia, dados.cor)

        // Mesma ideia pro estoque (/api/estoque) — essa é a parte que
        // demorava alguns segundos na tela do produto; com isso pronto
        // de antemão, some quase toda essa espera.
        const urlEstoque = `${origem}/api/estoque?referencia=${encodeURIComponent(dados.referencia)}&cor=${encodeURIComponent(dados.cor || '')}`
        await cache.put(
          new Request(urlEstoque),
          jsonResponse(
            { referencia: dados.referencia, loja: LOJA, estoque, atualizadoEm: new Date().toISOString() },
            200,
            { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` }
          )
        )

const estoqueTotal = estoque.reduce((soma, i) => soma + (i.pares || 0), 0)

// IMPORTANTE: estoqueTotal === 0 NÃO é descartado aqui — precisa ficar
// gravado no lote pra o admin conseguir ver "isso esgotou" (aba
// Esgotados). Quem tira o produto zerado da vitrine pública é o filtro
// em handleCatalogoPronto, não aqui. Antes desta correção, um produto
// zerado virava "return null" (igual erro de verdade) e essa informação
// se perdia — o admin nunca sabia quais produtos tinham esgotado.
return {
  codigo: item.codigo,
  categoria: categoriaItem,
  codigoSku: dados.codigoSku,
  promocao: dados.emPromocao,
  nome: dados.nome,
  tamanho: dados.tamanho,
  preco: dados.preco,
  precoOriginal: dados.precoOriginal,
  referencia: dados.referencia,
  cor: dados.cor,
  estoqueTotal
}
      } catch (err) {
  erros.push({ codigo: item.codigo, motivo: String(err?.message || err) })
  return null
      }
    })
  )

  await env.FOTOS.put(`${CATALOGO_LOTE_PREFIXO}${indiceLote}`, JSON.stringify(resultados.filter(Boolean)))
  await env.FOTOS.put(
    CATALOGO_CACHE_CHAVE,
    JSON.stringify({ totalLotes, atualizadoEm: new Date().toISOString() })
  )

  const proximoIndice = indiceLote + 1 >= totalLotes ? 0 : indiceLote + 1
  await env.FOTOS.put(CATALOGO_CURSOR_CHAVE, String(proximoIndice))
  return erros
}

// Só LÊ — nunca recalcula, nunca escreve. Junta os lotes já prontos (cada
// um guardado na própria gaveta) numa lista só, pra devolver pro cliente.
async function handleCatalogoPronto(env, ctx) {
  const indiceBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)
  const totalLotes = indiceBruto ? JSON.parse(indiceBruto).totalLotes || 0 : 0

  const lotes = totalLotes
    ? await Promise.all(
        Array.from({ length: totalLotes }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
      )
    : []

  const produtos = lotes.flatMap((l) => (l ? JSON.parse(l) : []))

  // Produtos cadastrados há pouco tempo, que ainda não foram varridos por
  // nenhum lote do aquecimento, entram aqui na hora — sem isso, um
  // produto novo só aparecia no catálogo depois de vários ciclos do cron.
  const novos = await getCatalogoNovos(env)
  const codigosNoCatalogo = new Set(produtos.map((p) => p.codigo))
  const novosAindaFaltando = novos.filter((n) => !codigosNoCatalogo.has(n.codigo))

  // Assim que um "novo" aparece de verdade num lote (o aquecimento
  // normal chegou nele), ele não precisa mais ficar guardado aqui —
  // limpa em segundo plano, sem atrasar a resposta pro cliente.
  if (novosAindaFaltando.length !== novos.length) {
    ctx.waitUntil(env.FOTOS.put(CATALOGO_NOVOS_CHAVE, JSON.stringify(novosAindaFaltando)))
  }

  // Como só um lote é reprocessado por ciclo, e a contagem total de
  // produtos muda o tempo todo (produtos novos/excluídos na hora), um
  // mesmo produto pode acabar temporariamente presente em dois lotes ao
  // mesmo tempo (um "lote velho" que ainda não foi reprocessado, e um
  // "lote novo" que já pegou ele na posição atual). Isso aparecia como
  // duplicata no catálogo. Removendo por código aqui garante que o
  // cliente nunca vê duplicata, mesmo que o rearranjo interno ainda não
  // tenha terminado de se acertar sozinho.
  const todosProdutos = [...produtos, ...novosAindaFaltando]
  const codigosVistos = new Set()
  const semDuplicata = []
  for (const p of todosProdutos) {
    if (codigosVistos.has(p.codigo)) continue
    codigosVistos.add(p.codigo)
    semDuplicata.push(p)
  }

  // Produto com estoque zerado sai do catálogo automaticamente — a foto
  // continua guardada no banco (não é apagada), então se o estoque voltar
  // (reposição na Mersan), o produto reaparece sozinho no próximo ciclo,
  // sem precisar recadastrar nada.
  const produtosComEstoque = semDuplicata.filter((p) => p.estoqueTotal == null || p.estoqueTotal > 0)

  return jsonResponse({ produtos: produtosComEstoque }, 200, {
    'Cache-Control': 'public, max-age=120'
  })
}

// Só pro painel admin: mesma leitura dos lotes do catálogo que
// handleCatalogoPronto faz, mas SEM filtrar os produtos com estoque
// zerado — é exatamente esse filtro que faz esses produtos "desaparecerem"
// pro cliente final, mas o admin precisa enxergar o zero pra saber o que
// esgotou (aba "Esgotados"). Sem esse endpoint, essa informação nunca
// chegava no painel: o admin só tinha acesso ao /api/catalogo público, que
// já vem sem os produtos zerados — não porque eles "sumiam", mas porque
// nunca apareciam ali pra começo de conversa.
//
// Também devolve o nome de cada produto (nomes), pra dar pra buscar no
// admin por palavra (ex: "chuteira") mesmo em produtos que ainda não
// foram categorizados como Chuteira — o admin só conhece o código de
// barras de cada foto, nunca o nome, então sem isso a busca só acharia
// pela categoria já salva, não pelo nome de verdade do produto.
async function handleAdminEstoqueCadastrados(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const indiceBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)
  const totalLotes = indiceBruto ? JSON.parse(indiceBruto).totalLotes || 0 : 0

  const lotes = totalLotes
    ? await Promise.all(
        Array.from({ length: totalLotes }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
      )
    : []

  const produtos = lotes.flatMap((l) => (l ? JSON.parse(l) : []))

  const estoques = {}
  const nomes = {}
  for (const p of produtos) {
    estoques[p.codigo] = p.estoqueTotal
    if (p.nome) nomes[p.codigo] = p.nome
  }

  return jsonResponse({ estoques, nomes })
}

async function preAquecerCatalogoAgendado(env) {
  await preAquecerCatalogoLote(env)
}

async function handleCatalogoDebug(env) {
  const cursorBruto = await env.FOTOS.get(CATALOGO_CURSOR_CHAVE)
  const indiceBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)

  const chavesFotos = await listarTodasFotos(env)
  const codigos = chavesFotos
    .filter((k) => ehChaveDeProduto(k.name))
    .map((k) => k.name)

  const totalLotes = Math.ceil(codigos.length / CATALOGO_LOTE_TAMANHO)
  let indiceLote = cursorBruto ? parseInt(cursorBruto, 10) : 0
  if (!Number.isFinite(indiceLote) || indiceLote >= totalLotes) indiceLote = 0

  const inicio = indiceLote * CATALOGO_LOTE_TAMANHO
  const lote = codigos.slice(inicio, inicio + CATALOGO_LOTE_TAMANHO)

  const lotesGuardados = await Promise.all(
    Array.from({ length: totalLotes }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
  )

  return jsonResponse({
    cursorGuardado: cursorBruto,
    indiceLoteUsado: indiceLote,
    totalDeCodigos: codigos.length,
    totalLotes,
    loteQueSeriaProcessadoAgora: lote,
    indiceGuardado: indiceBruto,
    lotesGuardadosContagem: lotesGuardados.map((l, i) => ({
      indice: i,
      existe: Boolean(l),
      qtdProdutos: l ? JSON.parse(l).length : 0
    }))
  })
}

async function handleCatalogoForcar(env) {
  const erros = await preAquecerCatalogoLote(env)
  const indiceBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)
  if (!indiceBruto) return jsonResponse({ produtos: [] }, 200)
  const { totalLotes } = JSON.parse(indiceBruto)
  const lotes = await Promise.all(
    Array.from({ length: totalLotes || 0 }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
  )
  const produtos = lotes.flatMap((l) => (l ? JSON.parse(l) : []))
  return jsonResponse({ produtos, erros }, 200)
}
