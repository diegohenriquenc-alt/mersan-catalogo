import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const IMAGEM_PADRAO = '/icons/icon-512.svg'
const PARCELA_MINIMA = 29.99
const MAX_PARCELAS = 10

const CATEGORIAS = ['Feminino', 'Masculino', 'Infantil', 'Esportivo', 'Arezzo', 'Promoção']

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
        <button
          onClick={() => setMenuAberto(true)}
          style={styles.iconeBotao}
          aria-label="Abrir menu"
        >
          ☰
        </button>

        <span style={styles.logo}>MERSAN CALÇADOS</span>

        <button
          onClick={() => setBuscaAberta((v) => !v)}
          style={styles.iconeBotao}
          aria-label="Buscar produto"
        >
          🔍
        </button>
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
          {produtosFiltrados.map((p) => (
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
                <span style={styles.nome}>{p.nome}</span>
                <div style={styles.precoLinha}>
                  {p.promocao && p.precoOriginal > p.preco && (
                    <span style={styles.precoOriginal}>{formatarPreco(p.precoOriginal)}</span>
                  )}
                  {p.preco != null && <span style={styles.preco}>{formatarPreco(p.preco)}</span>}
                </div>
                <span style={styles.parcelamento}>{calcularParcelamento(p.preco) || '\u00A0'}</span>
              </div>
            </Link>
          ))}
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

const styles = {
  pagina: {
    minHeight: '100dvh',
    background: '#ffffff'
  },
  cabecalho: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#ffffff',
    borderBottom: '1px solid #eeeeee'
  },
  iconeBotao: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    padding: '6px 10px',
    cursor: 'pointer',
    lineHeight: 1
  },
  logo: {
    fontSize: '15px',
    fontWeight: 800,
    letterSpacing: '0.03em'
  },
  barraBusca: {
    padding: '10px 14px',
    borderBottom: '1px solid #eeeeee'
  },
  inputBusca: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '15px',
    borderRadius: '999px',
    border: '1px solid #e6e6e6',
    outline: 'none'
  },
  filtroAtivo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 14px',
    background: '#f2f6ff',
    fontSize: '13px',
    fontWeight: 600,
    color: '#0057ff'
  },
  limparFiltro: {
    background: 'none',
    border: 'none',
    color: '#0057ff',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '13px'
  },
  conteudo: {
    padding: '14px'
  },
  status: {
    fontSize: '14px',
    color: '#6b6b6b',
    textAlign: 'center',
    padding: '24px 0'
  },
  erro: {
    fontSize: '14px',
    color: '#d92d20',
    textAlign: 'center',
    padding: '24px 0'
  },
  grade: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    textDecoration: 'none',
    color: '#111111',
    borderRadius: '14px',
    overflow: 'hidden',
    border: '1px solid #f0f0f0'
  },
  fotoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    background: '#fafafa'
  },
  foto: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  selo: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    background: '#d92d20',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.03em',
    padding: '4px 8px',
    borderRadius: '999px',
    zIndex: 1
  },
  cardInfo: {
    padding: '10px 8px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    flex: 1
  },
  nome: {
    fontSize: '13px',
    fontWeight: 600,
    lineHeight: 1.3,
    minHeight: '2.6em',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  precoLinha: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
    flexWrap: 'wrap',
    marginTop: '2px'
  },
  precoOriginal: {
    fontSize: '12px',
    color: '#9a9a9a',
    textDecoration: 'line-through'
  },
  preco: {
    fontSize: '16px',
    fontWeight: 800
  },
  parcelamento: {
    fontSize: '11px',
    color: '#6b6b6b',
    minHeight: '1.4em'
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
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
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    boxShadow: '2px 0 16px rgba(0,0,0,0.15)'
  },
  menuCabecalho: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px'
  },
  menuTitulo: {
    fontSize: '18px',
    fontWeight: 800
  },
  fecharMenu: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer'
  },
  menuItem: {
    textAlign: 'left',
    padding: '14px 10px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#111111',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid #f2f2f2',
    cursor: 'pointer'
  },
  menuItemAtivo: {
    textAlign: 'left',
    padding: '14px 10px',
    fontSize: '15px',
    fontWeight: 800,
    color: '#0057ff',
    background: '#f2f6ff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  }
}
