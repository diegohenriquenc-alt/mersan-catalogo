import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarFavoritos, removerFavorito } from '../utils/favoritos.js'

const IMAGEM_PADRAO = '/icons/icon-512.svg'

export default function Favoritos() {
  const [codigos, setCodigos] = useState(listarFavoritos())
  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function atualizar() {
      setCodigos(listarFavoritos())
    }
    window.addEventListener('favoritos-mudaram', atualizar)
    return () => window.removeEventListener('favoritos-mudaram', atualizar)
  }, [])

  useEffect(() => {
    if (codigos.length === 0) {
      setProdutos([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all(
      codigos.map((codigo) =>
        fetch(`/api/produto?termo=${encodeURIComponent(codigo)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((dados) => (dados ? { ...dados, codigo } : null))
          .catch(() => null)
      )
    ).then((lista) => {
      setProdutos(lista.filter(Boolean))
      setLoading(false)
    })
  }, [codigos])

  function handleRemover(codigo) {
    removerFavorito(codigo)
  }

  return (
    <div style={styles.pagina}>
      <header style={styles.cabecalho}>
        <Link to="/" style={styles.voltar}>← Catálogo</Link>
        <h1 style={styles.titulo}>Meus Favoritos</h1>
        <span style={styles.contador}>{produtos.length}</span>
      </header>

      <main style={styles.conteudo}>
        {loading && <p style={styles.status}>Carregando favoritos…</p>}
        {!loading && produtos.length === 0 && (
          <p style={styles.status}>Você ainda não favoritou nenhum produto.</p>
        )}

        <div style={styles.lista}>
          {produtos.map((p) => (
            <div key={p.codigo} style={styles.item}>
              <img
                src={`/produto-foto/${encodeURIComponent(p.codigoBarras || p.codigo)}`}
                alt={p.nome}
                style={styles.foto}
                onError={(e) => { e.currentTarget.src = IMAGEM_PADRAO }}
              />
              <div style={styles.info}>
                <span style={styles.nome}>{p.nome}</span>
                <span style={styles.detalhe}>Referência: {p.referencia}</span>
                {p.tamanho && <span style={styles.detalhe}>Tamanho: {p.tamanho}</span>}
                <span style={styles.preco}>R$ {Number(p.preco).toFixed(2).replace('.', ',')}</span>
              </div>
              <div style={styles.acoes}>
                <Link to={`/produto/${encodeURIComponent(p.codigo)}`} style={styles.botaoAbrir}>Abrir</Link>
                <button onClick={() => handleRemover(p.codigo)} style={styles.botaoRemover}>Remover</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

const styles = {
  pagina: { minHeight: '100dvh', background: '#f7f7f8' },
  cabecalho: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px', background: '#ffffff', borderBottom: '1px solid #eee'
  },
  voltar: { color: '#0057ff', textDecoration: 'none', fontWeight: 600, fontSize: '14px' },
  titulo: { fontSize: '18px', fontWeight: 800, margin: 0 },
  contador: {
    background: '#e4002b', color: '#fff', borderRadius: '999px',
    padding: '2px 10px', fontSize: '13px', fontWeight: 700
  },
  conteudo: { padding: '16px' },
  status: { textAlign: 'center', color: '#666', marginTop: '32px' },
  lista: { display: 'flex', flexDirection: 'column', gap: '12px' },
  item: {
    display: 'flex', gap: '12px', background: '#fff', borderRadius: '13px',
    padding: '10px', boxShadow: '0 1px 2px rgba(20,20,26,0.06)'
  },
  foto: { width: '80px', height: '80px', objectFit: 'contain', flexShrink: 0 },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  nome: { fontWeight: 700, fontSize: '14px' },
  detalhe: { fontSize: '12px', color: '#666' },
  preco: { fontWeight: 800, fontSize: '15px', marginTop: '4px' },
  acoes: { display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' },
  botaoAbrir: {
    background: '#e4002b', color: '#fff', textDecoration: 'none', textAlign: 'center',
    fontSize: '12px', fontWeight: 700, padding: '6px 10px', borderRadius: '8px'
  },
  botaoRemover: {
    background: '#f0f0f0', color: '#333', border: 'none', fontSize: '12px',
    fontWeight: 700, padding: '6px 10px', borderRadius: '8px', cursor: 'pointer'
  }
}
