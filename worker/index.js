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

    if (url.pathname === '/api/catalogo-debug' && request.method === 'GET') {
      return handleCatalogoDebug(env)
    }

    if (url.pathname === '/api/catalogo-forcar' && request.method === 'GET') {
      return handleCatalogoForcar(env)
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
async function handleAdminAtualizarFoto(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const corpo = await request.json().catch(() => null)
  const codigo = corpo?.codigo
  const categoria = corpo?.categoria || ''

  if (!codigo) {
    return jsonResponse({ error: 'Parâmetro "codigo" é obrigatório.' }, 400)
  }

  const chave = normalizarCodigo(codigo)
  const resultado = await env.FOTOS.getWithMetadata(chave, 'arrayBuffer')

  if (!resultado || !resultado.value) {
    return jsonResponse({ error: 'Foto não encontrada para esse código.' }, 404)
  }

  await env.FOTOS.put(chave, resultado.value, {
    metadata: {
      contentType: resultado.metadata?.contentType || 'image/jpeg',
      tamanho: resultado.metadata?.tamanho || resultado.value.byteLength,
      categoria
    }
  })

  return jsonResponse({ ok: true, codigo: chave })
}

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

  await env.FOTOS.delete(normalizarCodigo(codigo))
  return jsonResponse({ ok: true })
}

async function handleAdminListarFotos(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: 'Senha incorreta.' }, 401)
  }

  const listagem = await env.FOTOS.list({ limit: 200 })
  const fotos = listagem.keys
    .filter((k) => k.name !== VENDEDORES_CHAVE && k.name !== CATALOGO_CACHE_CHAVE && k.name !== CATALOGO_CURSOR_CHAVE)
    .map((k) => ({
      codigo: k.name,
      tamanho: k.metadata?.tamanho || null,
      categoria: k.metadata?.categoria || '',
      modificadoEm: k.metadata?.atualizadoEm || null
    }))

  return jsonResponse({ fotos, truncado: !listagem.list_complete })
}

async function handleFotosPublicas(env) {
  const listagem = await env.FOTOS.list({ limit: 200 })
  const produtos = listagem.keys
    .filter((k) => k.name !== VENDEDORES_CHAVE && k.name !== CATALOGO_CACHE_CHAVE)
    .map((k) => ({
      codigo: k.name,
      categoria: k.metadata?.categoria || ''
    }))

  return jsonResponse({ produtos, truncado: !listagem.list_complete })
}

const VENDEDORES_CHAVE = '_vendedores'

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
  const whatsapp = corpo?.whatsapp?.replace(/\D/g, '')

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

  const linkProduto = `${url.origin}/produto/${encodeURIComponent(codigo)}?v=${Date.now()}`

  let nomeProduto = codigo
  let referencia = null
  let cor = null
  let preco = null
  let precoOriginal = null
  let emPromocao = false
  try {
    const controlador = new AbortController()
    const tempoLimite = setTimeout(() => controlador.abort(), 4000)
    const dados = await buscarDadosProdutoMersan(codigo, controlador.signal)
    clearTimeout(tempoLimite)
    nomeProduto = dados.nome
    referencia = dados.referencia
    cor = dados.cor
    preco = dados.preco
    precoOriginal = dados.precoOriginal
    emPromocao = dados.emPromocao
  } catch {
  }

  const linhas = [
    'Olá!',
    'Tenho interesse neste produto da Mersan Calçados.',
    `Produto: ${nomeProduto}`
  ]

  if (referencia) linhas.push(`Referência: ${referenciaParaCliente(referencia)}`)
  if (cor) linhas.push(`Cor: ${cor}`)
  if (tamanho) linhas.push(`Tamanho: ${tamanho}`)

  if (preco != null) {
    if (emPromocao && precoOriginal > preco) {
      linhas.push(`De: R$ ${precoOriginal.toFixed(2).replace('.', ',')}`)
      linhas.push(`Por: R$ ${preco.toFixed(2).replace('.', ',')}`)
    } else {
      linhas.push(`Valor: R$ ${preco.toFixed(2).replace('.', ',')}`)
    }

    const maxParcelas = Math.min(MAX_PARCELAS, Math.max(1, Math.floor(preco / PARCELA_MINIMA)))
    const parcelasFinal =
      parcelasEscolhidas && parcelasEscolhidas >= 1 && parcelasEscolhidas <= maxParcelas
        ? parcelasEscolhidas
        : maxParcelas
    if (parcelasFinal > 1) {
      const valorParcela = (preco / parcelasFinal).toFixed(2).replace('.', ',')
      linhas.push(`Parcelamento: ${parcelasFinal}x de R$ ${valorParcela}`)
    }
  }

  linhas.push(`Link: ${linkProduto}`)
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
const CATALOGO_CACHE_CHAVE = '_catalogo_pronto'
const CATALOGO_CURSOR_CHAVE = '_catalogo_cursor'
const CATALOGO_LOTE_TAMANHO = 20
async function preAquecerCatalogoLote(env) {
  const listagem = await env.FOTOS.list({ limit: 200 })
  const codigos = listagem.keys
    .filter(
      (k) =>
        k.name !== VENDEDORES_CHAVE &&
        k.name !== CATALOGO_CACHE_CHAVE &&
        k.name !== CATALOGO_CURSOR_CHAVE
    )
    .map((k) => ({ codigo: k.name, categoria: k.metadata?.categoria || '' }))

  if (codigos.length === 0) {
    await env.FOTOS.put(CATALOGO_CACHE_CHAVE, JSON.stringify({ produtos: [], atualizadoEm: new Date().toISOString() }))
    return
  }

  const cursorBruto = await env.FOTOS.get(CATALOGO_CURSOR_CHAVE)
  let cursor = cursorBruto ? parseInt(cursorBruto, 10) : 0
  if (!Number.isFinite(cursor) || cursor >= codigos.length) cursor = 0

  const lote = codigos.slice(cursor, cursor + CATALOGO_LOTE_TAMANHO)

  const resultados = await Promise.all(
    lote.map(async (item) => {
      try {
        const dados = await buscarDadosProdutoMersan(item.codigo)
        if (!dados.referencia) return null

        const estoque = await buscarEstoqueMersan(dados.referencia)
        if (!estoque.length) return null

        return {
          codigo: item.codigo,
          categoria: item.categoria,
          promocao: dados.emPromocao,
          nome: dados.nome,
          preco: dados.preco,
          precoOriginal: dados.precoOriginal
        }
      } catch {
        return null
      }
    })
  )

  const anteriorBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)
  const anterior = anteriorBruto ? JSON.parse(anteriorBruto).produtos : []
  const mapa = new Map(anterior.map((p) => [p.codigo, p]))

  lote.forEach((item, i) => {
    const resultado = resultados[i]
    if (resultado) {
      mapa.set(item.codigo, resultado)
    } else {
      mapa.delete(item.codigo)
    }
  })

  const proximoCursor = cursor + CATALOGO_LOTE_TAMANHO >= codigos.length ? 0 : cursor + CATALOGO_LOTE_TAMANHO

  await env.FOTOS.put(
    CATALOGO_CACHE_CHAVE,
    JSON.stringify({ produtos: Array.from(mapa.values()), atualizadoEm: new Date().toISOString() })
  )
  await env.FOTOS.put(CATALOGO_CURSOR_CHAVE, String(proximoCursor))
}

async function handleCatalogoPronto(env, ctx) {
  const bruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)
  return jsonResponse(bruto ? JSON.parse(bruto) : { produtos: [] }, 200, {
    'Cache-Control': 'public, max-age=120'
  })
}

async function preAquecerCatalogoAgendado(env) {
  await preAquecerCatalogoLote(env)
}

async function handleCatalogoDebug(env) {
  const cursorBruto = await env.FOTOS.get(CATALOGO_CURSOR_CHAVE)
  const cacheBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)

  const listagem = await env.FOTOS.list({ limit: 200 })
  const codigos = listagem.keys
    .filter(
      (k) =>
        k.name !== VENDEDORES_CHAVE &&
        k.name !== CATALOGO_CACHE_CHAVE &&
        k.name !== CATALOGO_CURSOR_CHAVE
    )
    .map((k) => k.name)

  let cursor = cursorBruto ? parseInt(cursorBruto, 10) : 0
  if (!Number.isFinite(cursor) || cursor >= codigos.length) cursor = 0

  const lote = codigos.slice(cursor, cursor + CATALOGO_LOTE_TAMANHO)

  const diagnostico = await Promise.all(
    lote.map(async (codigo) => {
      try {
        const dados = await buscarDadosProdutoMersan(codigo)
        if (!dados.referencia) {
          return { codigo, problema: 'sem referencia', dados }
        }
        const estoque = await buscarEstoqueMersan(dados.referencia)
        return {
          codigo,
          referencia: dados.referencia,
          preco: dados.preco,
          tamanhosEmEstoque: estoque.length
        }
      } catch (e) {
        return { codigo, erro: String(e && e.message ? e.message : e) }
      }
    })
  )

  return jsonResponse({
    cursorGuardado: cursorBruto,
    cursorUsado: cursor,
    totalDeCodigos: codigos.length,
    loteQueSeriaProcessado: lote,
    cacheAtualBruto: cacheBruto,
    diagnostico
  })
}
async function handleCatalogoForcar(env) {
  await preAquecerCatalogoLote(env)
  const bruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)
  return jsonResponse(bruto ? JSON.parse(bruto) : { produtos: [] }, 200)
}
