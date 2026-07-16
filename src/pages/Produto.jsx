import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import ProductResult from '../components/ProductResult.jsx'
import ApiService from '../services/api.js'

const PARCELA_MINIMA = 29.99
const MAX_PARCELAS = 10

export default function Produto() {
  const { codigo } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [produto, setProduto] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const [vendedores, setVendedores] = useState([])
  const [tamanhoEscolhido, setTamanhoEscolhido] = useState(null)
  const [parcelasEscolhidas, setParcelasEscolhidas] = useState(null)

  useEffect(() => {
    let cancelado = false

    setLoading(true)
    setError(null)
    setProduto(null)
    setTamanhoEscolhido(null)
    setParcelasEscolhidas(null)

    ApiService.buscarProduto(codigo)
      .then((data) => {
        if (!cancelado) setProduto(data)
      })
      .catch((err) => {
        if (!cancelado) setError(err.message || 'Não foi possível consultar o produto.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [codigo])

  useEffect(() => {
    let cancelado = false
    fetch('/api/vendedores')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelado) setVendedores(data.vendedores || [])
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [])

  const urlProduto = typeof window !== 'undefined' ? window.location.href : ''

  async function handleCompartilhar() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: produto?.nome || 'Mersan Calçados',
          text: 'Mersan Calçados • Loja 261',
          url: urlProduto
        })
      } catch {
        // Pessoa cancelou o compartilhamento — não faz nada.
      }
    } else {
      handleCopiarLink()
    }
  }

  async function handleCopiarLink() {
    try {
      await navigator.clipboard.writeText(urlProduto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sem permissão de clipboard — a pessoa pode copiar direto da barra de endereço.
    }
  }

  const maxParcelas = produto?.preco
    ? Math.min(MAX_PARCELAS, Math.max(1, Math.floor(produto.preco / PARCELA_MINIMA)))
    : 1

  const opcoesParcelas = Array.from({ length: maxParcelas }, (_, i) => i + 1)

  function linkPedido(vendedorId) {
    const params = new URLSearchParams({
      vendedor: vendedorId,
      codigo,
      tamanho: tamanhoEscolhido,
      parcelas: String(parcelasEscolhidas)
    })
    return `/ir-vendedor?${params.toString()}`
  }

  return (
    <main style={styles.main}>
      <div style={styles.content}>
        <Logo />

        {loading && <p style={styles.status}>Consultando…</p>}
        {error && <p style={styles.error}>{error}</p>}

        {produto && (
          <>
            <ProductResult produto={produto} ocultarEstoque />

            {produto.estoque?.length > 0 ? (
              <div style={styles.secao}>
                <h2 style={styles.secaoTitulo}>1. Escolha o tamanho</h2>
                <div style={styles.opcoes}>
                  {produto.estoque.map((item) => (
                    <button
                      key={item.tamanho}
                      onClick={() => {
                        setTamanhoEscolhido(item.tamanho)
                        setParcelasEscolhidas(null)
                      }}
                      style={
                        tamanhoEscolhido === item.tamanho
                          ? styles.opcaoSelecionada
                          : styles.opcao
                      }
                    >
                      {item.tamanho}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p style={styles.dica}>Sem tamanhos disponíveis nesta loja no momento.</p>
            )}

            {tamanhoEscolhido && produto.preco != null && (
              <div style={styles.secao}>
                <h2 style={styles.secaoTitulo}>2. Escolha o parcelamento</h2>
                <div style={styles.opcoes}>
                  {opcoesParcelas.map((n) => (
                    <button
                      key={n}
                      onClick={() => setParcelasEscolhidas(n)}
                      style={
                        parcelasEscolhidas === n ? styles.opcaoSelecionada : styles.opcao
                      }
                    >
                      {n === 1
                        ? `À vista R$ ${produto.preco.toFixed(2).replace('.', ',')}`
                        : `${n}x de R$ ${(produto.preco / n).toFixed(2).replace('.', ',')}`}
                    </button>
                  ))}
                </div>
                <p style={styles.dicaPequena}>Parcela mínima: R$ 29,99 • até 10x</p>
              </div>
            )}

            {tamanhoEscolhido && parcelasEscolhidas && (
              <div style={styles.secao}>
                <h2 style={styles.secaoTitulo}>3. Escolha o vendedor</h2>
                {vendedores.length === 0 ? (
                  <p style={styles.dica}>Nenhum vendedor cadastrado ainda.</p>
                ) : (
                  <div style={styles.opcoes}>
                    {vendedores.map((v) => (
                      <a key={v.id} href={linkPedido(v.id)} style={styles.botaoVendedor}>
                        {v.nome}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={styles.botoes}>
              <button onClick={handleCompartilhar} style={styles.botaoPrimario}>
                Compartilhar
              </button>
              <button onClick={handleCopiarLink} style={styles.botaoSecundario}>
                {copiado ? 'Link copiado!' : 'Copiar link'}
              </button>
              <Link to="/" style={styles.botaoVoltar}>
                Voltar
              </Link>
            </div>
          </>
        )}

        {!loading && !produto && !error && (
          <Link to="/" style={styles.botaoVoltar}>
            Voltar para a busca
          </Link>
        )}
      </div>
    </main>
  )
}

const styles = {
  main: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  content: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px'
  },
  status: {
    fontSize: '14px',
    color: '#6b6b6b'
  },
  error: {
    color: '#d92d20',
    fontSize: '14px',
    textAlign: 'center',
    maxWidth: '480px'
  },
  secao: {
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  secaoTitulo: {
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.02em',
    color: '#111111',
    margin: 0
  },
  opcoes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  opcao: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#111111',
    background: '#f2f2f2',
    border: '1px solid #e6e6e6',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  opcaoSelecionada: {
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#0057ff',
    border: '1px solid #0057ff',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  botaoVendedor: {
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#25D366',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer',
    textDecoration: 'none'
  },
  dica: {
    fontSize: '13px',
    color: '#6b6b6b',
    textAlign: 'center',
    margin: 0
  },
  dicaPequena: {
    fontSize: '12px',
    color: '#6b6b6b',
    margin: 0
  },
  botoes: {
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  botaoPrimario: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#0057ff',
    border: 'none',
    borderRadius: '10px',
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
  botaoVoltar: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#6b6b6b',
    textAlign: 'center',
    textDecoration: 'none'
  }
}
