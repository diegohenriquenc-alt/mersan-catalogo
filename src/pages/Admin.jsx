import { useState, useEffect, useCallback, useRef, Fragment } from 'react'

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
  const [categoria, setCategoria] = useState('')
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
  const [categoriaEmMassa, setCategoriaEmMassa] = useState('')
  const [aplicandoEmMassa, setAplicandoEmMassa] = useState(false)
  const [statusEmMassa, setStatusEmMassa] = useState(null)
  const [limiteExibicao, setLimiteExibicao] = useState(50)
  const [abaAtiva, setAbaAtiva] = useState('cadastradas')
  const [estoquePorCodigo, setEstoquePorCodigo] = useState({})
  const [listaAberta, setListaAberta] = useState(false)

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

  const carregarEstoques = useCallback(async () => {
    try {
      const resp = await fetch('/api/catalogo')
      const data = await resp.json()
      const mapa = {}
      for (const p of data.produtos || []) mapa[p.codigo] = p.estoqueTotal
      setEstoquePorCodigo(mapa)
    } catch {
    }
  }, [])

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

  // Calcula a(s) categoria(s) de um item da planilha, seguindo a mesma
  // regra combinada: Infantil e Esportivo (linha "ESPORTE") têm prioridade
  // sobre o gênero puro; Unisex entra nas duas categorias de gênero.
  function calcularCategoriasPlanilha(faixaEtaria, genero, linha) {
    const infantil = (faixaEtaria || '').trim().toUpperCase() === 'INFANTIL'
    const esportivo = (linha || '').trim().toUpperCase() === 'ESPORTE'
    const generoNormalizado = (genero || '').trim().toUpperCase()
    const generos = generoNormalizado === 'UNISEX' ? ['MASCULINO', 'FEMININO'] : [generoNormalizado]

    return generos
      .filter((g) => g === 'MASCULINO' || g === 'FEMININO')
      .map((g) => {
        const rotulo = g === 'MASCULINO' ? 'Masculino' : 'Feminino'
        if (infantil) return `Infantil ${rotulo}`
        if (esportivo) return `Esportivo ${rotulo}`
        return rotulo
      })
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
    const idxFaixa = cabecalho.findIndex((c) => c.includes('faixa'))
    const idxGenero = cabecalho.findIndex((c) => c.includes('gênero') || c.includes('genero'))
    const idxLinha = cabecalho.findIndex((c) => c === 'linha')

    const registros = []
    for (let i = 1; i < linhas.length; i++) {
      const campos = parseLinha(linhas[i])
      const codigo = idxCodigo >= 0 ? campos[idxCodigo] : null
      if (!codigo) continue
      registros.push({
        codigo,
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
        const categorias = calcularCategoriasPlanilha(registro.faixaEtaria, registro.genero, registro.linha)
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
        setStatusPlanilha({
          tipo: 'sucesso',
          texto: `Planilha salva: ${data.totalCodigos} códigos. Agora bipe produtos novos ou use "Recalcular categorias" para os já cadastrados.`
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
          texto: `${data.atualizados} de ${data.totalFotos} produtos atualizados (${data.encontradosNaPlanilha} encontrados na planilha).`
        })
        carregarLista()
      }
    } catch {
      setStatusRecalculo({ tipo: 'erro', texto: 'Não foi possível conectar.' })
    } finally {
      setRecalculando(false)
    }
      }async function handleEnviar(e) {
    e.preventDefault()
    if (!codigo) return
    if (!arquivo && !editando) return

    setEnviando(true)
    setStatus(null)

    try {
      let resp
      if (arquivo) {
        const form = new FormData()
        form.append('codigo', codigo)
        form.append('categoria', categoria)
        try {
          const arquivoComprimido = await comprimirImagem(arquivo)
          form.append('arquivo', arquivoComprimido)
        } catch {
          form.append('arquivo', arquivo)
        }
        resp = await fetch('/api/admin/foto', {
          method: 'POST',
          headers: { 'X-Admin-Password': senha },
          body: form
        })
      } else {
        resp = await fetch('/api/admin/foto', {
          method: 'PATCH',
          headers: {
            'X-Admin-Password': senha,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ codigo, categoria })
        })
  }
      const data = await resp.json()
      if (!resp.ok) {
        setStatus({ tipo: 'erro', texto: data.error || 'Falha ao enviar.' })
      } else {
        setStatus({ tipo: 'sucesso', texto: `Foto salva para "${data.codigo}".` })
        setCodigo('')
        setArquivo(null)
        setCategoria('')
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
    setCategoria(foto.categoria || '')
    setArquivo(null)
    setPreview(`/produto-foto/${encodeURIComponent(foto.codigo)}`)
    setStatus(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelarEdicao() {
    setEditando(null)
    setCodigo('')
    setCategoria('')
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

  async function handleAplicarCategoriaEmMassa() {
    if (selecionados.size === 0) return
    setAplicandoEmMassa(true)
    setStatusEmMassa(null)
    try {
      const codigos = Array.from(selecionados)
      await Promise.all(
        codigos.map((codigoFoto) =>
          fetch('/api/admin/foto', {
            method: 'PATCH',
            headers: { 'X-Admin-Password': senha, 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo: codigoFoto, categoria: categoriaEmMassa })
          })
        )
      )
      setStatusEmMassa({ tipo: 'sucesso', texto: `Categoria aplicada a ${codigos.length} produtos.` })
      setSelecionados(new Set())
      carregarLista()
    } catch {
      setStatusEmMassa({ tipo: 'erro', texto: 'Não foi possível aplicar em todos. Tente novamente.' })
    } finally {
      setAplicandoEmMassa(false)
    }
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

  function handleSair() {
    sessionStorage.removeItem('mersan_admin_senha')
    window.location.reload()
  }

  const fotosEsgotadas = fotos.filter((f) => estoquePorCodigo[f.codigo] === 0)
  const fotosNormais = fotos.filter((f) => estoquePorCodigo[f.codigo] !== 0)
  const fotosExibidas = abaAtiva === 'esgotados' ? fotosEsgotadas : fotosNormais
  const fotosParaMostrar = fotosExibidas.slice(0, limiteExibicao)

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
              ✏️ Editando "{editando}" — escolha uma foto nova só se quiser trocá-la.
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
            Foto {editando && '(opcional — deixe em branco para manter a atual)'}
            <input type="file" accept="image/*" onChange={handleArquivo} style={styles.inputArquivo} />
          </label>

          <label style={styles.label}>
            Categoria
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              style={styles.input}
            >
              <option value="">Sem categoria</option>
              <option value="Feminino">Feminino</option>
<option value="Masculino">Masculino</option>
<option value="Infantil Feminino">Infantil Feminino</option>
<option value="Infantil Masculino">Infantil Masculino</option>
<option value="Esportivo Feminino">Esportivo Feminino</option>
<option value="Esportivo Masculino">Esportivo Masculino</option>
<option value="Arezzo">Arezzo</option>
            </select>
          </label>

          {preview && <img src={preview} alt="Pré-visualização" style={styles.preview} />}

          {status && (
            <p style={status.tipo === 'erro' ? styles.erro : styles.sucesso}>{status.texto}</p>
          )}

          <button
            type="submit"
            style={styles.botao}
            disabled={enviando || !codigo || (!arquivo && !editando)}
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
          <button
            type="button"
            onClick={() => setListaAberta((v) => !v)}
            style={styles.botaoAbrirLista}
          >
            {listaAberta ? '▾' : '▸'} {fotosNormais.length + fotosEsgotadas.length} produtos cadastrados — clique para {listaAberta ? 'fechar' : 'abrir'} a lista
          </button>

          {listaAberta && (
          <>
          <div style={styles.abas}>
            <button
              type="button"
              onClick={() => { setAbaAtiva('cadastradas'); limparSelecao() }}
              style={abaAtiva === 'cadastradas' ? styles.abaBotaoAtiva : styles.abaBotao}
            >
              Fotos cadastradas ({fotosNormais.length})
            </button>
            <button
              type="button"
              onClick={() => { setAbaAtiva('esgotados'); limparSelecao() }}
              style={abaAtiva === 'esgotados' ? styles.abaBotaoAtiva : styles.abaBotao}
            >
              Esgotados ({fotosEsgotadas.length})
            </button>
          </div>

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
              <select
                value={categoriaEmMassa}
                onChange={(e) => setCategoriaEmMassa(e.target.value)}
                style={styles.input}
              >
                <option value="">Sem categoria</option>
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
                <option value="Infantil Feminino">Infantil Feminino</option>
                <option value="Infantil Masculino">Infantil Masculino</option>
                <option value="Esportivo Feminino">Esportivo Feminino</option>
                <option value="Esportivo Masculino">Esportivo Masculino</option>
                <option value="Arezzo">Arezzo</option>
              </select>
              <button
                type="button"
                onClick={handleAplicarCategoriaEmMassa}
                style={styles.botaoSecundario}
                disabled={aplicandoEmMassa}
              >
                {aplicandoEmMassa ? 'Aplicando…' : `Aplicar categoria a ${selecionados.size} produtos`}
              </button>
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
            Sobe a planilha (CSV) com as colunas Código, Faixa Etária, Gênero e Linha.
            Produtos bipados depois disso já vêm com a categoria automática.
            Pra aplicar nos produtos que já estão cadastrados, use "Recalcular categorias".
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
  }
    }
