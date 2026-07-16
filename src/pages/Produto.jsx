import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import ProductResult from '../components/ProductResult.jsx'
import ApiService from '../services/api.js'

const PARCELA_MINIMA = 25

export default function Produto() {
  const { codigo } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [produto, setProduto] = useState(null)
  const [copiado, setCopiado] = useState(false)

  const [vendedores, setVendedores] = useState([])
  const [tamanhoEscolhido, setTamanhoEscolhido] = useState(null)
  const [parcelasEscolhidas, setParcelasEscolhidas] = useState(1)
  const [vendedorEscolhido, setVendedorEscolhido] = useState(null)

  useEffect(() => {
    let cancelado = false

    setLoading(true)
    setError(null)
    setProduto(null)
    setTamanhoEscolhido(null)
    setParcelasEscolhidas(1)
    setVendedorEscolhido(null)

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
    ? Math.max(1, Math.floor(produto.preco / PARCELA_MINIMA))
    : 1

  const opcoesParcelas = Array.from({ length: maxParcelas }, (_, i) => i + 1)

  const podeEnviarPedido = Boolean(tamanhoEscolhido && vendedorEscolhido)

  function linkPedido() {
    const params = new URLSearchParams({
      vendedor: vendedorEscolhido,
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
            <ProductResult produto={produto} />

            {produto.estoque?.length > 0 && (
              <div style={styles.secao}>
                <h2 style={styles.secaoTitulo}>Escolha o tamanho</h2>
                <div style={styles.opcoes}>
                  {produto.estoque.map((item) => (
                    <button
                      key={item.tamanho}
                      onClick={() => setTamanhoEscolhido(item.tamanho)}
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
            )}

            {produto.preco != null && (
              <div style={styles.secao}>
                <h2 style={styles.secaoTitulo}>Parcelamento (parcela mínima R$ 25)</h2>
                <select
                  value={parcelasEscolhidas}
                  onChange={(e) => setParcelasEscolhidas(Number(e.target.value))}
                  style={styles.select}
                >
                  {opcoesParcelas.map((n) => (
                    <option key={n} value={n}>
                      {n === 1
                        ? `À vista — R$ ${produto.preco.toFixed(2).replace('.', ',')}`
                        : `${n}x de R$ ${(produto.preco / n).toFixed(2).replace('.', ',')}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {vendedores.length > 0 && (
              <div style={styles.secao}>
                <h2 style={styles.secaoTitulo}>Escolha o vendedor</h2>
                <div style={styles.opcoes}>
                  {vendedores.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVendedorEscolhido(v.id)}
                      style={
                        vendedorEscolhido === v.id
                          ? styles.opcaoSelecionada
                          : styles.opcao
                      }
                    >
                      {v.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.botoes}>
              {podeEnviarPedido && (
                <a href={linkPedido()} style={styles.botaoWhatsApp}>
                  Enviar pedido no WhatsApp
                </a>
              )}
              {!podeEnviarPedido && vendedores.length > 0 && (
                <p style={styles.dica}>
                  Escolha o tamanho e o vendedor para enviar o pedido.
                </p>
              )}
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
  select: {
    padding: '12px 14px',
    fontSize: '15px',
    borderRadius: '10px',
    border: '1px solid #e6e6e6',
    background: '#ffffff'
  },
  dica: {
    fontSize: '13px',
    color: '#6b6b6b',
    textAlign: 'center',
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
  botaoWhatsApp: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#25D366',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'none',
    display: 'block'
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
