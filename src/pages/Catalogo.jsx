import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import ApiService from '../services/api.js'

const IMAGEM_PADRAO = '/icons/icon-512.svg'

export default function Catalogo() {
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let cancelado = false

    async function carregar() {
      setLoading(true)
      setErro(null)
      try {
        const resp = await fetch('/api/fotos-publicas')
        const data = await resp.json()
        const codigos = data.codigos || []

        const resultados = await Promise.all(
          codigos.map(async (codigo) => {
            try {
              const info = await ApiService.buscarDadosProduto(codigo)
              return { codigo, nome: info.nome, preco: info.preco }
            } catch {
              return null
            }
          })
        )

        if (!cancelado) {
          setProdutos(resultados.filter(Boolean))
        }
      } catch {
        if (!cancelado) setErro('Não foi possível carregar a vitrine agora.')
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [])

  return (
    <main style={styles.main}>
      <div style={styles.content}>
        <Logo />
        <h1 style={styles.titulo}>Vitrine</h1>

        {loading && <p style={styles.status}>Carregando produtos…</p>}
        {erro && <p style={styles.erro}>{erro}</p>}
        {!loading && !erro && produtos.length === 0 && (
          <p style={styles.status}>Nenhum produto com foto cadastrada ainda.</p>
        )}

        <div style={styles.grid}>
          {produtos.map((p) => (
            <Link
              key={p.codigo}
              to={`/produto/${encodeURIComponent(p.codigo)}`}
              style={styles.card}
            >
              <img
                src={`/produto-foto/${encodeURIComponent(p.codigo)}`}
                alt={p.nome}
                style={styles.foto}
                onError={(e) => {
                  e.currentTarget.src = IMAGEM_PADRAO
                }}
              />
              <span style={styles.nome}>{p.nome}</span>
              {p.preco != null && (
                <span style={styles.preco}>
                  {p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              )}
            </Link>
          ))}
        </div>

        <Link to="/" style={styles.voltar}>
          Voltar para a busca
        </Link>
      </div>
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
  content: {
    width: '100%',
    maxWidth: '960px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px'
  },
  titulo: {
    fontSize: '20px',
    fontWeight: 700,
    margin: 0
  },
  status: {
    fontSize: '14px',
    color: '#6b6b6b'
  },
  erro: {
    fontSize: '14px',
    color: '#d92d20'
  },
  grid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '14px'
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '10px',
    border: '1px solid #e6e6e6',
    borderRadius: '12px',
    textDecoration: 'none',
    color: '#111111'
  },
  foto: {
    width: '100%',
    height: '120px',
    objectFit: 'contain',
    borderRadius: '8px',
    background: '#fafafa'
  },
  nome: {
    fontSize: '12px',
    fontWeight: 600,
    textAlign: 'center'
  },
  preco: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#0057ff'
  },
  voltar: {
    fontSize: '14px',
    color: '#6b6b6b',
    textDecoration: 'none'
  }
}
