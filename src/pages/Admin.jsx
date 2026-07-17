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
