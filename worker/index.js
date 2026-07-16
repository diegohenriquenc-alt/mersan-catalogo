// Worker único do Catálogo Mersan.
//
// Rotas:
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
const CACHE_TTL_SECONDS = 30 * 60 // 30 minutos, conforme briefing

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

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

    if (url.pathname === '/api/admin/foto' && request.method === 'DELETE') {
      return handleAdminExcluirFoto(request, url, env)
    }

    if (url.pathname === '/api/admin/fotos' && request.method === 'GET') {
      return handleAdminListarFotos(request, env)
    }

    // Qualquer outra rota: serve o site estático (React) normalmente.
    return env.ASSETS.fetch(request)
  }
}

// ---------- Produto / Estoque (Etapa 2, sem alterações) ----------

async function handleProduto(request, url, ctx) {
  const termo = url.searchParams.get('termo')

  if (!termo) {
    return jsonResponse({ error: 'Parâmetro "termo" é obrigatório.' }, 400)
  }

  const cache = caches.default
  const cacheKey = new Request(url.toString(), request)

  const cached = await cache.match(cacheKey)
  if (cached) {
    return cached
  }

  const mersanUrl = `${MERSAN_BASE}/buscapreco/${encodeURIComponent(termo)}/${LOJA}`

  let dados
  try {
    const resp = await fetch(mersanUrl, {
      headers: { Accept: 'application/json' }
    })

    if (!resp.ok) {
      return jsonResponse(
        { error: `A API da Mersan retornou status ${resp.status}.` },
        502
      )
    }

    dados = await resp.json()
  } catch (err) {
    return jsonResponse(
      { error: 'Não foi possível conectar à API da Mersan.' },
      502
    )
  }

  const lista = Array.isArray(dados?.precos) ? dados.precos : []

  if (lista.length === 0) {
    return jsonResponse({ error: 'Produto não encontrado.' }, 404)
  }

  const item = lista.find((p) => p.cdEmpresa === LOJA) || lista[0]

  const payload = {
    referencia: item.cdReferencia,
    nome: item.dsProduto,
    cor: item.cdCor,
    tamanho: item.dsTamanho,
    preco: item.vlPrecoPromocao > 0 ? item.vlPrecoPromocao : item.vlPreco,
    codigoBarras: item.cdProduto,
    codigoSku: item.cdSKU
  }

  const response = jsonResponse(payload, 200, {
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
  })

  ctx.waitUntil(cache.put(cacheKey, response.clone()))

  return response
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

  const mersanUrl = `${MERSAN_BASE}/buscapreco/estoque/${encodeURIComponent(referencia)}/${LOJA}`

  let registros
  try {
    const resp = await fetch(mersanUrl, {
      headers: { Accept: 'application/json' }
    })

    if (!resp.ok) {
      return jsonResponse(
        { error: `A API da Mersan retornou status ${resp.status}.` },
        502
      )
    }

    registros = await resp.json()
  } catch (err) {
    return jsonResponse(
      { error: 'Não foi possível conectar à API da Mersan.' },
      502
    )
  }

  const lista = Array.isArray(registros) ? registros : [registros]

  const estoqueLoja261 = lista
    .filter((item) => item && item.cd_empresa === LOJA && Number(item.qt_stock) > 0)
    .map((item) => ({
      tamanho: item.ds_tamanho,
      pares: item.qt_stock
    }))
    .sort((a, b) => parseFloat(a.tamanho) - parseFloat(b.tamanho))

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

// ---------- Fotos (Etapa 3) ----------
// Usando Workers KV em vez de R2: funciona no plano gratuito do Cloudflare
// sem exigir cartão de crédito cadastrado. Limite gratuito: 1GB de
// armazenamento e milhares de fotos (recomenda-se manter cada foto
// comprimida/redimensionada antes do envio — o painel já faz isso sozinho).

function normalizarCodigo(codigo) {
  return codigo.trim().replace(/\s+/g, '_')
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

async function handleAdminUploadFoto(request, env) {
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

  await env.FOTOS.put(chave, bytes, {
    metadata: { contentType: arquivo.type || 'image/jpeg' }
  })

  return jsonResponse({ ok: true, codigo: chave })
}

async function handleAdminExcluirFoto(request, url, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const codigo = url.searchParams.get('codigo')
  if (!codigo) {
    return jsonResponse({ error: 'Parâmetro "codigo" é obrigatório.' }, 400)
  }

  await env.FOTOS.delete(normalizarCodigo(codigo))
  return jsonResponse({ ok: true })
}

async function handleAdminListarFotos(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const listagem = await env.FOTOS.list({ limit: 200 })
  const fotos = listagem.keys.map((k) => ({
    codigo: k.name,
    modificadoEm: k.metadata?.atualizadoEm || null
  }))

  return jsonResponse({ fotos, truncado: !listagem.list_complete })
}

// ---------- Utilitário ----------

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
