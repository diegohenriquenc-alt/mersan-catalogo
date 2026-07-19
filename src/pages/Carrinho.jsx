import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarCarrinho, removerDoCarrinho, definirTamanho } from '../utils/carrinho.js'

const IMAGEM_PADRAO = '/icons/icon-512.svg'

export default function Carrinho() {
  const [itens, setItens] = useState(listarCarrinho())
  const [produtos, setProdutos] = useState({})
  const [estoques, setEstoques] = useState({})
  const [loading, setLoading] = useState(true)
  const [vendedores, setVendedores] = useState([])
  const [vendedorEscolhido, setVendedorEscolhido] = useState(null)

  useEffect(() => {
    function atualizar() {
      setItens(listarCarrinho())
    }
    window.addEventListener('carrinho-mudou', atualizar)
    return () => window.removeEventListener('carrinho-mudou', atualizar)
  }, [])

  useEffect(() => {
    fetch('/api/vendedores')
      .then((r) => r.json())
      .then((data) => setVendedores(data.vendedores || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (itens.length === 0) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all(
      itens.map(async (item) => {
        const respProduto = await fetch(`/api/produto?termo=${encodeURIComponent(item.codigo)}`)
        const dadosProduto = respProduto.ok ? await respProduto.json() : null
        if (!dadosProduto) return null

        const respEstoque = await fetch(`/api/estoque?referencia=${encodeURIComponent(dadosProduto.referencia)}`)
        const dadosEstoque = respEstoque.ok ? await respEstoque.json() : null

        return { codigo: item.codigo, produto: dadosProduto, estoque: dadosEstoque?.estoque || [] }
      })
    ).then((lista) => {
      const mapaProdutos = {}
      const mapaEstoques = {}
      lista.filter(Boolean).forEach((r) => {
        mapaProdutos[r.codigo] = r.produto
        mapaEstoques[r.codigo] = r.estoque
      })
      setProdutos(mapaProdutos)
      setEstoques(mapaEstoques)
      setLoading(false)
    })
  }, [itens.map((i) => i.codigo).join(',')])

  function handleTamanho(codigo, tamanho) {
    definirTamanho(codigo, tamanho)
  }

  function handleRemover(codigo) {
    removerDoCarrinho(codigo)
  }

  function handleFinalizar() {
    const itensParaEnviar = itens.map((i) => ({ codigo: i.codigo, tamanho: i.tamanho }))
    const params = new URLSearchParams({
      vendedor: vendedorEscolhido,
      itens: JSON.stringify(itensParaEnviar)
    })
    window.location.href = `/ir-vendedor-carrinho?${params.toString()}`
  }

  const todosComTamanho = itens.length > 0 && itens.every((i) => i.tamanho)
  const podeFinalizar = todosComTamanho && Boolean(vendedorEscolhido)

  return (
    <div style={styles.pagina}>
      <header style={styles.cabecalho}>
        <Link to="/" style={styles.voltar}>← Catálogo</Link>
        <h1 style={styles.titulo}>Meu Carrinho</h1>
        <span style={styles.contador}>{itens.length}</span>
      </header>

      <main style={styles.conteudo}>
        {loading && <p style={styles.status}>Carregando carrinho…</p>}
        {!loading && itens.length === 0 && (
          <p style={styles.status}>Seu carrinho está vazio.</p>
        )}

        {itens.length > 0 && (
          <div style={styles.blocoVendedor}>
            <span style={styles.tituloVendedor}>Escolha o vendedor</span>
            <div style={styles.opcoesVendedor}>
              {vendedores.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVendedorEscolhido(v.id)}
                  style={{
                    ...styles.botaoVendedor,
                    ...(vendedorEscolhido === v.id ? styles.botaoVendedorAtivo : {})
                  }}
                >
                  {v.nome}
                </button>
              ))}
            </div>
            {vendedores.length === 0 && (
              <span style={styles.avisoTamanho}>Nenhum vendedor cadastrado ainda.</span>
            )}
          </div>
        )}

        <div style={styles.lista}>
          {itens.map((item) => {
            const p = produtos[item.codigo]
            if (!p) return null
            const tamanhos = estoques[item.codigo] || []

            return (
              <div key={item.codigo} style={styles.itemCard}>
                <img
                  src={`/produto-foto/${encodeURIComponent(p.codigoBarras || item.codigo)}`}
                  alt={p.nome}
                  style={styles.foto}
                  onError={(e) => { e.currentTarget.src = IMAGEM_PADRAO }}
                />
                <div style={styles.info}>
                  <span style={styles.nome}>{p.nome}</span>
                  <span style={styles.preco}>R$ {Number(p.preco).toFixed(2).replace('.', ',')}</span>

                  <select
                    value={item.tamanho || ''}
                    onChange={(e) => handleTamanho(item.codigo, e.target.value)}
                    style={styles.selectTamanho}
                  >
                    <option value="">Escolha o tamanho</option>
                    {tamanhos.map((t) => (
                      <option key={t.tamanho} value={t.tamanho}>{t.tamanho}</option>
                    ))}
                  </select>

                  {!item.tamanho && <span style={styles.avisoTamanho}>Escolha o tamanho para continuar</span>}
                </div>
                <button onClick={() => handleRemover(item.codigo)} style={styles.botaoRemover}>Remover</button>
              </div>
            )
          })}
        </div>

        {itens.length > 0 && (
          <button
            disabled={!podeFinalizar}
            onClick={handleFinalizar}
            style={{ ...styles.botaoFinalizar, opacity: podeFinalizar ? 1 : 0.5 }}
          >
            Finalizar pedido
          </button>
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
  conteudo: { padding: '16px', paddingBottom: '100px' },
  status: { textAlign: 'center', color: '#666', marginTop: '32px' },
  blocoVendedor: {
    background: '#fff', borderRadius: '13px', padding: '14px',
    marginBottom: '16px', boxShadow: '0 1px 2px rgba(20,20,26,0.06)'
  },
  tituloVendedor: { fontWeight: 700, fontSize: '14px', display: 'block', marginBottom: '8px' },
  opcoesVendedor: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  botaoVendedor: {
    border: '1px solid #ddd', background: '#f7f7f8', borderRadius: '999px',
    padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
  },
  botaoVendedorAtivo: {
    background: '#e4002b', color: '#fff', border: '1px solid #e4002b'
  },
  lista: { display: 'flex', flexDirection: 'column', gap: '12px' },
  itemCard: {
    display: 'flex', gap: '12px', background: '#fff', borderRadius: '13px',
    padding: '10px', boxShadow: '0 1px 2px rgba(20,20,26,0.06)'
  },
  foto: { width: '72px', height: '72px', objectFit: 'contain', flexShrink: 0 },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
  nome: { fontWeight: 700, fontSize: '13px' },
  preco: { fontWeight: 800, fontSize: '14px' },
  selectTamanho: {
    marginTop: '4px', padding: '6px', borderRadius: '8px',
    border: '1px solid #ddd', fontSize: '13px'
  },
  avisoTamanho: { fontSize: '11px', color: '#e4002b' },
  botaoRemover: {
    background: '#f0f0f0', color: '#333', border: 'none', fontSize: '12px',
    fontWeight: 700, padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
    alignSelf: 'flex-start'
  },
  botaoFinalizar: {
    position: 'fixed', bottom: '16px', left: '16px', right: '16px',
    background: '#e4002b', color: '#fff', border: 'none', borderRadius: '13px',
    padding: '16px', fontSize: '16px', fontWeight: 800, cursor: 'pointer'
  }
    }
