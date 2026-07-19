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
const CACHE_TTL_SECONDS = 90 * 60 // 90 minutos — dá folga pro aquecedor completar um ciclo inteiro mesmo com o catálogo crescendo
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

    if (url.pathname === '/ir-vendedor' && request.method === 'GET') {
      return handleIrVendedor(request, url, env)
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

  // Roda sozinho a cada 25 minutos (configurado no wrangler.jsonc). Consulta
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

// Busca o estoque bruto da Mersan e já consolida por tamanho: se a mesma
// numeração aparecer em mais de uma linha (comum na resposta da Mersan),
// soma as quantidades e devolve só UM item por tamanho — o cliente nunca
// vê duplicidade, e a quantidade somada só serve internamente pra saber
// se aquele tamanho está disponível ou não.
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

  // Limite de segurança: o KV aceita até 25MB por valor.
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

// Atualiza só categoria/promoção de uma foto já cadastrada, sem precisar
// reenviar a imagem — o KV não permite trocar metadata sem "reescrever" o
// valor, então lemos os bytes já salvos e gravamos de novo, mesma imagem,
// metadata nova.
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

// ---------- Vitrine pública (lista de fotos, sem senha) ----------

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

// ---------- Vendedores ----------
// Guardados como uma lista única em JSON dentro do mesmo KV das fotos,
// numa chave reservada que nunca é usada como código de produto.

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

// Monta a mensagem final e redireciona para o WhatsApp do vendedor
// escolhido — o número de telefone nunca passa pelo navegador da pessoa,
// só o link final do wa.me.
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

  // Valida o número ANTES de tentar montar qualquer link. Sem isso, um
  // número salvo errado (vazio, com espaço, etc.) faz o Response.redirect
  // quebrar mais na frente — e como o "plano B" de antes reusava esse
  // mesmo número, ele quebrava de novo, gerando a tela em branco.
  const numeroValido = /^\d{10,15}$/.test(vendedor.whatsapp || '')
  if (!numeroValido) {
    return new Response(
      `O WhatsApp cadastrado para "${vendedor.nome}" está inválido ("${vendedor.whatsapp || 'vazio'}"). Corrija no painel admin (só números, com DDI e DDD, ex: 5511999999999).`,
      { status: 500 }
    )
  }

  // O "?v=" no final não afeta em nada a busca do produto (o código vem só
  // do caminho da URL, antes do "?"), mas faz o WhatsApp tratar o link como
  // "novo" a cada mensagem — sem isso, se esse produto específico já foi
  // compartilhado uma vez com uma prévia quebrada (por exemplo, durante
  // algum ajuste anterior), o WhatsApp guarda aquela prévia velha pra
  // sempre e nunca busca a foto de novo, mesmo com o site já corrigido.
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
    // Sem dados do produto (demorou, ou deu erro): segue só com o código.
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
    // Prioriza o que o cliente escolheu no dropdown; se por algum motivo
    // não vier (link antigo, por exemplo), cai no cálculo automático.
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

  // A partir daqui o número já foi validado e a mensagem já foi codificada
  // corretamente, então Response.redirect não deveria falhar. Ainda assim,
  // qualquer erro cai na página com botão manual — nunca em branco.
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

  const linhas = ['Olá!', 'Tenho interesse nestes produtos da Mersan Calçados:', '']
  let total = 0
  let indice = 1

  for (const item of itens) {
    const codigo = item?.codigo
    const tamanho = item?.tamanho
    if (!codigo) continue

    let nomeProduto = codigo
    let referencia = null
    let cor = null
    let preco = null

    try {
      const controlador = new AbortController()
      const tempoLimite = setTimeout(() => controlador.abort(), 4000)
      const dados = await buscarDadosProdutoMersan(codigo, controlador.signal)
      clearTimeout(tempoLimite)
      nomeProduto = dados.nome
      referencia = dados.referencia
      cor = dados.cor
      preco = dados.preco
    } catch {
      // Sem dados: segue só com o código.
    }

    linhas.push(`${indice}. ${nomeProduto}`)
    if (referencia) linhas.push(`Referência: ${referenciaParaCliente(referencia)}`)
    if (cor) linhas.push(`Cor: ${cor}`)
    if (tamanho) linhas.push(`Tamanho: ${tamanho}`)
    if (preco != null) {
      linhas.push(`Valor: R$ ${preco.toFixed(2).replace('.', ',')}`)
      total += preco
    }
    linhas.push(`Link: ${url.origin}/produto/${encodeURIComponent(codigo)}?v=${Date.now()}`)
    linhas.push('')
    indice++
  }

  if (total > 0) {
    linhas.push(`Total: R$ ${total.toFixed(2).replace('.', ',')}`)

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

  linhas.push('Gostaria de mais informações.')

  const mensagem = linhas.join('\n')
  const linkWhatsApp = `https://wa.me/${vendedor.whatsapp}?text=${encodeURIComponent(mensagem)}`

  try {
    return Response.redirect(linkWhatsApp, 302)
  } catch {
    return paginaLinkManual(linkWhatsApp, `Toque no botão abaixo para falar com ${vendedor.nome}:`)
  }
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

// Cada lote escreve numa chave PRÓPRIA (_catalogo_lote_0, _catalogo_lote_1,
// ...), nunca lendo nem misturando com o que já existia. Isso elimina de
// vez o problema de duas execuções (o aquecedor automático e um teste
// manual, por exemplo) se atropelarem: cada uma mexe só na sua própria
// gaveta, nunca na do outro.
async function preAquecerCatalogoLote(env) {
  const listagem = await env.FOTOS.list({ limit: 200 })
  const codigos = listagem.keys
    .filter((k) => k.name !== VENDEDORES_CHAVE && !k.name.startsWith('_catalogo'))
    .map((k) => ({ codigo: k.name, categoria: k.metadata?.categoria || '' }))

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
  const origem = 'https://mersan-catalogo.diegohenriquenc.workers.dev'

  const erros = []
  const resultados = await Promise.all(
    lote.map(async (item) => {
      try {
        const dados = await buscarDadosProdutoMersan(item.codigo)

        // Aproveita essa mesma consulta pra já deixar pronta a resposta
        // individual do produto (/api/produto) — é a página do produto
        // que se beneficia disso, abrindo instantânea depois.
        const urlProduto = `${origem}/api/produto?termo=${encodeURIComponent(item.codigo)}`
        await cache.put(
          new Request(urlProduto),
          jsonResponse(dados, 200, { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` })
        )

        if (!dados.referencia || dados.referencia.includes('não encontrado')) { erros.push({ codigo: item.codigo, motivo: 'sem referência' }); return null }

        const estoque = await buscarEstoqueMersan(dados.referencia)

        // Mesma ideia pro estoque (/api/estoque) — essa é a parte que
        // demorava alguns segundos na tela do produto; com isso pronto
        // de antemão, some quase toda essa espera.
        const urlEstoque = `${origem}/api/estoque?referencia=${encodeURIComponent(dados.referencia)}`
        await cache.put(
          new Request(urlEstoque),
          jsonResponse(
            { referencia: dados.referencia, loja: LOJA, estoque, atualizadoEm: new Date().toISOString() },
            200,
            { 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` }
          )
        )

const estoqueTotal = estoque.reduce((soma, i) => soma + (i.pares || 0), 0)

if (estoqueTotal === 0) {
  erros.push({ codigo: item.codigo, motivo: 'sem estoque' })
  return null
}

return {
  codigo: item.codigo,
  categoria: item.categoria,
  promocao: dados.emPromocao,
  nome: dados.nome,
  tamanho: dados.tamanho,
  preco: dados.preco,
  precoOriginal: dados.precoOriginal,
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
  if (!indiceBruto) {
    return jsonResponse({ produtos: [] }, 200)
  }

  const { totalLotes } = JSON.parse(indiceBruto)
  if (!totalLotes) {
    return jsonResponse({ produtos: [] }, 200)
  }

  const lotes = await Promise.all(
    Array.from({ length: totalLotes }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
  )

  const produtos = lotes.flatMap((l) => (l ? JSON.parse(l) : []))

  return jsonResponse({ produtos }, 200, {
    'Cache-Control': 'public, max-age=120'
  })
}

async function preAquecerCatalogoAgendado(env) {
  await preAquecerCatalogoLote(env)
}

async function handleCatalogoDebug(env) {
  const cursorBruto = await env.FOTOS.get(CATALOGO_CURSOR_CHAVE)
  const indiceBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE)

  const listagem = await env.FOTOS.list({ limit: 200 })
  const codigos = listagem.keys
    .filter((k) => k.name !== VENDEDORES_CHAVE && !k.name.startsWith('_catalogo'))
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
