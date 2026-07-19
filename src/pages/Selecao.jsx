import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const IMAGEM_PADRAO = '/icons/icon-512.svg'

export default function Selecao() {
  const { id } = useParams()
  const [itens, setItens] = useState([])
  const [ausentes, setAusentes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let cancelado = false
    setLoading(true)
    setErro(null)

    fetch(`/api/selecao?id=${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error('nao-encontrada')
        return r.json()
      })
      .then((selecao) => {
        const lista = Array.isArray(selecao?.itens) ? selecao.itens : []
        return Promise.all(
          lista.map(async (item) => {
            try {
              const respProduto = await fetch(`/api/produto?termo=${encodeURIComponent(item.codigo)}`)
              if (!respProduto.ok) return null
              const p = await respProduto.json()
              return { ...item, produto: p }
            } catch {
              return null
            }
          })
        ).then((resultados) => {
          if (cancelado) return
          const encontrados = resultados.filter(Boolean)
          setItens(encontrados)
          setAusentes(resultados.length - encontrados.length)
          setLoading(false)
        })
      })
      .catch(() => {
        if (!cancelado) {
          setErro('Não encontramos essa seleção. O link pode ter expirado.')
          setLoading(false)
        }
      })

    return () => { cancelado = true }
  }, [id])

  const total = itens.reduce((soma, item) => {
    const preco = item.produto?.preco
    return preco ? soma + Number(preco) : soma
  }, 0)

  return (
    <div style={styles.pagina}>
      <header style={styles.cabecalho}>
        <Link to="/" style={styles.voltar}>← Catálogo</Link>
        <h1 style={styles.titulo}>Seleção do Cliente</h1>
        <span style={styles.contador}>{itens.length}</span>
      </header>

      <main style={styles.conteudo}>
        {loading && <p style={styles.status}>Carregando seleção…</p>}
        {!loading && erro && <p style={styles.status}>{erro}</p>}

        {!loading && !erro && itens.length === 0 && (
          <p style={styles.status}>Essa seleção não tem produtos disponíveis no momento.</p>
        )}

        {!loading && !erro && ausentes > 0 && (
          <div style={styles.aviso}>
            {ausentes === 1
              ? '1 produto desta seleção não está mais disponível.'
              : `${ausentes} produtos desta seleção não estão mais disponíveis.`}
          </div>
        )}

        <div style={styles.lista}>
          {itens.map((item, i) => {
            const p = item.produto
            return (
              <div key={`${item.codigo}-${i}`} style={styles.item}>
                <img
                  src={`/produto-foto/${encodeURIComponent(p.codigoBarras || item.codigo)}`}
                  alt={p.nome}
                  style={styles.foto}
                  onError={(e) => { e.currentTarget.src = IMAGEM_PADRAO }}
                />
                <div style={styles.info}>
                  <span style={styles.nome}>{p.nome}</span>
                  {p.referencia && <span style={styles.detalhe}>Referência: {p.referencia}</span>}
                  {p.cor && <span style={styles.detalhe}>Cor: {p.cor}</span>}
                  {item.tamanho && <span style={styles.detalhe}>Tamanho: {item.tamanho}</span>}
                  {p.preco != null && (
                    <span style={styles.preco}>R$ {Number(p.preco).toFixed(2).replace('.', ',')}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {total > 0 && (
          <div style={styles.blocoTotal}>
            <span style={styles.tituloTotal}>Total</span>
            <span style={styles.valorTotal}>R$ {total.toFixed(2).replace('.', ',')}</span>
          </div>
        )}
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
  conteudo: { padding: '16px', paddingBottom: '40px' },
  status: { textAlign: 'center', color: '#666', marginTop: '32px' },
  aviso: {
    background: '#fff4f4', color: '#a80022', border: '1px solid #ffd6d6',
    borderRadius: '10px', padding: '10px 12px', fontSize: '13px',
    fontWeight: 600, marginBottom: '16px'
  },
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
  blocoTotal: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', borderRadius: '13px', padding: '14px', marginTop: '16px',
    boxShadow: '0 1px 2px rgba(20,20,26,0.06)'
  },
  tituloTotal: { fontWeight: 700, fontSize: '14px' },
  valorTotal: { fontWeight: 800, fontSize: '18px', color: '#e4002b' }
}
