import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const IMAGEM_PADRAO = '/icons/icon-512.svg'
const PARCELA_MINIMA = 29.99
const MAX_PARCELAS = 10

const CATEGORIAS = ['Feminino', 'Masculino', 'Infantil', 'Esportivo', 'Arezzo', 'Promoção']

// Palavras que não são marca — quando a segunda palavra do nome é uma
// dessas (um tipo/descrição, não a marca em si), a etiqueta busca a
// palavra seguinte. É um "melhor esforço": a API da Mersan não tem um
// campo próprio de marca, só o nome completo do produto.
const PALAVRAS_NAO_MARCA = new Set([
  'CASUAL', 'CORRIDA', 'ESPORTIVO', 'CONFORTO', 'SOCIAL', 'INFANTIL'
])

function extrairMarca(nome) {
  if (!nome) return null
  const palavras = nome.trim().split(/\s+/)
  if (palavras.length < 2) return null
  const candidata = palavras[1]?.toUpperCase()
  if (candidata && !PALAVRAS_NAO_MARCA.has(candidata) && !/^\d/.test(candidata)) {
    return candidata
  }
  if (palavras.length >= 3) return palavras[2]?.toUpperCase() || null
  return null
}

// O nome que vem da Mersan termina com o tamanho colado (ex: "...PRETO 40").
// Como o tamanho já aparece destacado em vermelho separadamente, tira essa
// repetição do final do nome.
function limparNome(nome, tamanho) {
  if (!nome) return ''
  if (!tamanho) return nome
  const semTamanho = nome.replace(new RegExp(`\\s+${tamanho}\\.?$`), '')
  return semTamanho || nome
}

function calcularParcelamento(preco) {
  if (preco == null) return null
  const max = Math.min(MAX_PARCELAS, Math.max(1, Math.floor(preco / PARCELA_MINIMA)))
  if (max <= 1) return null
  const valor = (preco / max).toFixed(2).replace('.', ',')
  return `em até ${max}x de R$ ${valor}`
}

function formatarPreco(preco) {
  if (preco == null) return ''
  return preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Tela inicial do catálogo: cabeçalho premium fixo, menu lateral com
// categorias e a grade de produtos aparecendo direto — o cliente já vê os
// produtos assim que abre o link, sem tela de busca no meio do caminho.
export default function Catalogo() {
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setErro(null)
      try {
        const resp = await fetch(`/api/catalogo?t=${Date.now()}`)
        const data = await resp.json()

        if (!cancelado) {
          setProdutos(data.produtos || [])
        }
      } catch (erroCapturado) {
        if (!cancelado) {
          setErro(`Não foi possível carregar o catálogo agora. (${erroCapturado?.message || erroCapturado})`)
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [])

  const produtosFiltrados = useMemo(() => {
    let lista = produtos

    if (categoriaAtiva === 'Promoção') {
      lista = lista.filter((p) => p.promocao)
    } else if (categoriaAtiva) {
      lista = lista.filter((p) => p.categoria === categoriaAtiva)
    }

    if (termoBusca.trim()) {
      const termo = termoBusca.trim().toLowerCase()
      lista = lista.filter((p) => (p.nome || '').toLowerCase().includes(termo))
    }

    return lista
  }, [produtos, categoriaAtiva, termoBusca])

  function selecionarCategoria(categoria) {
    setCategoriaAtiva((atual) => (atual === categoria ? null : categoria))
    setMenuAberto(false)
  }

  return (
    <div style={styles.pagina}>
      <header style={styles.cabecalho}>
        <div style={styles.cabecalhoLinhaTopo}>
          <button
            onClick={() => setMenuAberto(true)}
            style={styles.iconeBotao}
            aria-label="Abrir menu"
          >
            <IconeMenu />
          </button>

          <button
            onClick={() => setBuscaAberta((v) => !v)}
            style={styles.iconeBotao}
            aria-label="Buscar produto"
          >
            <IconeBusca />
          </button>
        </div>

        <Link to="/" style={styles.marca}>
          <span style={styles.marcaMersan}>MERSAN</span>
          <span style={styles.marcaCalcados}>CALÇADOS</span>
        </Link>
      </header>

      {buscaAberta && (
        <div style={styles.barraBusca}>
          <input
            type="text"
            autoFocus
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="Buscar produto pelo nome..."
            style={styles.inputBusca}
          />
        </div>
      )}

      {categoriaAtiva && (
        <div style={styles.filtroAtivo}>
          <span>Filtrando: {categoriaAtiva}</span>
          <button onClick={() => setCategoriaAtiva(null)} style={styles.limparFiltro}>
            Limpar ✕
          </button>
        </div>
      )}

      <main style={styles.conteudo}>
        {loading && <p style={styles.status}>Carregando produtos…</p>}
        {erro && <p style={styles.erro}>{erro}</p>}
        {!loading && !erro && produtosFiltrados.length === 0 && (
          <p style={styles.status}>Nenhum produto encontrado.</p>
        )}

        <div style={styles.grade}>
          {produtosFiltrados.map((p) => {
            const marca = extrairMarca(p.nome)
            const nomeExibido = limparNome(p.nome, p.tamanho)
            const parcelamento = calcularParcelamento(p.preco)

            return (
              <Link key={p.codigo} to={`/produto/${encodeURIComponent(p.codigo)}`} style={styles.card}>
                <div style={styles.fotoWrapper}>
                  {p.promocao && <span style={styles.selo}>PROMOÇÃO</span>}
                  <img
                    src={`/produto-foto/${encodeURIComponent(p.codigo)}`}
                    alt={p.nome}
                    loading="lazy"
                    style={styles.foto}
                    onError={(e) => {
                      e.currentTarget.src = IMAGEM_PADRAO
                    }}
                  />
                </div>

                <div style={styles.cardInfo}>
                  {marca && <span style={styles.marcaEtiqueta}>{marca}</span>}
                  <span style={styles.nome}>{nomeExibido}</span>

                  {p.tamanho && (
                    <span style={styles.tamanhoLinha}>
                      Tamanho: <span style={styles.tamanhoValor}>{p.tamanho}</span>
                    </span>
                  )}

                  <div style={styles.precoBloco}>
                    {p.promocao && p.precoOriginal > p.preco && (
                      <span style={styles.precoOriginal}>{formatarPreco(p.precoOriginal)}</span>
                    )}
                    {p.preco != null && <span style={styles.preco}>{formatarPreco(p.preco)}</span>}
                    <span style={styles.parcelamento}>{parcelamento || '\u00A0'}</span>
                  </div>

                  <span style={styles.botaoWhats}>
                    <IconeWhatsApp />
                    COMPRAR PELO WHATSAPP
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </main>

      {menuAberto && (
        <>
          <div style={styles.overlay} onClick={() => setMenuAberto(false)} />
          <nav style={styles.menuLateral}>
            <div style={styles.menuCabecalho}>
              <span style={styles.menuTitulo}>Categorias</span>
              <button onClick={() => setMenuAberto(false)} style={styles.fecharMenu}>
                ✕
              </button>
            </div>
            <button
              onClick={() => selecionarCategoria(null)}
              style={!categoriaAtiva ? styles.menuItemAtivo : styles.menuItem}
            >
              Todos os produtos
            </button>
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                onClick={() => selecionarCategoria(cat)}
                style={categoriaAtiva === cat ? styles.menuItemAtivo : styles.menuItem}
              >
                {cat}
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  )
}

function IconeMenu() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="#14141a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconeBusca() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="#14141a" strokeWidth="2" />
      <path d="M20 20L16.5 16.5" stroke="#14141a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconeWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.33 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.33-1.93 1.4-.5.07-1.03.29-3.46-.72-2.92-1.21-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.82 2.01.89 2.16.07.14.12.31.02.5-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.44.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.38-.24.63-.14.26.1 1.65.78 1.93.92.29.14.48.22.55.34.07.13.07.7-.17 1.38Z" />
    </svg>
  )
}

const styles = {
  pagina: {
    minHeight: '100dvh',
    background: '#ffffff',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
  },
  cabecalho: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: '#ffffff',
    boxShadow: '0 1px 0 rgba(20,20,26,0.06), 0 2px 8px rgba(20,20,26,0.03)',
    padding: '10px 16px 12px'
  },
  cabecalhoLinhaTopo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  iconeBotao: {
    background: 'none',
    border: 'none',
    padding: '6px',
    cursor: 'pointer',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center'
  },
  marca: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textDecoration: 'none',
    marginTop: '2px'
  },
  marcaMersan: {
    fontSize: 'clamp(34px, 11vw, 52px)',
    fontWeight: 900,
    color: '#14141a',
    letterSpacing: '-0.03em',
    lineHeight: 0.95
  },
  marcaCalcados: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#e4002b',
    letterSpacing: '0.32em',
    marginTop: '2px'
  },
  barraBusca: {
    padding: '10px 16px',
    borderBottom: '1px solid #ececec'
  },
  inputBusca: {
    width: '100%',
    padding: '11px 16px',
    fontSize: '15px',
    borderRadius: '999px',
    border: '1px solid #e6e6e6',
    outline: 'none',
    background: '#f7f7f8'
  },
  filtroAtivo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    background: '#fff0f1',
    fontSize: '13px',
    fontWeight: 600,
    color: '#e4002b'
  },
  limparFiltro: {
    background: 'none',
    border: 'none',
    color: '#e4002b',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '13px'
  },
  conteudo: {
    padding: '16px'
  },
  status: {
    fontSize: '14px',
    color: '#8a8a92',
    textAlign: 'center',
    padding: '32px 0'
  },
  erro: {
    fontSize: '14px',
    color: '#e4002b',
    textAlign: 'center',
    padding: '32px 0'
  },
  grade: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '14px'
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    textDecoration: 'none',
    color: '#14141a',
    borderRadius: '18px',
    overflow: 'hidden',
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(20,20,26,0.06), 0 6px 16px rgba(20,20,26,0.05)'
  },
  fotoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1.05',
    background: '#ffffff',
    padding: '10px'
  },
  foto: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  selo: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: '#e4002b',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    padding: '5px 10px',
    borderRadius: '999px',
    zIndex: 1
  },
  cardInfo: {
    padding: '2px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    flex: 1
  },
  marcaEtiqueta: {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: '#8a8a92'
  },
  nome: {
    fontSize: '13.5px',
    fontWeight: 700,
    lineHeight: 1.3,
    minHeight: '2.6em',
    color: '#14141a',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  tamanhoLinha: {
    fontSize: '11px',
    color: '#8a8a92',
    fontWeight: 600
  },
  tamanhoValor: {
    color: '#e4002b',
    fontWeight: 800
  },
  precoBloco: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: '4px',
    marginBottom: '8px'
  },
  precoOriginal: {
    fontSize: '12px',
    color: '#b3b3ba',
    textDecoration: 'line-through'
  },
  preco: {
    fontSize: '19px',
    fontWeight: 900,
    color: '#14141a',
    letterSpacing: '-0.01em'
  },
  parcelamento: {
    fontSize: '11px',
    color: '#8a8a92',
    minHeight: '1.3em'
  },
  botaoWhats: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    background: '#25D366',
    color: '#ffffff',
    fontSize: '10.5px',
    fontWeight: 800,
    letterSpacing: '0.02em',
    padding: '10px 8px',
    borderRadius: '999px'
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,20,26,0.45)',
    zIndex: 30
  },
  menuLateral: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '78%',
    maxWidth: '320px',
    background: '#ffffff',
    zIndex: 31,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    boxShadow: '2px 0 24px rgba(0,0,0,0.18)'
  },
  menuCabecalho: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  menuTitulo: {
    fontSize: '19px',
    fontWeight: 900,
    color: '#14141a'
  },
  fecharMenu: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer'
  },
  menuItem: {
    textAlign: 'left',
    padding: '14px 12px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#14141a',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid #f2f2f2',
    cursor: 'pointer'
  },
  menuItemAtivo: {
    textAlign: 'left',
    padding: '14px 12px',
    fontSize: '15px',
    fontWeight: 800,
    color: '#e4002b',
    background: '#fff0f1',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer'
  }
}
