import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ApiService from '../services/api.js'

const IMAGEM_PADRAO = '/icons/icon-512.svg'
const PARCELA_MINIMA = 29.99
const MAX_PARCELAS = 10

function formatarPreco(preco) {
  return preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Produto() {
  const { codigo } = useParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [produto, setProduto] = useState(null)

  const [vendedores, setVendedores] = useState([])
  const [tamanhoEscolhido, setTamanhoEscolhido] = useState(null)
  const [parcelasEscolhidas, setParcelasEscolhidas] = useState('')
  const [vendedorEscolhido, setVendedorEscolhido] = useState(null)

  useEffect(() => {
    let cancelado = false

    setLoading(true)
    setError(null)
    setProduto(null)
    setTamanhoEscolhido(null)
    setParcelasEscolhidas('')
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

  const maxParcelas = produto?.preco
    ? Math.min(MAX_PARCELAS, Math.max(1, Math.floor(produto.preco / PARCELA_MINIMA)))
    : 1
  const opcoesParcelas = Array.from({ length: maxParcelas }, (_, i) => i + 1)

  const linkPedidoPronto = Boolean(tamanhoEscolhido && parcelasEscolhidas && vendedorEscolhido)
  const paramsPedido = linkPedidoPronto
    ? new URLSearchParams({
        vendedor: vendedorEscolhido,
        codigo,
        tamanho: tamanhoEscolhido,
        parcelas: String(parcelasEscolhidas)
      }).toString()
    : ''

  return (
    <main style={styles.pagina}>
      <div style={styles.topo}>
        <Link to="/" style={styles.voltar}>
          ← Voltar ao catálogo
        </Link>
      </div>

      {loading && <p style={styles.status}>Consultando…</p>}
      {error && <p style={styles.erro}>{error}</p>}

      {produto && (
        <div style={styles.conteudo}>
          <div style={styles.fotoWrapper}>
            {produto.emPromocao && <span style={styles.selo}>PROMOÇÃO</span>}
            <img
              src={produto.foto || IMAGEM_PADRAO}
              alt={produto.nome}
              style={styles.foto}
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = IMAGEM_PADRAO
              }}
            />
          </div>

          <div style={styles.info}>
            <h1 style={styles.nome}>{produto.nome}</h1>

            <div style={styles.precoLinha}>
              {produto.emPromocao && produto.precoOriginal > produto.preco && (
                <span style={styles.precoOriginal}>{formatarPreco(produto.precoOriginal)}</span>
              )}
              {produto.preco != null && <span style={styles.preco}>{formatarPreco(produto.preco)}</span>}
            </div>

            {produto.preco != null && maxParcelas > 1 && (
              <p style={styles.parcelamento}>
                em até {maxParcelas}x de R$ {(produto.preco / maxParcelas).toFixed(2).replace('.', ',')} sem juros
              </p>
            )}
          </div>

          {produto.estoque?.length > 0 && (
            <div style={styles.secao}>
              <h2 style={styles.secaoTitulo}>1. Escolha o tamanho</h2>
              <div style={styles.opcoes}>
                {produto.estoque.map((item) => (
                  <button
                    key={item.tamanho}
                    onClick={() => setTamanhoEscolhido(item.tamanho)}
                    style={tamanhoEscolhido === item.tamanho ? styles.opcaoSelecionada : styles.opcao}
                  >
                    {item.tamanho}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!produto.estoque?.length && (
            <p style={styles.dica}>Sem tamanhos disponíveis nesta loja no momento.</p>
          )}

          {tamanhoEscolhido && produto.preco != null && (
            <div style={styles.secao}>
              <h2 style={styles.secaoTitulo}>2. Escolha o parcelamento</h2>
              <select
                value={parcelasEscolhidas}
                onChange={(e) => setParcelasEscolhidas(Number(e.target.value))}
                style={styles.selectParcelamento}
              >
                <option value="" disabled>
                  Selecione o parcelamento ▾
                </option>
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

          {tamanhoEscolhido && parcelasEscolhidas && vendedores.length > 0 && (
            <div style={styles.secao}>
              <h2 style={styles.secaoTitulo}>3. Escolha o vendedor</h2>
              <div style={styles.opcoes}>
                {vendedores.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVendedorEscolhido(v.id)}
                    style={vendedorEscolhido === v.id ? styles.opcaoSelecionada : styles.opcao}
                  >
                    {v.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tamanhoEscolhido && parcelasEscolhidas && vendedores.length === 0 && (
            <p style={styles.dica}>Nenhum vendedor cadastrado ainda.</p>
          )}

          <div style={styles.rodape}>
            {linkPedidoPronto ? (
              <a href={`/ir-vendedor?${paramsPedido}`} style={styles.botaoWhatsApp}>
                Falar com o vendedor no WhatsApp
              </a>
            ) : (
              <button disabled style={styles.botaoWhatsAppDesabilitado}>
                Falar com o vendedor no WhatsApp
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && !produto && !error && (
        <Link to="/" style={styles.voltar}>
          Voltar para o catálogo
        </Link>
      )}
    </main>
  )
}

const styles = {
  pagina: {
    minHeight: '100dvh',
    background: '#ffffff',
    paddingBottom: '100px'
  },
  topo: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: '#ffffff',
    borderBottom: '1px solid #eeeeee',
    padding: '12px 14px'
  },
  voltar: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111111',
    textDecoration: 'none'
  },
  status: {
    fontSize: '14px',
    color: '#6b6b6b',
    textAlign: 'center',
    padding: '30px 0'
  },
  erro: {
    color: '#d92d20',
    fontSize: '14px',
    textAlign: 'center',
    padding: '30px 14px'
  },
  conteudo: {
    display: 'flex',
    flexDirection: 'column'
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
    top: '14px',
    left: '14px',
    background: '#d92d20',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.03em',
    padding: '5px 10px',
    borderRadius: '999px'
  },
  info: {
    padding: '18px 16px 8px'
  },
  nome: {
    fontSize: '19px',
    fontWeight: 700,
    margin: '0 0 10px'
  },
  precoLinha: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '10px',
    flexWrap: 'wrap'
  },
  precoOriginal: {
    fontSize: '15px',
    color: '#9a9a9a',
    textDecoration: 'line-through'
  },
  preco: {
    fontSize: '26px',
    fontWeight: 800,
    color: '#111111'
  },
  parcelamento: {
    fontSize: '13px',
    color: '#6b6b6b',
    margin: '4px 0 0'
  },
  secao: {
    padding: '18px 16px 0'
  },
  secaoTitulo: {
    fontSize: '14px',
    fontWeight: 700,
    margin: '0 0 10px'
  },
  opcoes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  opcao: {
    minWidth: '52px',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#111111',
    background: '#f2f2f2',
    border: '1px solid #e6e6e6',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  opcaoSelecionada: {
    minWidth: '52px',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#111111',
    border: '1px solid #111111',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  selectParcelamento: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#111111',
    background: '#f2f2f2',
    border: '1px solid #e6e6e6',
    borderRadius: '12px',
    appearance: 'auto'
  },
  dica: {
    fontSize: '13px',
    color: '#6b6b6b',
    padding: '18px 16px 0',
    margin: 0
  },
  rodape: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    background: '#ffffff',
    borderTop: '1px solid #eeeeee',
    padding: '12px 16px',
    zIndex: 10
  },
  botaoWhatsApp: {
    display: 'block',
    textAlign: 'center',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 800,
    color: '#ffffff',
    background: '#25D366',
    borderRadius: '999px',
    textDecoration: 'none'
  },
  botaoWhatsAppDesabilitado: {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 800,
    color: '#9a9a9a',
    background: '#e6e6e6',
    border: 'none',
    borderRadius: '999px',
    cursor: 'not-allowed'
  }
              }
