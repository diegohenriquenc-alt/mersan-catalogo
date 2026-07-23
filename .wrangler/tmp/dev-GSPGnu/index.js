var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.js
var MERSAN_BASE = "https://credito.mersan.co/api/v1";
var LOJA = 261;
var CACHE_TTL_SECONDS = 5 * 60;
var PARCELA_MINIMA = 29.99;
var MAX_PARCELAS = 10;
async function listarTodasFotos(env) {
  let todas = [];
  let cursor = void 0;
  for (let seguranca = 0; seguranca < 20; seguranca++) {
    const pagina = await env.FOTOS.list({ limit: 1e3, cursor });
    todas = todas.concat(pagina.keys);
    if (pagina.list_complete || !pagina.cursor) break;
    cursor = pagina.cursor;
  }
  return todas;
}
__name(listarTodasFotos, "listarTodasFotos");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/produto/")) {
      return handleProdutoPage(request, url, env, ctx);
    }
    if (url.pathname.startsWith("/selecao/")) {
      return handleSelecaoPage(request, url, env, ctx);
    }
    if (url.pathname === "/api/produto") {
      return handleProduto(request, url, ctx);
    }
    if (url.pathname === "/api/estoque") {
      return handleEstoque(request, url, ctx);
    }
    if (url.pathname.startsWith("/produto-foto/")) {
      return handleServirFoto(url, env);
    }
    if (url.pathname === "/api/admin/login" && request.method === "POST") {
      return handleAdminLogin(request, env);
    }
    if (url.pathname === "/api/admin/foto" && request.method === "POST") {
      return handleAdminUploadFoto(request, env);
    }
    if (url.pathname === "/api/admin/foto" && request.method === "PATCH") {
      return handleAdminAtualizarFoto(request, env);
    }
    if (url.pathname === "/api/admin/foto/renomear" && request.method === "POST") {
      return handleAdminRenomearFoto(request, env);
    }
    if (url.pathname === "/api/admin/foto" && request.method === "DELETE") {
      return handleAdminExcluirFoto(request, url, env);
    }
    if (url.pathname === "/api/admin/fotos" && request.method === "GET") {
      return handleAdminListarFotos(request, env);
    }
    if (url.pathname === "/api/fotos-publicas" && request.method === "GET") {
      return handleFotosPublicas(env);
    }
    if (url.pathname === "/api/catalogo" && request.method === "GET") {
      return handleCatalogoPronto(env, ctx);
    }
    if (url.pathname === "/api/catalogo-debug" && request.method === "GET") {
      return handleCatalogoDebug(env);
    }
    if (url.pathname === "/api/catalogo-forcar" && request.method === "GET") {
      return handleCatalogoForcar(env);
    }
    if (url.pathname === "/api/vendedores" && request.method === "GET") {
      return handleVendedoresPublico(env);
    }
    if (url.pathname === "/api/admin/vendedores" && request.method === "GET") {
      return handleAdminListarVendedores(request, env);
    }
    if (url.pathname === "/api/admin/vendedores" && request.method === "POST") {
      return handleAdminSalvarVendedor(request, env);
    }
    if (url.pathname === "/api/admin/vendedores" && request.method === "DELETE") {
      return handleAdminExcluirVendedor(request, url, env);
    }
    if (url.pathname === "/api/admin/planilha-generos" && request.method === "POST") {
      return handleAdminSalvarPlanilhaGeneros(request, env);
    }
    if (url.pathname === "/api/admin/recalcular-categorias" && request.method === "POST") {
      return handleAdminRecalcularCategorias(request, env);
    }
    if (url.pathname === "/ir-vendedor" && request.method === "GET") {
      return handleIrVendedor(request, url, env);
    }
    if (url.pathname === "/api/selecao" && request.method === "GET") {
      return handleObterSelecao(request, url, env);
    }
    if (url.pathname === "/ir-vendedor-carrinho" && request.method === "GET") {
      return handleIrVendedorCarrinho(request, url, env);
    }
    const respostaAssets = await env.ASSETS.fetch(request);
    if (url.pathname === "/" || url.pathname.endsWith(".html")) {
      const resposta = new Response(respostaAssets.body, respostaAssets);
      resposta.headers.set("Cache-Control", "no-cache");
      return resposta;
    }
    return respostaAssets;
  },
  // Roda sozinho a cada 25 minutos (configurado no wrangler.jsonc). Consulta
  // a Mersan por conta própria pra todos os produtos cadastrados, deixando
  // o cache sempre "quente" — assim, quase ninguém precisa esperar a
  // consulta ao vivo pra Mersan, o catálogo abre rápido quase sempre.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(preAquecerCatalogoAgendado(env));
  }
};
async function buscarDadosProdutoMersan(termo, signal) {
  const mersanUrl = `${MERSAN_BASE}/buscapreco/${encodeURIComponent(termo)}/${LOJA}`;
  const resp = await fetch(mersanUrl, {
    headers: { Accept: "application/json" },
    signal
  });
  if (!resp.ok) {
    throw new Error(`A API da Mersan retornou status ${resp.status}.`);
  }
  const dados = await resp.json();
  const lista = Array.isArray(dados?.precos) ? dados.precos : [];
  if (lista.length === 0) {
    throw new Error("Produto n\xE3o encontrado.");
  }
  const item = lista.find((p) => p.cdEmpresa === LOJA) || lista[0];
  const itemMatriz = lista.find((p) => p.cdEmpresa === 1);
  let precoPromocao = item.vlPrecoPromocao;
  if ((!precoPromocao || precoPromocao <= 0) && itemMatriz?.vlPrecoPromocao > 0) {
    precoPromocao = itemMatriz.vlPrecoPromocao;
  }
  const emPromocao = precoPromocao > 0 && precoPromocao < item.vlPreco;
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
  };
}
__name(buscarDadosProdutoMersan, "buscarDadosProdutoMersan");
async function handleProduto(request, url, ctx) {
  const termo = url.searchParams.get("termo");
  if (!termo) {
    return jsonResponse({ error: 'Par\xE2metro "termo" \xE9 obrigat\xF3rio.' }, 400);
  }
  if (url.searchParams.has("debug")) {
    const mersanUrl = `${MERSAN_BASE}/buscapreco/${encodeURIComponent(termo)}/${LOJA}`;
    const resp = await fetch(mersanUrl, { headers: { Accept: "application/json" } });
    const texto = await resp.text();
    return new Response(texto, {
      status: resp.status,
      headers: { "Content-Type": "application/json" }
    });
  }
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }
  let payload;
  try {
    payload = await buscarDadosProdutoMersan(termo);
  } catch (err) {
    const status = err.message === "Produto n\xE3o encontrado." ? 404 : 502;
    return jsonResponse({ error: err.message }, status);
  }
  const response = jsonResponse(payload, 200, {
    "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
__name(handleProduto, "handleProduto");
async function buscarEstoqueMersan(referencia, signal) {
  const mersanUrl = `${MERSAN_BASE}/buscapreco/estoque/${encodeURIComponent(referencia)}/${LOJA}`;
  const resp = await fetch(mersanUrl, {
    headers: { Accept: "application/json" },
    signal
  });
  if (!resp.ok) {
    throw new Error(`A API da Mersan retornou status ${resp.status}.`);
  }
  const registros = await resp.json();
  const lista = Array.isArray(registros) ? registros : [registros];
  const porTamanho = /* @__PURE__ */ new Map();
  for (const item of lista) {
    if (!item || item.cd_empresa !== LOJA || Number(item.qt_stock) <= 0) continue;
    const tamanho = item.ds_tamanho;
    porTamanho.set(tamanho, (porTamanho.get(tamanho) || 0) + Number(item.qt_stock));
  }
  return Array.from(porTamanho.entries()).map(([tamanho, pares]) => ({ tamanho, pares })).sort((a, b) => parseFloat(a.tamanho) - parseFloat(b.tamanho));
}
__name(buscarEstoqueMersan, "buscarEstoqueMersan");
async function handleEstoque(request, url, ctx) {
  const referencia = url.searchParams.get("referencia");
  if (!referencia) {
    return jsonResponse({ error: 'Par\xE2metro "referencia" \xE9 obrigat\xF3rio.' }, 400);
  }
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }
  let estoqueLoja261;
  try {
    estoqueLoja261 = await buscarEstoqueMersan(referencia);
  } catch {
    return jsonResponse(
      { error: "N\xE3o foi poss\xEDvel conectar \xE0 API da Mersan." },
      502
    );
  }
  const payload = {
    referencia,
    loja: LOJA,
    estoque: estoqueLoja261,
    atualizadoEm: (/* @__PURE__ */ new Date()).toISOString()
  };
  const response = jsonResponse(payload, 200, {
    "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
__name(handleEstoque, "handleEstoque");
async function handleProdutoPage(request, url, env, ctx) {
  const codigo = decodeURIComponent(url.pathname.replace("/produto/", ""));
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }
  const baseRequest = new Request(new URL("/", request.url), request);
  const htmlResp = await env.ASSETS.fetch(baseRequest);
  let html = await htmlResp.text();
  if (!codigo) {
    return new Response(html, htmlResp);
  }
  let dadosProduto = null;
  try {
    dadosProduto = await buscarDadosProdutoMersan(codigo);
  } catch {
    return new Response(html, htmlResp);
  }
  const titulo = `${dadosProduto.nome} - Mersan Cal\xE7ados`;
  const descricao = "Mersan Cal\xE7ados \u2022 Loja 261";
  const chaveFoto = normalizarCodigo(codigo);
  const imagemUrl = `${url.origin}/produto-foto/${encodeURIComponent(chaveFoto)}`;
  html = html.replace(
    "<title>Mersan Cal\xE7ados - Cat\xE1logo Loja 261</title>",
    `<title>${escapeHtml(titulo)}</title>`
  ).replaceAll(
    'content="Mersan Cal\xE7ados \u2022 Loja 261"',
    `content="${escapeHtml(titulo)}"`
  ).replaceAll(
    'content="Consulte produtos e estoque da Mersan Cal\xE7ados - Loja 261"',
    `content="${escapeHtml(descricao)}"`
  ).replace(
    '<meta property="og:image" content="https://mersan-catalogo.mersancalcados.workers.dev/og-image.png" />',
    `<meta property="og:image" content="${imagemUrl}" />
    <meta property="og:image:type" content="image/jpeg" />`
  );
  const response = new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`
    }
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
__name(handleProdutoPage, "handleProdutoPage");
function escapeHtml(str) {
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
__name(escapeHtml, "escapeHtml");
async function handleSelecaoPage(request, url, env, ctx) {
  const id = url.pathname.replace("/selecao/", "").split("/")[0];
  const baseRequest = new Request(new URL("/", request.url), request);
  const htmlResp = await env.ASSETS.fetch(baseRequest);
  let html = await htmlResp.text();
  if (!id) {
    return new Response(html, htmlResp);
  }
  const selecao = await getSelecao(env, id);
  if (!selecao || !Array.isArray(selecao.itens) || selecao.itens.length === 0) {
    return new Response(html, htmlResp);
  }
  const quantidade = selecao.itens.length;
  const titulo = quantidade === 1 ? "Minha sele\xE7\xE3o (1 produto) - Mersan Cal\xE7ados" : `Minha sele\xE7\xE3o (${quantidade} produtos) - Mersan Cal\xE7ados`;
  const descricao = "Mersan Cal\xE7ados \u2022 Loja 261";
  const chaveFoto = normalizarCodigo(selecao.itens[0].codigo);
  const imagemUrl = `${url.origin}/produto-foto/${encodeURIComponent(chaveFoto)}`;
  html = html.replace(
    "<title>Mersan Cal\xE7ados - Cat\xE1logo Loja 261</title>",
    `<title>${escapeHtml(titulo)}</title>`
  ).replaceAll(
    'content="Mersan Cal\xE7ados \u2022 Loja 261"',
    `content="${escapeHtml(titulo)}"`
  ).replaceAll(
    'content="Consulte produtos e estoque da Mersan Cal\xE7ados - Loja 261"',
    `content="${escapeHtml(descricao)}"`
  ).replace(
    '<meta property="og:image" content="https://mersan-catalogo.mersancalcados.workers.dev/og-image.png" />',
    `<meta property="og:image" content="${imagemUrl}" />
    <meta property="og:image:type" content="image/jpeg" />`
  );
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}
__name(handleSelecaoPage, "handleSelecaoPage");
function normalizarCodigo(codigo) {
  return codigo.trim().replace(/\s+/g, "_");
}
__name(normalizarCodigo, "normalizarCodigo");
function referenciaParaCliente(referencia) {
  if (!referencia) return referencia;
  return referencia.replace(/[-\s]\d{2,3}$/, "").trim();
}
__name(referenciaParaCliente, "referenciaParaCliente");
async function handleServirFoto(url, env) {
  const codigo = decodeURIComponent(url.pathname.replace("/produto-foto/", ""));
  const chave = normalizarCodigo(codigo);
  const resultado = await env.FOTOS.getWithMetadata(chave, "arrayBuffer");
  if (!resultado || !resultado.value) {
    return new Response("Foto n\xE3o encontrada", { status: 404 });
  }
  return new Response(resultado.value, {
    headers: {
      "Content-Type": resultado.metadata?.contentType || "image/jpeg",
      "Cache-Control": "public, max-age=86400"
      // 1 dia
    }
  });
}
__name(handleServirFoto, "handleServirFoto");
function autenticado(request, env) {
  const senha = request.headers.get("X-Admin-Password");
  return Boolean(env.ADMIN_PASSWORD) && senha === env.ADMIN_PASSWORD;
}
__name(autenticado, "autenticado");
async function handleAdminLogin(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  return jsonResponse({ ok: true });
}
__name(handleAdminLogin, "handleAdminLogin");
async function handleAdminUploadFoto(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  const form = await request.formData();
  const codigo = form.get("codigo");
  const arquivo = form.get("arquivo");
  const categoriaManual = form.get("categoria") || "";
  if (!codigo || !arquivo) {
    return jsonResponse({ error: 'Envie "codigo" e "arquivo".' }, 400);
  }
  const chave = normalizarCodigo(codigo);
  const bytes = await arquivo.arrayBuffer();
  if (bytes.byteLength > 24 * 1024 * 1024) {
    return jsonResponse({ error: "Arquivo grande demais (m\xE1ximo 24MB)." }, 400);
  }
  let categoria = categoriaManual;
  let dadosProduto = null;
  try {
    dadosProduto = await buscarDadosProdutoMersan(chave);
    const indice = indexarCategoriasPorCodigo(await getCategoriasPlanilha(env));
    const daPlanilha = indice[normalizarCodigoInterno(dadosProduto.codigoSku)];
    if (daPlanilha) categoria = daPlanilha;
  } catch {
  }
  await env.FOTOS.put(chave, bytes, {
    metadata: {
      contentType: arquivo.type || "image/jpeg",
      tamanho: bytes.byteLength,
      categoria
    }
  });
  if (dadosProduto && dadosProduto.referencia && !dadosProduto.referencia.includes("n\xE3o encontrado")) {
    try {
      const estoque = await buscarEstoqueMersan(dadosProduto.referencia);
      const estoqueTotal = estoque.reduce((soma, i) => soma + (i.pares || 0), 0);
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
          estoqueTotal
        });
      }
    } catch {
    }
  }
  return jsonResponse({ ok: true, codigo: chave });
}
__name(handleAdminUploadFoto, "handleAdminUploadFoto");
async function handleAdminAtualizarFoto(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  const corpo = await request.json().catch(() => null);
  const codigo = corpo?.codigo;
  const categoria = corpo?.categoria || "";
  if (!codigo) {
    return jsonResponse({ error: 'Par\xE2metro "codigo" \xE9 obrigat\xF3rio.' }, 400);
  }
  const chave = normalizarCodigo(codigo);
  const resultado = await env.FOTOS.getWithMetadata(chave, "arrayBuffer");
  if (!resultado || !resultado.value) {
    return jsonResponse({ error: "Foto n\xE3o encontrada para esse c\xF3digo." }, 404);
  }
  await env.FOTOS.put(chave, resultado.value, {
    metadata: {
      contentType: resultado.metadata?.contentType || "image/jpeg",
      tamanho: resultado.metadata?.tamanho || resultado.value.byteLength,
      categoria
    }
  });
  return jsonResponse({ ok: true, codigo: chave });
}
__name(handleAdminAtualizarFoto, "handleAdminAtualizarFoto");
async function handleAdminRenomearFoto(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  const corpo = await request.json().catch(() => null);
  const codigoAntigo = corpo?.codigoAntigo;
  const codigoNovo = corpo?.codigoNovo;
  if (!codigoAntigo || !codigoNovo) {
    return jsonResponse({ error: 'Envie "codigoAntigo" e "codigoNovo".' }, 400);
  }
  const chaveAntiga = normalizarCodigo(codigoAntigo);
  const chaveNova = normalizarCodigo(codigoNovo);
  if (chaveAntiga === chaveNova) {
    return jsonResponse({ ok: true, codigo: chaveNova });
  }
  const resultado = await env.FOTOS.getWithMetadata(chaveAntiga, "arrayBuffer");
  if (!resultado || !resultado.value) {
    return jsonResponse({ error: "Foto n\xE3o encontrada para o c\xF3digo atual." }, 404);
  }
  const jaExiste = await env.FOTOS.get(chaveNova);
  if (jaExiste) {
    return jsonResponse(
      { error: "J\xE1 existe uma foto cadastrada com essa refer\xEAncia. Exclua a antiga primeiro se quiser substituir." },
      409
    );
  }
  await env.FOTOS.put(chaveNova, resultado.value, {
    metadata: resultado.metadata || {}
  });
  await env.FOTOS.delete(chaveAntiga);
  return jsonResponse({ ok: true, codigo: chaveNova });
}
__name(handleAdminRenomearFoto, "handleAdminRenomearFoto");
async function handleAdminExcluirFoto(request, url, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  const codigo = url.searchParams.get("codigo");
  if (!codigo) {
    return jsonResponse({ error: 'Par\xE2metro "codigo" \xE9 obrigat\xF3rio.' }, 400);
  }
  const chave = normalizarCodigo(codigo);
  await env.FOTOS.delete(chave);
  const novos = await getCatalogoNovos(env);
  if (novos.some((p) => p.codigo === chave)) {
    await env.FOTOS.put(CATALOGO_NOVOS_CHAVE, JSON.stringify(novos.filter((p) => p.codigo !== chave)));
  }
  const indiceBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE);
  const totalLotes = indiceBruto ? JSON.parse(indiceBruto).totalLotes || 0 : 0;
  if (totalLotes > 0) {
    const lotesBrutos = await Promise.all(
      Array.from({ length: totalLotes }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
    );
    for (let i = 0; i < lotesBrutos.length; i++) {
      if (!lotesBrutos[i]) continue;
      const lista = JSON.parse(lotesBrutos[i]);
      if (lista.some((p) => p.codigo === chave)) {
        await env.FOTOS.put(`${CATALOGO_LOTE_PREFIXO}${i}`, JSON.stringify(lista.filter((p) => p.codigo !== chave)));
        break;
      }
    }
  }
  return jsonResponse({ ok: true });
}
__name(handleAdminExcluirFoto, "handleAdminExcluirFoto");
async function handleAdminListarFotos(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  const chavesFotos = await listarTodasFotos(env);
  const fotos = chavesFotos.filter(
    (k) => k.name !== VENDEDORES_CHAVE && k.name !== CATALOGO_CACHE_CHAVE && k.name !== CATALOGO_CURSOR_CHAVE && k.name !== CATEGORIAS_PLANILHA_CHAVE && k.name !== CATALOGO_NOVOS_CHAVE && !k.name.startsWith("_catalogo") && !k.name.startsWith(SELECOES_PREFIXO)
  ).map((k) => ({
    codigo: k.name,
    tamanho: k.metadata?.tamanho || null,
    categoria: k.metadata?.categoria || "",
    modificadoEm: k.metadata?.atualizadoEm || null
  }));
  return jsonResponse({ fotos, truncado: false });
}
__name(handleAdminListarFotos, "handleAdminListarFotos");
async function handleFotosPublicas(env) {
  const chavesFotos = await listarTodasFotos(env);
  const produtos = chavesFotos.filter((k) => k.name !== VENDEDORES_CHAVE && k.name !== CATALOGO_CACHE_CHAVE).map((k) => ({
    codigo: k.name,
    categoria: k.metadata?.categoria || ""
  }));
  return jsonResponse({ produtos, truncado: false });
}
__name(handleFotosPublicas, "handleFotosPublicas");
var VENDEDORES_CHAVE = "_vendedores";
var SELECOES_PREFIXO = "_selecao_";
function gerarIdSelecao() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}
__name(gerarIdSelecao, "gerarIdSelecao");
async function salvarSelecao(env, itens) {
  const id = gerarIdSelecao();
  await env.FOTOS.put(
    `${SELECOES_PREFIXO}${id}`,
    JSON.stringify({ itens, criadoEm: (/* @__PURE__ */ new Date()).toISOString() })
  );
  return id;
}
__name(salvarSelecao, "salvarSelecao");
async function getSelecao(env, id) {
  const bruto = await env.FOTOS.get(`${SELECOES_PREFIXO}${id}`);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto);
  } catch {
    return null;
  }
}
__name(getSelecao, "getSelecao");
async function handleObterSelecao(request, url, env) {
  const id = url.searchParams.get("id");
  if (!id) {
    return jsonResponse({ error: 'Par\xE2metro "id" \xE9 obrigat\xF3rio.' }, 400);
  }
  const selecao = await getSelecao(env, id);
  if (!selecao) {
    return jsonResponse({ error: "Sele\xE7\xE3o n\xE3o encontrada." }, 404);
  }
  return jsonResponse(selecao, 200);
}
__name(handleObterSelecao, "handleObterSelecao");
async function getVendedores(env) {
  const bruto = await env.FOTOS.get(VENDEDORES_CHAVE);
  if (!bruto) return [];
  try {
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
__name(getVendedores, "getVendedores");
async function salvarVendedores(env, lista) {
  await env.FOTOS.put(VENDEDORES_CHAVE, JSON.stringify(lista));
}
__name(salvarVendedores, "salvarVendedores");
async function handleVendedoresPublico(env) {
  const lista = await getVendedores(env);
  const publico = lista.map((v) => ({ id: v.id, nome: v.nome }));
  return jsonResponse({ vendedores: publico });
}
__name(handleVendedoresPublico, "handleVendedoresPublico");
async function handleAdminListarVendedores(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  const lista = await getVendedores(env);
  return jsonResponse({ vendedores: lista });
}
__name(handleAdminListarVendedores, "handleAdminListarVendedores");
async function handleAdminSalvarVendedor(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  const corpo = await request.json().catch(() => null);
  const nome = corpo?.nome?.trim();
  const whatsapp = corpo?.whatsapp?.replace(/\D/g, "");
  if (!nome || !whatsapp) {
    return jsonResponse({ error: 'Envie "nome" e "whatsapp".' }, 400);
  }
  const lista = await getVendedores(env);
  const id = corpo?.id || crypto.randomUUID();
  const existente = lista.findIndex((v) => v.id === id);
  const registro = { id, nome, whatsapp };
  if (existente >= 0) {
    lista[existente] = registro;
  } else {
    lista.push(registro);
  }
  await salvarVendedores(env, lista);
  return jsonResponse({ ok: true, vendedor: registro });
}
__name(handleAdminSalvarVendedor, "handleAdminSalvarVendedor");
var CATEGORIAS_PLANILHA_CHAVE = "_categorias_planilha";
function normalizarCodigoInterno(valor) {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  return digitos.replace(/^0+/, "") || digitos;
}
__name(normalizarCodigoInterno, "normalizarCodigoInterno");
function indexarCategoriasPorCodigo(mapa) {
  const indice = {};
  for (const codigo of Object.keys(mapa || {})) {
    const chave = normalizarCodigoInterno(codigo);
    if (chave) indice[chave] = mapa[codigo];
  }
  return indice;
}
__name(indexarCategoriasPorCodigo, "indexarCategoriasPorCodigo");
async function getCategoriasPlanilha(env) {
  const bruto = await env.FOTOS.get(CATEGORIAS_PLANILHA_CHAVE);
  if (!bruto) return {};
  try {
    const mapa = JSON.parse(bruto);
    return mapa && typeof mapa === "object" ? mapa : {};
  } catch {
    return {};
  }
}
__name(getCategoriasPlanilha, "getCategoriasPlanilha");
async function salvarCategoriasPlanilha(env, mapa) {
  await env.FOTOS.put(CATEGORIAS_PLANILHA_CHAVE, JSON.stringify(mapa));
}
__name(salvarCategoriasPlanilha, "salvarCategoriasPlanilha");
async function handleAdminSalvarPlanilhaGeneros(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  const corpo = await request.json().catch(() => null);
  const mapa = corpo?.mapa;
  if (!mapa || typeof mapa !== "object") {
    return jsonResponse({ error: 'Envie "mapa" (c\xF3digo -> categoria).' }, 400);
  }
  await salvarCategoriasPlanilha(env, mapa);
  return jsonResponse({ ok: true, totalCodigos: Object.keys(mapa).length });
}
__name(handleAdminSalvarPlanilhaGeneros, "handleAdminSalvarPlanilhaGeneros");
async function handleAdminRecalcularCategorias(request, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  const mapa = await getCategoriasPlanilha(env);
  const indiceBrutoCatalogo = await env.FOTOS.get(CATALOGO_CACHE_CHAVE);
  const totalLotesCatalogo = indiceBrutoCatalogo ? JSON.parse(indiceBrutoCatalogo).totalLotes || 0 : 0;
  const lotesGuardados = await Promise.all(
    Array.from({ length: totalLotesCatalogo }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
  );
  const skuPorCodigo = {};
  for (const bruto of lotesGuardados) {
    if (!bruto) continue;
    for (const produto of JSON.parse(bruto)) {
      if (produto.codigoSku) skuPorCodigo[produto.codigo] = String(produto.codigoSku);
    }
  }
  const chavesFotos = await listarTodasFotos(env);
  const fotos = chavesFotos.filter(
    (k) => k.name !== VENDEDORES_CHAVE && k.name !== CATALOGO_CACHE_CHAVE && k.name !== CATALOGO_CURSOR_CHAVE && k.name !== CATEGORIAS_PLANILHA_CHAVE && !k.name.startsWith("_catalogo") && !k.name.startsWith(SELECOES_PREFIXO)
  );
  let atualizados = 0;
  let encontrados = 0;
  let semSku = 0;
  for (const chaveInfo of fotos) {
    const sku = skuPorCodigo[chaveInfo.name];
    if (!sku) {
      semSku++;
      continue;
    }
    const categoriaNova = mapa[sku];
    if (!categoriaNova) continue;
    encontrados++;
    const categoriaAtual = chaveInfo.metadata?.categoria || "";
    if (categoriaAtual === categoriaNova) continue;
    const resultado = await env.FOTOS.getWithMetadata(chaveInfo.name, "arrayBuffer");
    if (!resultado || !resultado.value) continue;
    await env.FOTOS.put(chaveInfo.name, resultado.value, {
      metadata: {
        contentType: resultado.metadata?.contentType || "image/jpeg",
        tamanho: resultado.metadata?.tamanho || resultado.value.byteLength,
        categoria: categoriaNova
      }
    });
    atualizados++;
  }
  return jsonResponse({
    ok: true,
    totalFotos: fotos.length,
    encontradosNaPlanilha: encontrados,
    atualizados,
    semDadosDeSku: semSku
  });
}
__name(handleAdminRecalcularCategorias, "handleAdminRecalcularCategorias");
async function handleAdminExcluirVendedor(request, url, env) {
  if (!autenticado(request, env)) {
    return jsonResponse({ error: "Senha incorreta." }, 401);
  }
  const id = url.searchParams.get("id");
  if (!id) {
    return jsonResponse({ error: 'Par\xE2metro "id" \xE9 obrigat\xF3rio.' }, 400);
  }
  const lista = await getVendedores(env);
  const nova = lista.filter((v) => v.id !== id);
  await salvarVendedores(env, nova);
  return jsonResponse({ ok: true });
}
__name(handleAdminExcluirVendedor, "handleAdminExcluirVendedor");
function paginaLinkManual(linkWhatsApp, mensagemTopo) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mersan Cal\xE7ados</title>
<meta http-equiv="refresh" content="0; url=${escapeHtml(linkWhatsApp)}">
</head>
<body style="font-family:sans-serif;text-align:center;padding:40px 20px;">
  <p style="margin-bottom:24px;">${escapeHtml(mensagemTopo)}</p>
  <a href="${escapeHtml(linkWhatsApp)}" style="display:inline-block;padding:14px 28px;background:#25D366;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">
    Abrir WhatsApp
  </a>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=UTF-8" }
  });
}
__name(paginaLinkManual, "paginaLinkManual");
async function handleIrVendedor(request, url, env) {
  const vendedorId = url.searchParams.get("vendedor");
  const codigo = url.searchParams.get("codigo");
  const tamanho = url.searchParams.get("tamanho");
  const parcelasEscolhidas = Number(url.searchParams.get("parcelas")) || null;
  if (!vendedorId || !codigo) {
    return new Response("Link inv\xE1lido.", { status: 400 });
  }
  const lista = await getVendedores(env);
  const vendedor = lista.find((v) => v.id === vendedorId);
  if (!vendedor) {
    return new Response("Vendedor n\xE3o encontrado. Pe\xE7a para recadastrar esse vendedor no painel admin.", { status: 404 });
  }
  const numeroValido = /^\d{10,15}$/.test(vendedor.whatsapp || "");
  if (!numeroValido) {
    return new Response(
      `O WhatsApp cadastrado para "${vendedor.nome}" est\xE1 inv\xE1lido ("${vendedor.whatsapp || "vazio"}"). Corrija no painel admin (s\xF3 n\xFAmeros, com DDI e DDD, ex: 5511999999999).`,
      { status: 500 }
    );
  }
  let referencia = codigo;
  let preco = null;
  try {
    const controlador = new AbortController();
    const tempoLimite = setTimeout(() => controlador.abort(), 4e3);
    const dados = await buscarDadosProdutoMersan(codigo, controlador.signal);
    clearTimeout(tempoLimite);
    referencia = dados.referencia || codigo;
    preco = dados.preco;
  } catch {
  }
  const idSelecao = await salvarSelecao(env, [{ codigo, tamanho }]);
  const linkSelecao = `${url.origin}/selecao/${idSelecao}`;
  const linhas = [
    "\u{1F6CD}\uFE0F Tenho interesse neste produto da Mersan Cal\xE7ados.",
    "",
    "\u{1F4E6} Itens selecionados: 1",
    ""
  ];
  const partes = [`Ref. ${referenciaParaCliente(referencia)}`];
  if (tamanho) partes.push(`Tam. ${tamanho}`);
  linhas.push(`\u2022 ${partes.join(" | ")}`);
  linhas.push("");
  if (preco != null) {
    linhas.push(`\u{1F4B0} Total: R$ ${preco.toFixed(2).replace(".", ",")}`);
    const maxParcelas = Math.min(MAX_PARCELAS, Math.max(1, Math.floor(preco / PARCELA_MINIMA)));
    const parcelasFinal = parcelasEscolhidas && parcelasEscolhidas >= 1 && parcelasEscolhidas <= maxParcelas ? parcelasEscolhidas : maxParcelas;
    if (parcelasFinal > 1) {
      const valorParcela = (preco / parcelasFinal).toFixed(2).replace(".", ",");
      linhas.push(`Parcelamento: ${parcelasFinal}x de R$ ${valorParcela}`);
    }
    linhas.push("");
  }
  linhas.push("\u{1F517} Ver minha sele\xE7\xE3o:");
  linhas.push(linkSelecao);
  linhas.push("");
  linhas.push("Gostaria de mais informa\xE7\xF5es.");
  const mensagem = linhas.join("\n");
  const linkWhatsApp = `https://wa.me/${vendedor.whatsapp}?text=${encodeURIComponent(mensagem)}`;
  try {
    return Response.redirect(linkWhatsApp, 302);
  } catch {
    return paginaLinkManual(linkWhatsApp, `Toque no bot\xE3o abaixo para falar com ${vendedor.nome}:`);
  }
}
__name(handleIrVendedor, "handleIrVendedor");
async function handleIrVendedorCarrinho(request, url, env) {
  const vendedorId = url.searchParams.get("vendedor");
  const itensBrutos = url.searchParams.get("itens");
  const parcelasEscolhidas = Number(url.searchParams.get("parcelas")) || null;
  if (!vendedorId || !itensBrutos) {
    return new Response("Link inv\xE1lido.", { status: 400 });
  }
  let itens;
  try {
    itens = JSON.parse(itensBrutos);
  } catch {
    return new Response("Link inv\xE1lido.", { status: 400 });
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return new Response("Carrinho vazio.", { status: 400 });
  }
  const lista = await getVendedores(env);
  const vendedor = lista.find((v) => v.id === vendedorId);
  if (!vendedor) {
    return new Response("Vendedor n\xE3o encontrado.", { status: 404 });
  }
  const numeroValido = /^\d{10,15}$/.test(vendedor.whatsapp || "");
  if (!numeroValido) {
    return new Response(
      `O WhatsApp cadastrado para "${vendedor.nome}" parece inv\xE1lido. Pe\xE7a para o administrador corrigir no painel.`,
      { status: 500 }
    );
  }
  const itensDetalhados = [];
  let total = 0;
  for (const item of itens) {
    const codigo = item?.codigo;
    const tamanho = item?.tamanho;
    if (!codigo) continue;
    let referencia = codigo;
    let preco = null;
    try {
      const controlador = new AbortController();
      const tempoLimite = setTimeout(() => controlador.abort(), 4e3);
      const dados = await buscarDadosProdutoMersan(codigo, controlador.signal);
      clearTimeout(tempoLimite);
      referencia = dados.referencia || codigo;
      preco = dados.preco;
    } catch {
    }
    if (preco != null) total += preco;
    itensDetalhados.push({ codigo, tamanho, referencia });
  }
  const idSelecao = await salvarSelecao(env, itens.map((i) => ({ codigo: i.codigo, tamanho: i.tamanho })));
  const linkSelecao = `${url.origin}/selecao/${idSelecao}`;
  const linhas = [
    "\u{1F6CD}\uFE0F Tenho interesse nestes produtos da Mersan Cal\xE7ados.",
    "",
    `\u{1F4E6} Itens selecionados: ${itensDetalhados.length}`,
    ""
  ];
  for (const item of itensDetalhados) {
    const partes = [`Ref. ${referenciaParaCliente(item.referencia)}`];
    if (item.tamanho) partes.push(`Tam. ${item.tamanho}`);
    linhas.push(`\u2022 ${partes.join(" | ")}`);
  }
  linhas.push("");
  if (total > 0) {
    linhas.push(`\u{1F4B0} Total: R$ ${total.toFixed(2).replace(".", ",")}`);
    const maxParcelas = Math.min(MAX_PARCELAS, Math.max(1, Math.floor(total / PARCELA_MINIMA)));
    const parcelasFinal = parcelasEscolhidas && parcelasEscolhidas >= 1 && parcelasEscolhidas <= maxParcelas ? parcelasEscolhidas : maxParcelas;
    if (parcelasFinal > 1) {
      const valorParcela = (total / parcelasFinal).toFixed(2).replace(".", ",");
      linhas.push(`Parcelamento: ${parcelasFinal}x de R$ ${valorParcela}`);
    }
    linhas.push("");
  }
  linhas.push("\u{1F517} Ver minha sele\xE7\xE3o:");
  linhas.push(linkSelecao);
  linhas.push("");
  linhas.push("Gostaria de mais informa\xE7\xF5es.");
  const mensagem = linhas.join("\n");
  const linkWhatsApp = `https://wa.me/${vendedor.whatsapp}?text=${encodeURIComponent(mensagem)}`;
  try {
    return Response.redirect(linkWhatsApp, 302);
  } catch {
    return paginaLinkManual(linkWhatsApp, `Toque no bot\xE3o abaixo para falar com ${vendedor.nome}:`);
  }
}
__name(handleIrVendedorCarrinho, "handleIrVendedorCarrinho");
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
var CATALOGO_CACHE_CHAVE = "_catalogo_pronto";
var CATALOGO_CURSOR_CHAVE = "_catalogo_cursor";
var CATALOGO_LOTE_TAMANHO = 10;
var CATALOGO_LOTE_PREFIXO = "_catalogo_lote_";
var CATALOGO_NOVOS_CHAVE = "_catalogo_novos";
async function getCatalogoNovos(env) {
  const bruto = await env.FOTOS.get(CATALOGO_NOVOS_CHAVE);
  if (!bruto) return [];
  try {
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}
__name(getCatalogoNovos, "getCatalogoNovos");
async function upsertCatalogoNovo(env, item) {
  const lista = await getCatalogoNovos(env);
  const semEsse = lista.filter((p) => p.codigo !== item.codigo);
  semEsse.push(item);
  const limitada = semEsse.slice(-100);
  await env.FOTOS.put(CATALOGO_NOVOS_CHAVE, JSON.stringify(limitada));
}
__name(upsertCatalogoNovo, "upsertCatalogoNovo");
async function preAquecerCatalogoLote(env) {
  const chavesFotos = await listarTodasFotos(env);
  const codigos = chavesFotos.filter((k) => k.name !== VENDEDORES_CHAVE && !k.name.startsWith("_catalogo")).map((k) => ({ codigo: k.name, categoria: k.metadata?.categoria || "" }));
  if (codigos.length === 0) {
    return [];
  }
  const totalLotes = Math.ceil(codigos.length / CATALOGO_LOTE_TAMANHO);
  const cursorBruto = await env.FOTOS.get(CATALOGO_CURSOR_CHAVE);
  let indiceLote = cursorBruto ? parseInt(cursorBruto, 10) : 0;
  if (!Number.isFinite(indiceLote) || indiceLote >= totalLotes) indiceLote = 0;
  const inicio = indiceLote * CATALOGO_LOTE_TAMANHO;
  const lote = codigos.slice(inicio, inicio + CATALOGO_LOTE_TAMANHO);
  const cache = caches.default;
  const origem = "https://mersan-catalogo.diegohenriquenc.workers.dev";
  const indiceCategorias = indexarCategoriasPorCodigo(await getCategoriasPlanilha(env));
  const erros = [];
  const resultados = await Promise.all(
    lote.map(async (item) => {
      try {
        const dados = await buscarDadosProdutoMersan(item.codigo);
        let categoriaItem = item.categoria;
        const categoriaPlanilha = indiceCategorias[normalizarCodigoInterno(dados.codigoSku)];
        if (categoriaPlanilha && categoriaPlanilha !== categoriaItem) {
          categoriaItem = categoriaPlanilha;
          try {
            const fotoAtual = await env.FOTOS.getWithMetadata(item.codigo, "arrayBuffer");
            if (fotoAtual && fotoAtual.value) {
              await env.FOTOS.put(item.codigo, fotoAtual.value, {
                metadata: {
                  contentType: fotoAtual.metadata?.contentType || "image/jpeg",
                  tamanho: fotoAtual.metadata?.tamanho || fotoAtual.value.byteLength,
                  categoria: categoriaPlanilha
                }
              });
            }
          } catch {
          }
        }
        const urlProduto = `${origem}/api/produto?termo=${encodeURIComponent(item.codigo)}`;
        await cache.put(
          new Request(urlProduto),
          jsonResponse(dados, 200, { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` })
        );
        if (!dados.referencia || dados.referencia.includes("n\xE3o encontrado")) {
          erros.push({ codigo: item.codigo, motivo: "sem refer\xEAncia" });
          return null;
        }
        const estoque = await buscarEstoqueMersan(dados.referencia);
        const urlEstoque = `${origem}/api/estoque?referencia=${encodeURIComponent(dados.referencia)}`;
        await cache.put(
          new Request(urlEstoque),
          jsonResponse(
            { referencia: dados.referencia, loja: LOJA, estoque, atualizadoEm: (/* @__PURE__ */ new Date()).toISOString() },
            200,
            { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` }
          )
        );
        const estoqueTotal = estoque.reduce((soma, i) => soma + (i.pares || 0), 0);
        if (estoqueTotal === 0) {
          erros.push({ codigo: item.codigo, motivo: "sem estoque" });
          return null;
        }
        return {
          codigo: item.codigo,
          categoria: categoriaItem,
          codigoSku: dados.codigoSku,
          promocao: dados.emPromocao,
          nome: dados.nome,
          tamanho: dados.tamanho,
          preco: dados.preco,
          precoOriginal: dados.precoOriginal,
          estoqueTotal
        };
      } catch (err) {
        erros.push({ codigo: item.codigo, motivo: String(err?.message || err) });
        return null;
      }
    })
  );
  await env.FOTOS.put(`${CATALOGO_LOTE_PREFIXO}${indiceLote}`, JSON.stringify(resultados.filter(Boolean)));
  await env.FOTOS.put(
    CATALOGO_CACHE_CHAVE,
    JSON.stringify({ totalLotes, atualizadoEm: (/* @__PURE__ */ new Date()).toISOString() })
  );
  const proximoIndice = indiceLote + 1 >= totalLotes ? 0 : indiceLote + 1;
  await env.FOTOS.put(CATALOGO_CURSOR_CHAVE, String(proximoIndice));
  return erros;
}
__name(preAquecerCatalogoLote, "preAquecerCatalogoLote");
async function handleCatalogoPronto(env, ctx) {
  const indiceBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE);
  const totalLotes = indiceBruto ? JSON.parse(indiceBruto).totalLotes || 0 : 0;
  const lotes = totalLotes ? await Promise.all(
    Array.from({ length: totalLotes }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
  ) : [];
  const produtos = lotes.flatMap((l) => l ? JSON.parse(l) : []);
  const novos = await getCatalogoNovos(env);
  const codigosNoCatalogo = new Set(produtos.map((p) => p.codigo));
  const novosAindaFaltando = novos.filter((n) => !codigosNoCatalogo.has(n.codigo));
  if (novosAindaFaltando.length !== novos.length) {
    ctx.waitUntil(env.FOTOS.put(CATALOGO_NOVOS_CHAVE, JSON.stringify(novosAindaFaltando)));
  }
  const todosProdutos = [...produtos, ...novosAindaFaltando];
  const codigosVistos = /* @__PURE__ */ new Set();
  const semDuplicata = [];
  for (const p of todosProdutos) {
    if (codigosVistos.has(p.codigo)) continue;
    codigosVistos.add(p.codigo);
    semDuplicata.push(p);
  }
  const produtosComEstoque = semDuplicata.filter((p) => p.estoqueTotal == null || p.estoqueTotal > 0);
  return jsonResponse({ produtos: produtosComEstoque }, 200, {
    "Cache-Control": "public, max-age=120"
  });
}
__name(handleCatalogoPronto, "handleCatalogoPronto");
async function preAquecerCatalogoAgendado(env) {
  await preAquecerCatalogoLote(env);
}
__name(preAquecerCatalogoAgendado, "preAquecerCatalogoAgendado");
async function handleCatalogoDebug(env) {
  const cursorBruto = await env.FOTOS.get(CATALOGO_CURSOR_CHAVE);
  const indiceBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE);
  const chavesFotos = await listarTodasFotos(env);
  const codigos = chavesFotos.filter((k) => k.name !== VENDEDORES_CHAVE && !k.name.startsWith("_catalogo")).map((k) => k.name);
  const totalLotes = Math.ceil(codigos.length / CATALOGO_LOTE_TAMANHO);
  let indiceLote = cursorBruto ? parseInt(cursorBruto, 10) : 0;
  if (!Number.isFinite(indiceLote) || indiceLote >= totalLotes) indiceLote = 0;
  const inicio = indiceLote * CATALOGO_LOTE_TAMANHO;
  const lote = codigos.slice(inicio, inicio + CATALOGO_LOTE_TAMANHO);
  const lotesGuardados = await Promise.all(
    Array.from({ length: totalLotes }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
  );
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
  });
}
__name(handleCatalogoDebug, "handleCatalogoDebug");
async function handleCatalogoForcar(env) {
  const erros = await preAquecerCatalogoLote(env);
  const indiceBruto = await env.FOTOS.get(CATALOGO_CACHE_CHAVE);
  if (!indiceBruto) return jsonResponse({ produtos: [] }, 200);
  const { totalLotes } = JSON.parse(indiceBruto);
  const lotes = await Promise.all(
    Array.from({ length: totalLotes || 0 }, (_, i) => env.FOTOS.get(`${CATALOGO_LOTE_PREFIXO}${i}`))
  );
  const produtos = lotes.flatMap((l) => l ? JSON.parse(l) : []);
  return jsonResponse({ produtos, erros }, 200);
}
__name(handleCatalogoForcar, "handleCatalogoForcar");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Lunhls/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Lunhls/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
