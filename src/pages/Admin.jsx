import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { CATEGORIAS_PRODUTO } from '../utils/categorias.js'

const IMAGEM_PADRAO = '/icons/icon-512.svg'

export default function Admin() {
  const [senha, setSenha] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [erroLogin, setErroLogin] = useState(null)
  const [verificandoLogin, setVerificandoLogin] = useState(false)

  useEffect(() => {
    const salva = sessionStorage.getItem('mersan_admin_senha')
    if (salva) {
      setSenha(salva)
      setAutenticado(true)
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setVerificandoLogin(true)
    setErroLogin(null)
    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'X-Admin-Password': senha }
      })
      if (!resp.ok) {
        setErroLogin('Senha incorreta.')
        return
      }
      sessionStorage.setItem('mersan_admin_senha', senha)
      setAutenticado(true)
    } catch {
      setErroLogin('Não foi possível conectar. Tente novamente.')
    } finally {
      setVerificandoLogin(false)
    }
  }

  if (!autenticado) {
    return (
      <main style={styles.main}>
        <form onSubmit={handleLogin} style={styles.loginBox}>
          <h1 style={styles.titulo}>Painel administrativo</h1>
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={styles.input}
            autoFocus
          />
          {erroLogin && <p style={styles.erro}>{erroLogin}</p>}
          <button type="submit" style={styles.botao} disabled={verificandoLogin}>
            {verificandoLogin ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </main>
    )
  }

  return <PainelFotos senha={senha} />
}

function PainelFotos({ senha }) {
  const [codigo, setCodigo] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [editando, setEditando] = useState(null)
  const [renomeando, setRenomeando] = useState(null)
  const [novaReferencia, setNovaReferencia] = useState('')
  const [salvandoReferencia, setSalvandoReferencia] = useState(false)
  const [erroReferencia, setErroReferencia] = useState(null)
  const [preview, setPreview] = useState(null)
  const [status, setStatus] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [fotos, setFotos] = useState([])
  const [carregandoLista, setCarregandoLista] = useState(false)

  const [vendedores, setVendedores] = useState([])
  const [nomeVendedor, setNomeVendedor] = useState('')
  const [whatsappVendedor, setWhatsappVendedor] = useState('')
  const [salvandoVendedor, setSalvandoVendedor] = useState(false)

  const [scanAtivo, setScanAtivo] = useState(false)
    const [scanErro, setScanErro] = useState(null)
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const scanLoopRef = useRef(null)

    const [arquivoPlanilha, setArquivoPlanilha] = useState(null)
    const [totalCodigosPlanilha, setTotalCodigosPlanilha] = useState(null)
    const [enviandoPlanilha, setEnviandoPlanilha] = useState(false)
    const [statusPlanilha, setStatusPlanilha] = useState(null)
    const [recalculando, setRecalculando] = useState(false)
    const [statusRecalculo, setStatusRecalculo] = useState(null)

  // Seleção múltipla, ações em massa, paginação e aba de esgotados
  const [selecionados, setSelecionados] = useState(new Set())
  const [aplicandoEmMassa, setAplicandoEmMassa] = useState(false)
  const [statusEmMassa, setStatusEmMassa] = useState(null)
  const [categoriaEscolhidaEmMassa, setCategoriaEscolhidaEmMassa] = useState('')
  const [aplicandoCategoria, setAplicandoCategoria] = useState(false)
  const [statusCategoriaEmMassa, setStatusCategoriaEmMassa] = useState(null)
  const [limiteExibicao, setLimiteExibicao] = useState(50)
  const [abaAtiva, setAbaAtiva] = useState('cadastradas')
  const [estoquePorCodigo, setEstoquePorCodigo] = useState({})
  const [nomePorCodigo, setNomePorCodigo] = useState({})
  const [termoBusca, setTermoBusca] = useState('')
  const [categoriaFiltroAdmin, setCategoriaFiltroAdmin] = useState(null)
  const [listaAberta, setListaAberta] = useState(false)
  const [codigoExcluirManual, setCodigoExcluirManual] = useState('')
  const [excluindoManual, setExcluindoManual] = useState(false)
  const [statusExcluirManual, setStatusExcluirManual] = useState(null)


  const carregarLista = useCallback(async () => {
    setCarregandoLista(true)
    try {
      const resp = await fetch('/api/admin/fotos', {
        headers: { 'X-Admin-Password': senha }
      })
      const data = await resp.json()
      setFotos(data.fotos || [])
    } catch {
    } finally {
      setCarregandoLista(false)
    }
  }, [senha])

  useEffect(() => {
    carregarLista()
  }, [carregarLista])

  const carregarVendedores = useCallback(async () => {
    try {
      const resp = await fetch('/api/admin/vendedores', {
        headers: { 'X-Admin-Password': senha }
      })
      const data = await resp.json()
      setVendedores(data.vendedores || [])
    } catch {
    }
  }, [senha])

  useEffect(() => {
    carregarVendedores()
  }, [carregarVendedores])

  // Usa o endpoint de admin (não o /api/catalogo público) porque esse
  // último já vem SEM os produtos de estoque zerado — é assim que a
  // vitrine funciona, mas isso escondia do admin justamente os produtos
  // que esgotaram. O endpoint de admin traz o estoque real, incluindo 0.
  const carregarEstoques = useCallback(async () => {
    try {
      const resp = await fetch('/api/admin/estoque-cadastrados', {
        headers: { 'X-Admin-Password': senha }
      })
      const data = await resp.json()
      setEstoquePorCodigo(data.estoques || {})
      setNomePorCodigo(data.nomes || {})
    } catch {
    }
  }, [senha])

  useEffect(() => {
    carregarEstoques()
  }, [carregarEstoques])

  async function handleSalvarVendedor(e) {
    e.preventDefault()
    if (!nomeVendedor || !whatsappVendedor) return

    setSalvandoVendedor(true)
    try {
      await fetch('/api/admin/vendedores', {
        method: 'POST',
        headers: {
          'X-Admin-Password': senha,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nome: nomeVendedor, whatsapp: whatsappVendedor })
      })
      setNomeVendedor('')
      setWhatsappVendedor('')
      carregarVendedores()
    } catch {
      alert('Não foi possível salvar o vendedor agora. Tente novamente.')
    } finally {
      setSalvandoVendedor(false)
    }
  }

  async function handleExcluirVendedor(id) {
    if (!confirm('Excluir este vendedor?')) return
    try {
      await fetch(`/api/admin/vendedores?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': senha }
      })
      carregarVendedores()
    } catch {
      alert('Não foi possível excluir agora. Tente novamente.')
    }
  }

  function handleArquivo(e) {
    const file = e.target.files?.[0] || null
    setArquivo(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  async function abrirLeitor(alvo = 'principal') {
    setScanErro(null)

    if (!('BarcodeDetector' in window)) {
      setScanErro('Este navegador não suporta leitura automática. Digite o código manualmente.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      setScanAtivo(true)

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          iniciarLeitura(alvo)
        }
      }, 0)
    } catch {
      setScanErro('Não foi possível acessar a câmera. Verifique a permissão do navegador.')
    }
  }

  function fecharLeitor() {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setScanAtivo(false)
  }

  function iniciarLeitura(alvo) {
    const detector = new window.BarcodeDetector()

    async function verificar() {
      if (!videoRef.current) return
      try {
        const codigos = await detector.detect(videoRef.current)
        if (codigos.length > 0) {
          if (alvo === 'referencia') {
            setNovaReferencia(codigos[0].rawValue)
          } else {
            setCodigo(codigos[0].rawValue)
          }
          fecharLeitor()
          return
        }
      } catch {
      }
      scanLoopRef.current = requestAnimationFrame(verificar)
    }

    scanLoopRef.current = requestAnimationFrame(verificar)
  }

  useEffect(() => {
    return () => fecharLeitor()
  }, [])

  const TAMANHO_MAXIMO_BYTES = 400 * 1024

  async function comprimirImagem(file) {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height))
    const largura = Math.round(bitmap.width * escala)
    const altura = Math.round(bitmap.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, largura, altura)

    const qualidades = [0.82, 0.7, 0.55, 0.4]
    let ultimoBlob = null

    for (const qualidade of qualidades) {
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', qualidade)
      )
      ultimoBlob = blob
      if (blob && blob.size <= TAMANHO_MAXIMO_BYTES) break
    }

    return new File([ultimoBlob], 'foto.jpg', { type: 'image/jpeg' })
  }

  // Calcula a(s) categoria(s) de um item da planilha.
  //
  // Chuteira é categoria própria, com prioridade máxima, e não depende só
  // da coluna Linha: se a Descrição do produto contiver "chuteira" (em
  // qualquer caixa), vira "Chuteira" mesmo que a Linha diga outra coisa
  // (ex: "ESPORTE") — mais robusto que confiar só no cadastro da Mersan.
  // Sem esse sinal no nome, cai pra Chuteira mesmo assim se a Linha for
  // "FUTEBOL". Nos dois casos, independente de gênero ou faixa etária.
  //
  // Taxonomia atual (só estas 7 categorias — sem Unissex e sem Corrida,
  // por decisão do negócio): Feminino, Masculino, Esportivo Feminino,
  // Esportivo Masculino, Chuteira, Infantil Feminino, Infantil Masculino.
  // Genero UNISEX/UNISSEX não tem categoria própria mais — fica sem
  // categoria (mesmo comportamento de quando o gênero vem vazio/inválido).
  // Itens com Linha "CORRIDA" caem no rótulo simples (Feminino/Masculino),
  // igual a qualquer outro item sem linha especial.
  //
  // Para Masculino/Feminino, ordem de prioridade (da mais alta pra mais
  // baixa): Infantil (faixa "INFANTIL") > Esportivo (linha "ESPORTE") >
  // rótulo simples (nenhuma das anteriores).
  function calcularCategoriasPlanilha(descricao, faixaEtaria, genero, linha) {
    const descricaoNormalizada = (descricao || '').toUpperCase()
    const linhaNormalizada = (linha || '').trim().toUpperCase()
    if (descricaoNormalizada.includes('CHUTEIRA') || linhaNormalizada === 'FUTEBOL') {
      return ['Chuteira']
    }

    const generoNormalizado = (genero || '').trim().toUpperCase()

    if (generoNormalizado !== 'MASCULINO' && generoNormalizado !== 'FEMININO') {
      return []
    }

    const infantil = (faixaEtaria || '').trim().toUpperCase() === 'INFANTIL'
    const esportivo = linhaNormalizada === 'ESPORTE'
    const rotulo = generoNormalizado === 'MASCULINO' ? 'Masculino' : 'Feminino'

    if (infantil) return [`Infantil ${rotulo}`]
    if (esportivo) return [`Esportivo ${rotulo}`]
    return [rotulo]
  }

  // Parser simples de CSV, com suporte a campos entre aspas (caso a
  // descrição do produto tenha vírgula). Funciona tanto com CSV separado
  // por vírgula quanto por ponto e vírgula (detecta pelo cabeçalho).
  function parseCsv(texto) {
    const linhas = texto.split(/\r\n|\n|\r/).filter((l) => l.length > 0)
    if (linhas.length === 0) return []

    const separador = linhas[0].includes(';') && !linhas[0].includes(',') ? ';' : ','

    function parseLinha(linha) {
      const campos = []
      let atual = ''
      let dentroAspas = false
      for (let i = 0; i < linha.length; i++) {
        const c = linha[i]
        if (c === '"') {
          dentroAspas = !dentroAspas
        } else if (c === separador && !dentroAspas) {
          campos.push(atual)
          atual = ''
        } else {
          atual += c
        }
      }
      campos.push(atual)
      return campos.map((c) => c.trim())
    }

    const cabecalho = parseLinha(linhas[0]).map((c) => c.toLowerCase())
    const idxCodigo = cabecalho.findIndex((c) => c.includes('código') || c.includes('codigo'))
    const idxDescricao = cabecalho.findIndex((c) => c.includes('descrição') || c.includes('descricao'))
    const idxFaixa = cabecalho.findIndex((c) => c.includes('faixa'))
    const idxGenero = cabecalho.findIndex((c) => c.includes('gênero') || c.includes('genero'))
    const idxLinha = cabecalho.findIndex((c) => c.includes('linha'))

    const registros = []
    for (let i = 1; i < linhas.length; i++) {
      const campos = parseLinha(linhas[i])
      const codigo = idxCodigo >= 0 ? campos[idxCodigo] : null
      if (!codigo) continue
      registros.push({
        codigo,
        descricao: idxDescricao >= 0 ? campos[idxDescricao] : '',
        faixaEtaria: idxFaixa >= 0 ? campos[idxFaixa] : '',
        genero: idxGenero >= 0 ? campos[idxGenero] : '',
        linha: idxLinha >= 0 ? campos[idxLinha] : ''
      })
    }
    return registros
  }

  function handleArquivoPlanilha(e) {
    const file = e.target.files?.[0] || null
    setTotalCodigosPlanilha(null)

    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      setArquivoPlanilha(null)
      setStatusPlanilha({ tipo: 'erro', texto: 'Esse arquivo não parece ser um .csv. Escolha o arquivo certo.' })
      return
    }

    setArquivoPlanilha(file)
    setStatusPlanilha(null)
  }

  async function handleEnviarPlanilha() {
    if (!arquivoPlanilha) return
    setEnviandoPlanilha(true)
    setStatusPlanilha(null)

    try {
      const texto = await arquivoPlanilha.text()
      const registros = parseCsv(texto)

      const mapa = {}
      for (const registro of registros) {
        const categorias = calcularCategoriasPlanilha(registro.descricao, registro.faixaEtaria, registro.genero, registro.linha)
        if (categorias.length === 0) continue
        mapa[registro.codigo] = categorias.join(', ')
      }

      const totalCodigos = Object.keys(mapa).length
      setTotalCodigosPlanilha(totalCodigos)

      if (totalCodigos === 0) {
        setStatusPlanilha({ tipo: 'erro', texto: 'Não achei colunas de código/gênero reconhecíveis nesse arquivo.' })
        return
      }

      const resp = await fetch('/api/admin/planilha-generos', {
        method: 'POST',
        headers: {
          'X-Admin-Password': senha,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mapa })
      })
      const data = await resp.json()

      if (!resp.ok) {
        setStatusPlanilha({ tipo: 'erro', texto: data.error || 'Falha ao enviar a planilha.' })
      } else {
        const atualizados = data.recalculo?.atualizados ?? 0
        const protegidos = data.recalculo?.protegidosPorCategoriaManual ?? 0
        setStatusPlanilha({
          tipo: 'sucesso',
          texto: `Planilha salva: ${data.totalCodigos} códigos. Categoria já reaplicada nos produtos cadastrados (${atualizados} atualizados agora, ${protegidos} protegidos por categoria manual 🔒).`
        })
      }
    } catch {
      setStatusPlanilha({ tipo: 'erro', texto: 'Não foi possível ler ou enviar esse arquivo.' })
    } finally {
      setEnviandoPlanilha(false)
    }
  }

  async function handleRecalcularCategorias() {
    setRecalculando(true)
    setStatusRecalculo(null)
    try {
      const resp = await fetch('/api/admin/recalcular-categorias', {
        method: 'POST',
        headers: { 'X-Admin-Password': senha }
      })
      const data = await resp.json()
      if (!resp.ok) {
        setStatusRecalculo({ tipo: 'erro', texto: data.error || 'Falha ao recalcular.' })
      } else {
        setStatusRecalculo({
          tipo: 'sucesso',
          texto: `${data.atualizados} de ${data.totalFotos} produtos atualizados (${data.encontradosNaPlanilha} encontrados na planilha, ${data.protegidosPorCategoriaManual || 0} protegidos por categoria manual 🔒).`
        })
        carregarLista()
      }
    } catch {
      setStatusRecalculo({ tipo: 'erro', texto: 'Não foi possível conectar.' })
    } finally {
      setRecalculando(false)
    }
      }

  async function handleEnviar(e) {
    e.preventDefault()
    if (!codigo || !arquivo) return

    setEnviando(true)
    setStatus(null)

    try {
      const form = new FormData()
      form.append('codigo', codigo)
      try {
        const arquivoComprimido = await comprimirImagem(arquivo)
        form.append('arquivo', arquivoComprimido)
      } catch {
        form.append('arquivo', arquivo)
      }
      const resp = await fetch('/api/admin/foto', {
        method: 'POST',
        headers: { 'X-Admin-Password': senha },
        body: form
      })
      const data = await resp.json()
      if (!resp.ok) {
        setStatus({ tipo: 'erro', texto: data.error || 'Falha ao enviar.' })
      } else {
        setStatus({ tipo: 'sucesso', texto: `Foto salva para "${data.codigo}".` })
        setCodigo('')
        setArquivo(null)
        setPreview(null)
        setEditando(null)
        carregarLista()
      }
    } catch {
      setStatus({ tipo: 'erro', texto: 'Não foi possível conectar.' })
    } finally {
      setEnviando(false)
    }
  }

  function handleEditar(foto) {
    setEditando(foto.codigo)
    setCodigo(foto.codigo)
    setArquivo(null)
    setPreview(`/produto-foto/${encodeURIComponent(foto.codigo)}`)
    setStatus(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelarEdicao() {
    setEditando(null)
    setCodigo('')
    setArquivo(null)
    setPreview(null)
    setStatus(null)
  }

  function handleIniciarRenomear(foto) {
    setRenomeando(foto.codigo)
    setNovaReferencia(foto.codigo)
    setErroReferencia(null)
  }

  function handleCancelarRenomear() {
    setRenomeando(null)
    setNovaReferencia('')
    setErroReferencia(null)
  }

  async function handleSalvarReferencia() {
    if (!renomeando || !novaReferencia) return

    setSalvandoReferencia(true)
    setErroReferencia(null)
    try {
      const resp = await fetch('/api/admin/foto/renomear', {
        method: 'POST',
        headers: {
          'X-Admin-Password': senha,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ codigoAntigo: renomeando, codigoNovo: novaReferencia })
      })
      const data = await resp.json()
      if (!resp.ok) {
        setErroReferencia(data.error || 'Não foi possível alterar a referência.')
      } else {
        setRenomeando(null)
        setNovaReferencia('')
        carregarLista()
      }
    } catch {
      setErroReferencia('Não foi possível conectar. Tente novamente.')
    } finally {
      setSalvandoReferencia(false)
    }
  }

  async function handleExcluir(codigoFoto) {
    if (!confirm(`Excluir a foto de "${codigoFoto}"?`)) return
    try {
      await fetch(`/api/admin/foto?codigo=${encodeURIComponent(codigoFoto)}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': senha }
      })
      carregarLista()
    } catch {
      alert('Não foi possível excluir agora. Tente novamente.')
    }
  }

  function alternarSelecao(codigoFoto) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(codigoFoto)) novo.delete(codigoFoto)
      else novo.add(codigoFoto)
      return novo
    })
  }

  function limparSelecao() {
    setSelecionados(new Set())
    setStatusEmMassa(null)
  }

  async function handleExcluirEmMassa() {
    if (selecionados.size === 0) return
    if (!confirm(`Excluir ${selecionados.size} produtos selecionados? Essa ação não pode ser desfeita.`)) return
    setAplicandoEmMassa(true)
    setStatusEmMassa(null)
    try {
      const codigos = Array.from(selecionados)
      await Promise.all(
        codigos.map((codigoFoto) =>
          fetch(`/api/admin/foto?codigo=${encodeURIComponent(codigoFoto)}`, {
            method: 'DELETE',
            headers: { 'X-Admin-Password': senha }
          })
        )
      )
      setStatusEmMassa({ tipo: 'sucesso', texto: `${codigos.length} produtos excluídos.` })
      setSelecionados(new Set())
      carregarLista()
      carregarEstoques()
    } catch {
      setStatusEmMassa({ tipo: 'erro', texto: 'Não foi possível excluir todos. Tente novamente.' })
    } finally {
      setAplicandoEmMassa(false)
    }
  }

  async function handleAplicarCategoriaEmMassa() {
    if (selecionados.size === 0 || !categoriaEscolhidaEmMassa) return
    setAplicandoCategoria(true)
    setStatusCategoriaEmMassa(null)
    try {
      const codigos = Array.from(selecionados)
      const resp = await fetch('/api/admin/categoria-manual', {
        method: 'POST',
        headers: {
          'X-Admin-Password': senha,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ codigos, categoria: categoriaEscolhidaEmMassa })
      })
      const data = await resp.json()
      if (!resp.ok) {
        setStatusCategoriaEmMassa({ tipo: 'erro', texto: data.error || 'Falha ao aplicar categoria.' })
      } else {
        setStatusCategoriaEmMassa({
          tipo: 'sucesso',
          texto: `${data.atualizados} produtos atualizados para "${categoriaEscolhidaEmMassa}". Essa categoria fica protegida e não será sobrescrita por planilhas futuras.`
        })
        setSelecionados(new Set())
        setCategoriaEscolhidaEmMassa('')
        carregarLista()
      }
    } catch {
      setStatusCategoriaEmMassa({ tipo: 'erro', texto: 'Não foi possível conectar. Tente novamente.' })
    } finally {
      setAplicandoCategoria(false)
    }
  }

  async function handleExcluirManual() {
    const codigoFoto = codigoExcluirManual.trim()
    if (!codigoFoto) return
    if (!confirm(`Excluir "${codigoFoto}" do catálogo? Use isso pra itens "fantasma" que aparecem no site mas não têm foto cadastrada.`)) return

    setExcluindoManual(true)
    setStatusExcluirManual(null)
    try {
      await fetch(`/api/admin/foto?codigo=${encodeURIComponent(codigoFoto)}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': senha }
      })
      setStatusExcluirManual({ tipo: 'sucesso', texto: `"${codigoFoto}" removido. Pode levar alguns segundos pra sumir do catálogo.` })
      setCodigoExcluirManual('')
      carregarLista()
      carregarEstoques()
    } catch {
      setStatusExcluirManual({ tipo: 'erro', texto: 'Não foi possível excluir agora. Tente novamente.' })
    } finally {
      setExcluindoManual(false)
    }
  }

  function handleSair() {
    sessionStorage.removeItem('mersan_admin_senha')
    window.location.reload()
  }

  const fotosEsgotadas = fotos.filter((f) => estoquePorCodigo[f.codigo] === 0)
  const fotosNormais = fotos.filter((f) => estoquePorCodigo[f.codigo] !== 0)

  // Busca por código, nome (do catálogo já processado) ou categoria — ex:
  // digitar "chuteira" acha tanto produtos já categorizados como Chuteira
  // quanto produtos cujo NOME tem "chuteira" mas ainda não foram
  // categorizados, que é justamente o caso de uso: achar tudo, selecionar
  // tudo, aplicar a categoria em massa.
  const termoBuscaNormalizado = termoBusca.trim().toLowerCase()
  function correspondeABusca(f) {
    if (!termoBuscaNormalizado) return true
    const nome = (nomePorCodigo[f.codigo] || '').toLowerCase()
    const categoria = (f.categoria || '').toLowerCase()
    return (
      f.codigo.toLowerCase().includes(termoBuscaNormalizado) ||
      nome.includes(termoBuscaNormalizado) ||
      categoria.includes(termoBuscaNormalizado)
    )
  }

  // Gaveta por categoria, igual à de Esgotados: cada botão mostra quantos
  // produtos tem (cadastrados + esgotados juntos, é uma pergunta diferente
  // de "está em estoque?") e clicar filtra a lista abaixo por ela. "Sem
  // categoria" entra também, pra achar rápido o que ainda falta categorizar.
  const SEM_CATEGORIA = 'Sem categoria'
  const contagemPorCategoria = {}
  for (const f of fotos) {
    const cat = f.categoria || SEM_CATEGORIA
    contagemPorCategoria[cat] = (contagemPorCategoria[cat] || 0) + 1
  }

  function correspondeACategoria(f) {
    if (!categoriaFiltroAdmin) return true
    const cat = f.categoria || SEM_CATEGORIA
    return cat === categoriaFiltroAdmin
  }

  function selecionarCategoriaAdmin(cat) {
    setCategoriaFiltroAdmin((atual) => (atual === cat ? null : cat))
    limparSelecao()
  }

  const fotosEsgotadasFiltradas = fotosEsgotadas.filter((f) => correspondeABusca(f) && correspondeACategoria(f))
  const fotosNormaisFiltradas = fotosNormais.filter((f) => correspondeABusca(f) && correspondeACategoria(f))
  const fotosExibidas = abaAtiva === 'esgotados' ? fotosEsgotadasFiltradas : fotosNormaisFiltradas
  // Buscando ou filtrando por categoria, mostra TODOS os resultados de uma
  // vez (sem o limite de 50), pra "Selecionar todos os visíveis" selecionar
  // de fato tudo que foi encontrado.
  const fotosParaMostrar = (termoBuscaNormalizado || categoriaFiltroAdmin) ? fotosExibidas : fotosExibidas.slice(0, limiteExibicao)

  function selecionarTodosVisiveis() {
    setSelecionados(new Set(fotosParaMostrar.map((f) => f.codigo)))
  }

  return (
    <main style={styles.main}>
      <div style={styles.painel}>
        <div style={styles.cabecalho}>
          <h1 style={styles.titulo}>Fotos dos produtos</h1>
          <button onClick={handleSair} style={styles.botaoSair}>
            Sair
          </button>
        </div>

        <form onSubmit={handleEnviar} style={styles.formUpload}>
          {editando && (
            <p style={styles.editandoAviso}>
              ✏️ Editando "{editando}" — escolha uma foto nova para atualizar.
            </p>
          )}

          <label style={styles.label}>
            Código do produto (código de barras, SKU ou referência)
            <div style={styles.linhaCodigo}>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: 7770005662888"
                style={{ ...styles.input, flex: 1 }}
                disabled={Boolean(editando)}
              />
              <button type="button" onClick={abrirLeitor} style={styles.botaoBipar}>
                📷 Bipar
              </button>
            </div>
            {scanErro && <p style={styles.erro}>{scanErro}</p>}
          </label>

          <label style={styles.label}>
            Foto
            <input type="file" accept="image/*" onChange={handleArquivo} style={styles.inputArquivo} />
          </label>

          <p style={styles.vazio}>
            A categoria é definida automaticamente pela planilha de gêneros (veja abaixo), a partir do SKU do produto.
            Se quiser escolher a categoria de um ou mais produtos à mão, abra a lista abaixo, marque os produtos e use
            "Categoria dos selecionados" — categorias escolhidas assim ficam marcadas com 🔒 e não são mais alteradas
            pela planilha.
          </p>

          {preview && <img src={preview} alt="Pré-visualização" style={styles.preview} />}

          {status && (
            <p style={status.tipo === 'erro' ? styles.erro : styles.sucesso}>{status.texto}</p>
          )}

          <button
            type="submit"
            style={styles.botao}
            disabled={enviando || !codigo || !arquivo}
          >
            {enviando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar foto'}
          </button>

          {editando && (
            <button type="button" onClick={handleCancelarEdicao} style={styles.botaoSecundario}>
              Cancelar edição
            </button>
          )}
        </form>

        <div style={styles.listaBox}>
          <label style={styles.label}>
            Excluir por código (pra itens que aparecem no catálogo mas não na lista abaixo — sem foto cadastrada)
            <div style={styles.linhaCodigo}>
              <input
                type="text"
                value={codigoExcluirManual}
                onChange={(e) => setCodigoExcluirManual(e.target.value)}
                placeholder="Cole aqui o código do produto fantasma"
                style={{ ...styles.input, flex: 1 }}
              />
              <button
                type="button"
                onClick={handleExcluirManual}
                style={styles.botaoExcluir}
                disabled={excluindoManual || !codigoExcluirManual.trim()}
              >
                {excluindoManual ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </label>
          {statusExcluirManual && (
            <p style={statusExcluirManual.tipo === 'erro' ? styles.erro : styles.sucesso}>{statusExcluirManual.texto}</p>
          )}

          <button
            type="button"
            onClick={() => setListaAberta((v) => !v)}
            style={styles.botaoAbrirLista}
          >
            {listaAberta ? '▾' : '▸'} {fotosNormais.length + fotosEsgotadas.length} produtos cadastrados — clique para {listaAberta ? 'fechar' : 'abrir'} a lista
          </button>

          {listaAberta && (
          <>
          <div style={styles.buscaBox}>
            <span style={styles.buscaIcone}>🔍</span>
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Buscar por código, nome ou categoria (ex: chuteira)"
              style={styles.buscaInput}
            />
            {termoBusca && (
              <button type="button" onClick={() => setTermoBusca('')} style={styles.buscaLimpar} aria-label="Limpar busca">
                ✕
              </button>
            )}
          </div>

          <div style={styles.abas}>
            <button
              type="button"
              onClick={() => { setAbaAtiva('cadastradas'); limparSelecao() }}
              style={abaAtiva === 'cadastradas' ? styles.abaBotaoAtiva : styles.abaBotao}
            >
              Fotos cadastradas ({fotosNormaisFiltradas.length})
            </button>
            <button
              type="button"
              onClick={() => { setAbaAtiva('esgotados'); limparSelecao() }}
              style={abaAtiva === 'esgotados' ? styles.abaBotaoAtiva : styles.abaBotao}
            >
              Esgotados ({fotosEsgotadasFiltradas.length})
            </button>
          </div>

          <div style={styles.categoriasGaveta}>
            {[...CATEGORIAS_PRODUTO, 'Sem categoria'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => selecionarCategoriaAdmin(cat)}
                style={categoriaFiltroAdmin === cat ? styles.categoriaBotaoAtivo : styles.categoriaBotao}
              >
                {cat} ({contagemPorCategoria[cat] || 0})
              </button>
            ))}
          </div>

          {termoBuscaNormalizado && (
            <p style={styles.vazio}>
              Buscando por "{termoBusca.trim()}" — {fotosExibidas.length} encontrados nesta aba.
              Use "Selecionar todos os visíveis" pra marcar todos de uma vez.
            </p>
          )}

          {categoriaFiltroAdmin && (
            <p style={styles.vazio}>
              Filtrando pela categoria "{categoriaFiltroAdmin}" — {fotosExibidas.length} encontrados nesta aba.
              Clique de novo no botão da categoria pra limpar o filtro.
            </p>
          )}

          {abaAtiva === 'esgotados' && (
            <p style={styles.vazio}>
              Produtos com estoque zerado na Mersan (já saem da vitrine automaticamente).
              Use pra revisar e excluir os que não vão voltar a ter estoque.
            </p>
          )}

          <div style={styles.barraAcoes}>
            <button type="button" onClick={selecionarTodosVisiveis} style={styles.botaoLinkPequeno}>
              Selecionar todos os visíveis
            </button>
            {selecionados.size > 0 && (
              <button type="button" onClick={limparSelecao} style={styles.botaoLinkPequeno}>
                Limpar seleção ({selecionados.size})
              </button>
            )}
          </div>

          {selecionados.size > 0 && (
            <div style={styles.barraAcoesEmMassa}>
              <label style={styles.label}>
                Categoria dos {selecionados.size} selecionados
                <div style={styles.linhaCodigo}>
                  <select
                    value={categoriaEscolhidaEmMassa}
                    onChange={(e) => setCategoriaEscolhidaEmMassa(e.target.value)}
                    style={{ ...styles.input, flex: 1 }}
                  >
                    <option value="">Escolha a categoria…</option>
                    {CATEGORIAS_PRODUTO.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAplicarCategoriaEmMassa}
                    style={styles.botao}
                    disabled={aplicandoCategoria || !categoriaEscolhidaEmMassa}
                  >
                    {aplicandoCategoria ? 'Aplicando…' : 'Aplicar'}
                  </button>
                </div>
              </label>
              <p style={styles.vazio}>
                Categoria aplicada aqui fica protegida: planilhas novas e "Recalcular categorias" não vão sobrescrever esses produtos.
              </p>
              {statusCategoriaEmMassa && (
                <p style={statusCategoriaEmMassa.tipo === 'erro' ? styles.erro : styles.sucesso}>{statusCategoriaEmMassa.texto}</p>
              )}

              <button
                type="button"
                onClick={handleExcluirEmMassa}
                style={styles.botaoExcluir}
                disabled={aplicandoEmMassa}
              >
                Excluir {selecionados.size} selecionados
              </button>
              {selecionados.size > 50 && (
                <p style={styles.vazio}>
                  Atenção: ações em massa muito grandes gastam do limite diário de gravações do banco (1.000/dia).
                </p>
              )}
            </div>
          )}

          {statusEmMassa && (
            <p style={statusEmMassa.tipo === 'erro' ? styles.erro : styles.sucesso}>{statusEmMassa.texto}</p>
          )}

          <h2 style={styles.subtitulo}>
            {carregandoLista ? 'Carregando…' : `Mostrando ${fotosParaMostrar.length} de ${fotosExibidas.length}`}
          </h2>
          {fotosExibidas.length === 0 && !carregandoLista && (
            <p style={styles.vazio}>
              {abaAtiva === 'esgotados' ? 'Nenhum produto esgotado no momento.' : 'Nenhuma foto cadastrada ainda.'}
            </p>
          )}
          <ul style={styles.lista}>
            {fotosParaMostrar.map((f) => (
              <Fragment key={f.codigo}>
                <li style={styles.itemLista}>
                  <input
                    type="checkbox"
                    checked={selecionados.has(f.codigo)}
                    onChange={() => alternarSelecao(f.codigo)}
                    style={styles.checkboxItem}
                  />
                  <img
                    src={`/produto-foto/${encodeURIComponent(f.codigo)}`}
                    alt={f.codigo}
                    style={styles.miniatura}
                    onError={(e) => {
                      e.currentTarget.src = IMAGEM_PADRAO
                    }}
                  />
                  <div style={styles.infoCompacta}>
                    <span style={styles.codigoCompacto}>{f.codigo}</span>
                    <span style={styles.metaCompacta}>
                      {f.categoria || 'Sem categoria'}
                      {f.categoriaManual ? ' 🔒' : ''}
                      {f.tamanho != null && ` • ${Math.round(f.tamanho / 1024)}KB`}
                      {f.tamanho > 400 * 1024 ? ' ⚠️' : ''}
                    </span>
                  </div>
                  <div style={styles.botoesCompactos}>
                    <button onClick={() => handleEditar(f)} style={styles.botaoEditarCompacto}>
                      Editar
                    </button>
                    <button onClick={() => handleIniciarRenomear(f)} style={styles.botaoReferenciaCompacto}>
                      Ref.
                    </button>
                    <button onClick={() => handleExcluir(f.codigo)} style={styles.botaoExcluirCompacto}>
                      Excluir
                    </button>
                  </div>
                </li>

                {renomeando === f.codigo && (
                  <li key={`renomear-${f.codigo}`} style={styles.renomearBox}>
                    <label style={styles.label}>
                      Nova referência / código de barras
                      <div style={styles.linhaCodigo}>
                        <input
                          type="text"
                          value={novaReferencia}
                          onChange={(e) => setNovaReferencia(e.target.value)}
                          style={{ ...styles.input, flex: 1 }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => abrirLeitor('referencia')}
                          style={styles.botaoBipar}
                        >
                          📷 Bipar
                        </button>
                      </div>
                    </label>

                    {erroReferencia && <p style={styles.erro}>{erroReferencia}</p>}

                    <div style={styles.linhaCodigo}>
                      <button
                        onClick={handleSalvarReferencia}
                        style={styles.botao}
                        disabled={salvandoReferencia || !novaReferencia}
                      >
                        {salvandoReferencia ? 'Salvando…' : 'Salvar referência'}
                      </button>
                      <button onClick={handleCancelarRenomear} style={styles.botaoSecundario}>
                        Cancelar
                      </button>
                    </div>
                  </li>
                )}
              </Fragment>
            ))}
          </ul>

          {fotosExibidas.length > limiteExibicao && (
            <button
              type="button"
              onClick={() => setLimiteExibicao((n) => n + 50)}
              style={styles.botaoSecundario}
            >
              Carregar mais 50 (faltam {fotosExibidas.length - limiteExibicao})
            </button>
          )}
          </>
          )}
        </div>

        <div style={styles.listaBox}>
          <h2 style={styles.subtitulo}>Planilha de Gêneros</h2>
          <p style={styles.vazio}>
            Sobe a planilha (CSV) com as colunas Código, Descrição, Faixa Etária, Gênero e Linha
            (Descrição é opcional, mas se vier, produtos com "chuteira" no nome viram categoria
            Chuteira automaticamente, independente da Linha).
            Ao salvar, a categoria já é reaplicada automaticamente em todos os produtos
            cadastrados — não precisa clicar em "Recalcular categorias" depois. O botão
            abaixo continua disponível como reforço manual, se precisar.
          </p>

          <label style={styles.label}>
            Arquivo da planilha (.csv)
            <input type="file" onChange={handleArquivoPlanilha} style={styles.inputArquivo} />
          </label>

          {totalCodigosPlanilha != null && (
            <p style={styles.vazio}>{totalCodigosPlanilha} códigos reconhecidos no arquivo.</p>
          )}

          {statusPlanilha && (
            <p style={statusPlanilha.tipo === 'erro' ? styles.erro : styles.sucesso}>{statusPlanilha.texto}</p>
          )}

          <button
            type="button"
            onClick={handleEnviarPlanilha}
            style={styles.botaoSecundario}
            disabled={enviandoPlanilha || !arquivoPlanilha}
          >
            {enviandoPlanilha ? 'Enviando…' : 'Enviar planilha'}
          </button>

          {statusRecalculo && (
            <p style={statusRecalculo.tipo === 'erro' ? styles.erro : styles.sucesso}>{statusRecalculo.texto}</p>
          )}

          <button
            type="button"
            onClick={handleRecalcularCategorias}
            style={{ ...styles.botaoSecundario, marginTop: '8px' }}
            disabled={recalculando}
          >
            {recalculando ? 'Recalculando…' : 'Recalcular categorias dos produtos já cadastrados'}
          </button>
        </div><div style={styles.listaBox}>
          <h2 style={styles.subtitulo}>Vendedores ({vendedores.length})</h2>

          <form onSubmit={handleSalvarVendedor} style={styles.formVendedor}>
            <input
              type="text"
              value={nomeVendedor}
              onChange={(e) => setNomeVendedor(e.target.value)}
              placeholder="Nome (ex: Diego)"
              style={styles.input}
            />
            <input
              type="tel"
              value={whatsappVendedor}
              onChange={(e) => setWhatsappVendedor(e.target.value)}
              placeholder="WhatsApp com DDD e país (ex: 5511999999999)"
              style={styles.input}
            />
            <button
              type="submit"
              style={styles.botaoSecundario}
              disabled={salvandoVendedor || !nomeVendedor || !whatsappVendedor}
            >
              {salvandoVendedor ? 'Salvando…' : 'Adicionar vendedor'}
            </button>
          </form>

          {vendedores.length === 0 && (
            <p style={styles.vazio}>Nenhum vendedor cadastrado ainda.</p>
          )}
          <ul style={styles.lista}>
            {vendedores.map((v) => (
              <li key={v.id} style={styles.itemLista}>
                <span style={styles.codigoLista}>
                  {v.nome} <span style={styles.tamanhoTexto}>• {v.whatsapp}</span>
                </span>
                <button onClick={() => handleExcluirVendedor(v.id)} style={styles.botaoExcluir}>
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {scanAtivo && (
        <div style={styles.scannerOverlay}>
          <video ref={videoRef} style={styles.scannerVideo} playsInline muted />
          <p style={styles.scannerDica}>Aponte a câmera para o código de barras</p>
          <button onClick={fecharLeitor} style={styles.scannerCancelar}>
            Cancelar
          </button>
        </div>
      )}
    </main>
  )
}
const styles = {
  main: {
    minHeight: '100dvh',
    display: 'flex',
    justifyContent: 'center',
    padding: '24px'
  },
  loginBox: {
    width: '100%',
    maxWidth: '360px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '20vh'
  },
  painel: {
    width: '100%',
    maxWidth: '520px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  cabecalho: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  titulo: {
    fontSize: '20px',
    fontWeight: 700,
    margin: 0
  },
  subtitulo: {
    fontSize: '15px',
    fontWeight: 700,
    margin: '0 0 12px'
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    color: '#6b6b6b',
    fontWeight: 600
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#111111',
    fontWeight: 600
  },
  input: {
    padding: '14px 16px',
    fontSize: '16px',
    borderRadius: '10px',
    border: '1px solid #e6e6e6',
    outline: 'none'
  },
  inputArquivo: {
    fontSize: '14px'
  },
  formUpload: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    border: '1px solid #e6e6e6',
    borderRadius: '14px',
    padding: '18px'
  },
  formVendedor: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '16px'
  },
  preview: {
    width: '120px',
    height: '120px',
    objectFit: 'contain',
    borderRadius: '10px',
    border: '1px solid #e6e6e6',
    background: '#fafafa'
  },
  botao: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#0057ff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  botaoSair: {
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#111111',
    background: '#f2f2f2',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  botaoSecundario: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#111111',
    background: '#f2f2f2',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  erro: {
    color: '#d92d20',
    fontSize: '13px',
    margin: 0
  },
  sucesso: {
    color: '#0a7d32',
    fontSize: '13px',
    margin: 0
  },
  listaBox: {
    border: '1px solid #e6e6e6',
    borderRadius: '14px',
    padding: '18px'
  },
  vazio: {
    color: '#6b6b6b',
    fontSize: '13px'
  },
  lista: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  itemLista: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '44px'
  },
  miniatura: {
    width: '34px',
    height: '34px',
    flexShrink: 0,
    objectFit: 'contain',
    borderRadius: '6px',
    border: '1px solid #e6e6e6',
    background: '#fafafa'
  },
  infoCompacta: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    gap: '1px'
  },
  codigoCompacto: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#111111',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  metaCompacta: {
    fontSize: '10px',
    color: '#8a8a8a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  botoesCompactos: {
    display: 'flex',
    flexShrink: 0,
    gap: '4px'
  },
  botaoEditarCompacto: {
    padding: '5px 8px',
    fontSize: '10px',
    fontWeight: 700,
    color: '#0057ff',
    background: '#f2f6ff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  botaoReferenciaCompacto: {
    padding: '5px 8px',
    fontSize: '10px',
    fontWeight: 700,
    color: '#7a4de8',
    background: '#f5f0ff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  botaoExcluirCompacto: {
    padding: '5px 8px',
    fontSize: '10px',
    fontWeight: 700,
    color: '#d92d20',
    background: '#fff0ef',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  codigoLista: {
    flex: 1,
    fontSize: '13px',
    color: '#111111',
    wordBreak: 'break-all'
  },
  tamanhoTexto: {
    color: '#6b6b6b',
    fontWeight: 400
  },
  botaoEditar: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#0057ff',
    background: '#f2f6ff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  botaoReferencia: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#7a4de8',
    background: '#f5f0ff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  renomearBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px',
    background: '#fafafa',
    border: '1px solid #e6e6e6',
    borderRadius: '10px'
  },
  editandoAviso: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#0057ff',
    background: '#f2f6ff',
    padding: '10px 12px',
    borderRadius: '8px',
    margin: 0
  },
  botaoExcluir: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#d92d20',
    background: '#fff0ef',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  linhaCodigo: {
    display: 'flex',
    gap: '8px'
  },
  botaoBipar: {
    padding: '0 16px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#0057ff',
    background: '#f2f6ff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  scannerOverlay: {
    position: 'fixed',
    inset: 0,
    background: '#000000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    zIndex: 1000
  },
  scannerVideo: {
    width: '100%',
    maxWidth: '480px',
    borderRadius: '12px'
  },
  scannerDica: {
    color: '#ffffff',
    fontSize: '14px'
  },
  scannerCancelar: {
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#111111',
    background: '#ffffff',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  abas: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  abaBotao: {
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#6b6b6b',
    background: '#f2f2f2',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  abaBotaoAtiva: {
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#14141a',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  categoriasGaveta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '12px'
  },
  categoriaBotao: {
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#0057ff',
    background: '#f2f6ff',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  categoriaBotaoAtivo: {
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#0057ff',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  barraAcoes: {
    display: 'flex',
    gap: '14px',
    marginBottom: '8px'
  },
  botaoLinkPequeno: {
    padding: 0,
    fontSize: '12px',
    fontWeight: 700,
    color: '#0057ff',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline'
  },
  barraAcoesEmMassa: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px',
    background: '#fafafa',
    border: '1px solid #e6e6e6',
    borderRadius: '10px',
    marginBottom: '12px'
  },
  checkboxItem: {
    width: '18px',
    height: '18px',
    flexShrink: 0,
    cursor: 'pointer'
  },
  botaoAbrirLista: {
    width: '100%',
    textAlign: 'left',
    padding: '14px 16px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#111111',
    background: '#f7f7f8',
    border: '1px solid #ececec',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  buscaBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 14px',
    marginBottom: '12px',
    background: '#f7f7f8',
    border: '1px solid #ececec',
    borderRadius: '10px'
  },
  buscaIcone: {
    fontSize: '15px',
    flexShrink: 0
  },
  buscaInput: {
    flex: 1,
    padding: '12px 0',
    fontSize: '15px',
    border: 'none',
    background: 'none',
    outline: 'none'
  },
  buscaLimpar: {
    background: 'none',
    border: 'none',
    color: '#6b6b6b',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px'
  }
    }
