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
//  qualquer outra rota           -> site estático (React) via binding ASSETS

const MERSAN_BASE = 'https://credito.mersan.co/api/v1'
const LOJA = 261
const CACHE_TTL_SECONDS = 30 * 60
const PARCELA_MINIMA = 29.99
const MAX_PARCELAS = 10

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/produto/')) {
      return handleProdutoPage(request, url, env, ctx)
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
      return handleAdminUploadFoto(request, env)
    }

    if (url.pathname === '/api/admin/foto' && request.method === 'PATCH') {
      return handleAdminAtualizarFoto(request, env)
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

    if (url.pathname === '/ir-vendedor' && request.method === 'GET') {
      return handleIrVendedor(request, url, env)
    }

    return env.ASSETS.fetch(request)
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(preAquecerCache(env))
    ctx.waitUntil(preAquecerCatalogoAgendado(env))
  }
}

async function preAquecerCache(env) {
  const listagem = await env.FOTOS.list({ limit: 200 })
  const codigos = listagem.keys
    .map((k) => k.name)
    .filter((nome) => nome !== VENDEDORES_CHAVE)

  const cache = caches.default
  const origem = 'https://mersan-catalogo.diegohenriquenc.workers.dev'

  await Promise.all(
    codigos.map(async (codigo) => {
      try {
        const dados = await buscarDadosProdutoMersan(codigo)

        const urlProduto = `${origem}/api/produto?termo=${encodeURIComponent(codigo)}`
        const respostaProduto = jsonResponse(dados, 200, {
          'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
        })
        await cache.put(new Request(urlProduto), respostaProduto)

        if (dados.referencia) {
          const estoque = await buscarEstoqueMersan(dados.referencia)
          const urlEstoque = `${origem}/api/estoque?referencia=${encodeURIComponent(dados.referencia)}`
          const respostaEstoque = jsonResponse(
            { referencia: dados.referencia, loja: LOJA, estoque, atualizadoEm: new Date().toISOString() },
            200,
            { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` }
          )
          await cache.put(new Request(urlEstoque), respostaEstoque)
        }
      } catch {
      }
    })
  )
}

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

async function handleProduto(request, url, ctx) {
  const termo = url.searchParams.get('termo')

  if (!termo) {
    return jsonResponse({ error: 'Parâmetro "termo" é obrigatório.' }, 400)
  }

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
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
  })

  ctx.waitUntil(cache.put(cacheKey, response.clone()))

  return response
}

async function buscarEstoqueMersan(referencia, signal) {
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

  const porTamanho = new Map()
  for (const item of lista) {
    if (!item || item.cd_empresa !== LOJA || Number(item.qt_stock) <= 0) continue
    const tamanho = item.ds_tamanho
    porTamanho.set(tamanho, (porTamanho.get(tamanho) || 0) + Number(item.qt_stock))
  }

  return Array.from(porTamanho.entries())
    .map(([tamanho, pares]) => ({ tamanho, pares }))
    .sort((a, b) => parseFloat(a.tamanho) - parseFloat(b.tamanho))
    }
async function handleEstoque(request, url, ctx) {
  const referencia = url.searchParams.get('referencia')

  if (!referencia) {
    return jsonResponse({ error: 'Parâmetro "referencia" é obrigatório.' }, 400)
  }

  const cache = caches.default
  const cacheKey = new Request(url.toString(), request)

  const cached = await cache.match(cacheKey)
  if (cached) {
    return cached
  }

  let estoqueLoja261
  try {
    estoqueLoja261 = await buscarEstoqueMersan(referencia)
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
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
  })

  ctx.waitUntil(cache.put(cacheKey, response.clone()))

  return response
}

async function handleProdutoPage(request, url, env, ctx) {
  const codigo = decodeURIComponent(url.pathname.replace('/produto/', ''))

  const cache = caches.default
  const cacheKey = new Request(url.toString(), request)

  const cached = await cache.match(cacheKey)
  if (cached) {
    return cached
  }

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
    return new Response(html, htmlResp)
  }

  const titulo = `${dadosProduto.nome} - Mersan Calçados`
  const descricao = 'Mersan Calçados • Loja 261'
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
      '<meta property="og:image" content="/icons/icon-512.svg" />',
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

function normalizarCodigo(codigo) {
  return codigo.trim().replace(/\s+/g, '_')
}

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
      'Cache-Control': 'public, max-age=86400'
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

async function handleAdminUploadFoto(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const form = await request.formData()
  const codigo = form.get('codigo')
  const arquivo = form.get('arquivo')
  const categoria = form.get('categoria') || ''

  if (!codigo || !arquivo) {
    return jsonResponse({ error: 'Envie "codigo" e "arquivo".' }, 400)
  }

  const chave = normalizarCodigo(codigo)
  const bytes = await arquivo.arrayBuffer()

  if (bytes.byteLength > 24 * 1024 * 1024) {
    return jsonResponse({ error: 'Arquivo grande demais (máximo 24MB).' }, 400)
  }

  await env.FOTOS.put(chave, bytes, {
    metadata: {
      contentType: arquivo.type || 'image/jpeg',
      tamanho: bytes.byteLength,
      categoria
    }
  })

  return jsonResponse({ ok: true, codigo: chave })
      }
