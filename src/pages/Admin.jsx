import { useState, useEffect, useCallback, useRef } from 'react'

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
  const [promocao, setPromocao] = useState(false)
  const [editando, setEditando] = useState(null)
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

  async function abrirLeitor() {
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
          iniciarLeitura()
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

  function iniciarLeitura() {
    const detector = new window.BarcodeDetector()

    async function verificar() {
      if (!videoRef.current) return
      try {
        const codigos = await detector.detect(videoRef.current)
        if (codigos.length > 0) {
          setCodigo(codigos[0].rawValue)
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
  async function handleEnviar(e) {
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
        form.append('promocao', promocao ? 'true' : 'false')
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
          body: JSON.stringify({ codigo, categoria, promocao })
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
        setPromocao(false)
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
    setPromocao(Boolean(foto.promocao))
    setArquivo(null)
    setPreview(`/produto-foto/${encodeURIComponent(foto.codigo)}`)
    setStatus(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelarEdicao() {
    setEditando(null)
    setCodigo('')
    setCategoria('')
    setPromocao(false)
    setArquivo(null)
    setPreview(null)
    setStatus(null)
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

  function handleSair() {
    sessionStorage.removeItem('mersan_admin_senha')
    window.location.reload()
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
              <option value="Infantil">Infantil</option>
              <option value="Esportivo">Esportivo</option>
              <option value="Arezzo">Arezzo</option>
            </select>
          </label>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={promocao}
              onChange={(e) => setPromocao(e.target.checked)}
            />
            Mostrar selo de promoção neste produto
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
          <h2 style={styles.subtitulo}>
            Fotos cadastradas {carregandoLista ? '(carregando…)' : `(${fotos.length})`}
          </h2>
          {fotos.length === 0 && !carregandoLista && (
            <p style={styles.vazio}>Nenhuma foto cadastrada ainda.</p>
          )}
          <ul style={styles.lista}>
            {fotos.map((f) => (
              <li key={f.codigo} style={styles.itemLista}>
                <img
                  src={`/produto-foto/${encodeURIComponent(f.codigo)}`}
                  alt={f.codigo}
                  style={styles.miniatura}
                  onError={(e) => {
                    e.currentTarget.src = IMAGEM_PADRAO
                  }}
                />
                <span style={styles.codigoLista}>
                  {f.codigo}
                  {f.categoria && <span style={styles.tamanhoTexto}> • {f.categoria}</span>}
                  {f.promocao && <span style={styles.tamanhoTexto}> • 🔴 promoção</span>}
                  {f.tamanho != null && (
                    <span style={styles.tamanhoTexto}>
                      {' '}
                      • {Math.round(f.tamanho / 1024)}KB
                      {f.tamanho > 400 * 1024 ? ' ⚠️ pesada' : ''}
                    </span>
                  )}
                </span>
                <button onClick={() => handleEditar(f)} style={styles.botaoEditar}>
                  Editar
                </button>
                <button onClick={() => handleExcluir(f.codigo)} style={styles.botaoExcluir}>
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={styles.listaBox}>
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
    gap: '10px'
  },
  miniatura: {
    width: '44px',
    height: '44px',
    objectFit: 'contain',
    borderRadius: '8px',
    border: '1px solid #e6e6e6',
    background: '#fafafa'
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
  }
}
