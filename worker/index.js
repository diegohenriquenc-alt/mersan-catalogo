// Worker único do Catálogo Mersan.
//
// Substitui a antiga pasta /functions (formato específico do produto "Pages",
// que foi unificado ao "Workers" pelo Cloudflare). Aqui:
//  - Rotas /api/* são tratadas por este script (proxy para a API da Mersan)
//  - Todo o resto é servido como site estático (a build do React em /dist),
//    através do binding "ASSETS" configurado no wrangler.jsonc

const MERSAN_BASE = 'https://credito.mersan.co/api/v1'
const LOJA = 261
const CACHE_TTL_SECONDS = 30 * 60 // 30 minutos, conforme briefing

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/api/estoque') {
      return handleEstoque(request, url, ctx)
    }

    if (url.pathname === '/api/produto') {
      return handleProduto(url)
    }

    // Qualquer outra rota: serve o site estático (React) normalmente.
    return env.ASSETS.fetch(request)
  }
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

  // Regra do briefing: filtrar SEMPRE cd_empresa === 261 e nunca expor outras lojas.
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

async function handleProduto(url) {
  // Ainda não conectado a um endpoint real — ver README para detalhes.
  const termo = url.searchParams.get('termo')

  return jsonResponse(
    {
      error: 'Endpoint de dados do produto ainda não configurado.',
      termoConsultado: termo
    },
    501
  )
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
