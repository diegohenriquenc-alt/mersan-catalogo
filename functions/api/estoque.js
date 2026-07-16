// Proxy serverless: GET /api/estoque?referencia=012%20145%2024011-2882
//
// Por que existe:
//  - Esconde a URL real da API da Mersan do navegador do vendedor/cliente
//  - Evita CORS (o front chama o próprio domínio, não credito.mersan.co)
//  - Cacheia por 30 minutos na borda da Cloudflare (Cache API), então
//    duas pesquisas iguais em lojas/dispositivos diferentes não duplicam
//    chamada à API da Mersan
//  - Se o endpoint da Mersan mudar no futuro, só este arquivo muda —
//    o front-end nunca precisa ser alterado
//
// Rodando no Cloudflare Pages, qualquer arquivo dentro de /functions vira
// uma rota automaticamente: functions/api/estoque.js -> /api/estoque

const MERSAN_BASE = 'https://credito.mersan.co/api/v1'
const LOJA = 261
const CACHE_TTL_SECONDS = 30 * 60 // 30 minutos, conforme briefing

export async function onRequestGet(context) {
  const { request } = context
  const url = new URL(request.url)
  const referencia = url.searchParams.get('referencia')

  if (!referencia) {
    return jsonResponse({ error: 'Parâmetro "referencia" é obrigatório.' }, 400)
  }

  // Cache de borda por 30 minutos, por URL (inclui a referência pesquisada)
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

  // Regra do briefing: filtrar SEMPRE cd_empresa === 261 e nunca expor outras lojas,
  // mesmo que a API retorne o estoque de todas.
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

  // Grava no cache de borda sem atrasar a resposta ao usuário
  context.waitUntil(cache.put(cacheKey, response.clone()))

  return response
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
