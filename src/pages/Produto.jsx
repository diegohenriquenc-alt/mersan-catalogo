import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import ApiService from '../services/api.js'
import { limparNomeProduto } from '../utils/nomeProduto.js'

// Cada vendedor recebe uma cor fixa e diferente, pra chamar mais atenção nos
// botões de escolha (a mesma paleta é usada nesta página e no carrinho).
const PALETA_VENDEDORES = ['#e4002b', '#0a7cff', '#0f9d58', '#f4a300', '#7b2ff7', '#00b8a9', '#ff6f3c', '#c2185b']
function corVendedor(id) {
  let hash = 0
  for (let i = 0; i < String(id).length; i++) hash = (hash * 31 + String(id).charCodeAt(i)) >>> 0
  return PALETA_VENDEDORES[hash % PALETA_VENDEDORES.length]
}

const IMAGEM_PADRAO = '/icons/icon-512.svg'
const PARCELA_MINIMA = 29.99
const MAX_PARCELAS = 10

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

// Chave de agrupamento por modelo: a referência COMPLETA (ver explicação
// detalhada em Catalogo.jsx). Testado ao vivo: tirar o sufixo numérico da
// referência parece identificar cor em alguns produtos, mas em outros
// (mesma marca, mesmo prefixo) esse sufixo é na verdade um MODELO
// diferente — juntar nesses casos misturaria produtos diferentes no mesmo
// card, então a comparação é sempre pela referência inteira.
function modeloDaReferencia(referencia) {
  if (!referencia) return null
  return referencia.trim()
}

function formatarPreco(preco) {
  return preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function calcularParcelamento(preco) {
  if (preco == null) return null
  const max = Math.min(MAX_PARCELAS, Math.max(1, Math.floor(preco / PARCELA_MINIMA)))
  if (max <= 1) return null
  const valor = (preco / max).toFixed(2).replace('.', ',')
  return `em até ${max}x de R$ ${valor}`
}

export default function Produto() {
  const { codigo } = useParams()
  const navigate = useNavigate()

  // codigoAtual pode divergir do parâmetro de rota quando o cliente troca
  // de cor pelo seletor: atualizamos a URL (replace, sem navegação de
  // fato), mas quem comanda o que é carregado é este estado local.
  const [codigoAtual, setCodigoAtual] = useState(codigo)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [produto, setProduto] = useState(null)

  const [estoque, setEstoque] = useState(null)
  const [carregandoEstoque, setCarregandoEstoque] = useState(true)
  const [erroEstoque, setErroEstoque] = useState(false)

  const [vendedores, setVendedores] = useState([])
  const [tamanhoEscolhido, setTamanhoEscolhido] = useState(null)
  const [parcelasEscolhidas, setParcelasEscolhidas] = useState('')
  const [vendedorEscolhido, setVendedorEscolhido] = useState(null)

  const [relacionados, setRelacionados] = useState([])
  const [variantesCor, setVariantesCor] = useState([])

  // Chegou aqui por um link de verdade (catálogo, relacionados, etc): o
  // parâmetro de rota muda, então sincroniza o código "atual" com ele.
  useEffect(() => {
    setCodigoAtual(codigo)
  }, [codigo])

  useEffect(() => {
    let cancelado = false

    setLoading(true)
    setError(null)
    setProduto(null)
    setEstoque(null)
    setErroEstoque(false)
    setCarregandoEstoque(true)
    setTamanhoEscolhido(null)
    setParcelasEscolhidas('')
    setVendedorEscolhido(null)
    window.scrollTo({ top: 0 })

    async function carregar() {
      let dados
      try {
        dados = await ApiService.buscarDadosProduto(codigoAtual)
      } catch (err) {
        if (!cancelado) {
          setError(err.message || 'Não foi possível consultar o produto.')
          setLoading(false)
          setCarregandoEstoque(false)
        }
        return
      }

      if (cancelado) return

      const chaveFoto = dados.codigoBarras || codigoAtual
      setProduto({
        referencia: dados.referencia,
        nome: dados.nome,
        cor: dados.cor,
        preco: dados.preco,
        precoOriginal: dados.precoOriginal,
        emPromocao: dados.emPromocao,
        foto: `/produto-foto/${encodeURIComponent(chaveFoto)}`
      })
      setLoading(false)

      try {
        const estoqueResp = await ApiService.buscarEstoque(dados.referencia, dados.cor)
        if (!cancelado) setEstoque(estoqueResp.estoque || [])
      } catch {
        if (!cancelado) setErroEstoque(true)
      } finally {
        if (!cancelado) setCarregandoEstoque(false)
      }
    }

    carregar()

    return () => {
      cancelado = true
    }
  }, [codigoAtual])

  // Troca de cor: atualiza o produto exibido sem sair da página (sem
  // remount) e mantém a URL coerente com o código sendo mostrado.
  function selecionarCor(variante) {
    if (!variante || variante.codigo === codigoAtual) return
    setCodigoAtual(variante.codigo)
    navigate(`/produto/${encodeURIComponent(variante.codigo)}`, { replace: true })
  }

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

  useEffect(() => {
    if (!produto) return
    let cancelado = false
    fetch(`/api/catalogo?t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return
        const todosProdutos = data.produtos || []
        const atual = todosProdutos.find((p) => p.codigo === codigoAtual)
        const outros = todosProdutos.filter((p) => p.codigo !== codigoAtual)

        // Variantes de cor: mesmo modelo (referência sem sufixo de cor),
        // uma entrada por cor, priorizando a de maior estoque disponível
        // quando a mesma cor aparecer bipada mais de uma vez.
        const modeloAtual = modeloDaReferencia(produto.referencia)
        if (modeloAtual) {
          const porCor = new Map()
          for (const p of todosProdutos) {
            if (modeloDaReferencia(p.referencia) !== modeloAtual) continue
            const chaveCor = (p.cor || '').trim().toUpperCase() || p.codigo
            const existente = porCor.get(chaveCor)
            if (!existente || (p.estoqueTotal || 0) > (existente.estoqueTotal || 0)) {
              porCor.set(chaveCor, p)
            }
          }
          // A cor sendo exibida agora sempre aparece na lista, mesmo que
          // ainda não tenha sido "varrida" pelo catálogo pronto (ex:
          // acabou de ser bipada).
          const chaveCorAtual = (produto.cor || '').trim().toUpperCase() || codigoAtual
          if (!porCor.has(chaveCorAtual)) {
            porCor.set(chaveCorAtual, {
              codigo: codigoAtual,
              cor: produto.cor,
              referencia: produto.referencia,
              estoqueTotal: null
            })
          }
          setVariantesCor(
            Array.from(porCor.values()).sort((a, b) =>
              String(a.cor || '').localeCompare(String(b.cor || ''))
            )
          )
        } else {
          setVariantesCor([])
        }

        const marcaAtual = extrairMarca(produto.nome)
        const mesmaMarca = marcaAtual
          ? outros.filter((p) => extrairMarca(p.nome) === marcaAtual)
          : []

        let lista = [...mesmaMarca]
        if (lista.length < 10 && atual?.categoria) {
          const codigosJaNaLista = new Set(lista.map((p) => p.codigo))
          const mesmaCategoria = outros.filter(
            (p) => p.categoria === atual.categoria && !codigosJaNaLista.has(p.codigo)
          )
          lista = [...lista, ...mesmaCategoria]
        }
        if (lista.length === 0) lista = outros

        setRelacionados(lista.slice(0, 10))
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [produto, codigoAtual])

  const maxParcelas = produto?.preco
    ? Math.min(MAX_PARCELAS, Math.max(1, Math.floor(produto.preco / PARCELA_MINIMA)))
    : 1
  const opcoesParcelas = Array.from({ length: maxParcelas }, (_, i) => i + 1)

  const linkPedidoPronto = Boolean(tamanhoEscolhido && parcelasEscolhidas && vendedorEscolhido)
  const paramsPedido = linkPedidoPronto
    ? new URLSearchParams({
        vendedor: vendedorEscolhido,
        codigo: codigoAtual,
        tamanho: tamanhoEscolhido,
        parcelas: String(parcelasEscolhidas)
      }).toString()
    : ''

  const marca = produto ? extrairMarca(produto.nome) : null
  const nomeExibido = produto ? limparNomeProduto(produto.nome) : ''

  return (
    <main style={styles.pagina}>
      <style>{'@keyframes mersanGirar { to { transform: rotate(360deg) } }'}</style>
      <div style={styles.topo}>
        <Link to="/" style={styles.voltar}>
          <IconeVoltar />
          Catálogo
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
              alt={nomeExibido}
              style={styles.foto}
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = IMAGEM_PADRAO
              }}
            />
          </div>

          <div style={styles.info}>
            {marca && <span style={styles.marcaEtiqueta}>{marca}</span>}
            <h1 style={styles.nome}>{nomeExibido}</h1>

            <div style={styles.precoLinha}>
              {produto.emPromocao && produto.precoOriginal > produto.preco && (
                <span style={styles.precoOriginal}>{formatarPreco(produto.precoOriginal)}</span>
              )}
              {produto.preco != null && <span style={styles.preco}>{formatarPreco(produto.preco)}</span>}
            </div>

            {produto.preco != null && maxParcelas > 1 && (
              <p style={styles.parcelamento}>
                {calcularParcelamento(produto.preco)} sem juros
              </p>
            )}
          </div>

          {variantesCor.length > 1 && (
            <div style={styles.secao}>
              <h2 style={styles.secaoTitulo}>Cores disponíveis</h2>
              <div style={styles.opcoesCor}>
                {variantesCor.map((v) => {
                  const selecionada = v.codigo === codigoAtual
                  const semEstoque = v.estoqueTotal === 0
                  return (
                    <button
                      key={v.codigo}
                      onClick={() => selecionarCor(v)}
                      disabled={semEstoque}
                      style={{
                        ...(selecionada ? styles.opcaoCorSelecionada : styles.opcaoCor),
                        opacity: semEstoque ? 0.4 : 1
                      }}
                      aria-label={`Ver cor ${v.cor || ''}`}
                    >
                      <img
                        src={`/produto-foto/${encodeURIComponent(v.codigo)}`}
                        alt={v.cor || ''}
                        style={styles.opcaoCorFoto}
                        onError={(e) => {
                          e.currentTarget.src = IMAGEM_PADRAO
                        }}
                      />
                      <span style={styles.opcaoCorNome}>{v.cor || '—'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {produto.preco != null && (
            <div style={styles.secao}>
              <h2 style={styles.secaoTitulo}>Escolha o tamanho</h2>

              {carregandoEstoque && (
                <p style={styles.dicaCarregando}>
                  <span style={styles.spinner} />
                  Consultando numerações disponíveis…
                </p>
              )}

              {!carregandoEstoque && erroEstoque && (
                <p style={styles.dica}>Não foi possível consultar o estoque agora. Atualize a página pra tentar de novo.</p>
              )}

              {!carregandoEstoque && !erroEstoque && estoque?.length === 0 && (
                <p style={styles.dica}>Sem tamanhos disponíveis nesta loja no momento.</p>
              )}

              {!carregandoEstoque && estoque?.length > 0 && (
                <div style={styles.opcoes}>
                  {estoque.map((item) => (
                    <button
                      key={item.tamanho}
                      onClick={() => setTamanhoEscolhido(item.tamanho)}
                      style={tamanhoEscolhido === item.tamanho ? styles.opcaoSelecionada : styles.opcao}
                    >
                      {item.tamanho}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tamanhoEscolhido && produto.preco != null && (
            <div style={styles.secao}>
              <h2 style={styles.secaoTitulo}>Parcelamento</h2>
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
              <h2 style={styles.secaoTitulo}>Escolha o vendedor</h2>
              <div style={styles.opcoes}>
                {vendedores.map((v) => {
                  const cor = corVendedor(v.id)
                  const selecionado = vendedorEscolhido === v.id
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVendedorEscolhido(v.id)}
                      style={{
                        ...(selecionado ? styles.opcaoSelecionada : styles.opcao),
                        background: selecionado ? cor : `${cor}22`,
                        borderColor: cor,
                        color: selecionado ? '#ffffff' : cor
                      }}
                    >
                      {v.nome}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {tamanhoEscolhido && parcelasEscolhidas && vendedores.length === 0 && (
            <p style={styles.dica}>Nenhum vendedor cadastrado ainda.</p>
          )}

          {relacionados.length > 0 && (
            <div style={styles.secaoRelacionados}>
              <h2 style={styles.secaoTitulo}>Você também pode gostar</h2>
              <div style={styles.carrossel}>
                {relacionados.map((p) => (
                  <Link
                    key={p.codigo}
                    to={`/produto/${encodeURIComponent(p.codigo)}`}
                    style={styles.miniCard}
                  >
                    <div style={styles.miniFotoWrapper}>
                      <img
                        src={`/produto-foto/${encodeURIComponent(p.codigo)}`}
                        alt={limparNomeProduto(p.nome)}
                        loading="lazy"
                        style={styles.miniFoto}
                        onError={(e) => {
                          e.currentTarget.src = IMAGEM_PADRAO
                        }}
                      />
                    </div>
                    <span style={styles.miniNome}>{limparNomeProduto(p.nome)}</span>
                    {p.preco != null && <span style={styles.miniPreco}>{formatarPreco(p.preco)}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div style={styles.rodape}>
            {linkPedidoPronto ? (
              <a href={`/ir-vendedor?${paramsPedido}`} style={styles.botaoWhatsApp}>
                <IconeWhatsApp />
                FALAR COM O VENDEDOR
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

function IconeVoltar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M15 18l-6-6 6-6" stroke="#14141a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconeWhatsApp() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.33 4.96L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.33-1.93 1.4-.5.07-1.03.29-3.46-.72-2.92-1.21-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.82 2.01.89 2.16.07.14.12.31.02.5-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.24 1.62 2.01 1.11.99 2.05 1.3 2.34 1.44.29.15.46.13.63-.08.17-.2.72-.84.92-1.13.19-.29.38-.24.63-.14.26.1 1.65.78 1.93.92.29.14.48.22.55.34.07.13.07.7-.17 1.38Z" />
    </svg>
  )
}

const styles = {
  pagina: {
    minHeight: '100dvh',
    background: '#ffffff',
    paddingBottom: '104px',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
  },
  topo: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    background: '#ffffff',
    boxShadow: '0 1px 0 rgba(20,20,26,0.06)',
    padding: '14px 16px'
  },
  voltar: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#14141a',
    textDecoration: 'none'
  },
  status: {
    fontSize: '14px',
    color: '#8a8a92',
    textAlign: 'center',
    padding: '32px 0'
  },
  erro: {
    color: '#e4002b',
    fontSize: '14px',
    textAlign: 'center',
    padding: '32px 16px'
  },
  conteudo: {
    display: 'flex',
    flexDirection: 'column'
  },
  fotoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1 / 1',
    background: '#ffffff'
  },
  foto: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  selo: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    background: '#e4002b',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    padding: '6px 12px',
    borderRadius: '999px'
  },
  info: {
    padding: '20px 18px 8px'
  },
  marcaEtiqueta: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    color: '#8a8a92',
    marginBottom: '4px'
  },
  nome: {
    fontSize: '20px',
    fontWeight: 800,
    lineHeight: 1.3,
    margin: '0 0 12px',
    color: '#14141a'
  },
  precoLinha: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    flexWrap: 'wrap'
  },
  precoOriginal: {
    fontSize: '16px',
    color: '#b3b3ba',
    textDecoration: 'line-through'
  },
  preco: {
    fontSize: '32px',
    fontWeight: 900,
    color: '#14141a',
    letterSpacing: '-0.01em'
  },
  parcelamento: {
    fontSize: '14px',
    color: '#8a8a92',
    fontWeight: 600,
    margin: '6px 0 0'
  },
  secao: {
    padding: '22px 18px 0'
  },
  secaoRelacionados: {
    padding: '28px 0 0'
  },
  secaoTitulo: {
    fontSize: '15px',
    fontWeight: 800,
    margin: '0 0 12px',
    color: '#14141a',
    padding: '0 18px'
  },
  opcoes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  opcao: {
    minWidth: '54px',
    padding: '13px 16px',
    fontSize: '14px',
    fontWeight: 700,
    color: '#14141a',
    background: '#f7f7f8',
    border: '1px solid #ececec',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  opcaoSelecionada: {
    minWidth: '54px',
    padding: '13px 16px',
    fontSize: '14px',
    fontWeight: 800,
    color: '#ffffff',
    background: '#14141a',
    border: '1px solid #14141a',
    borderRadius: '999px',
    cursor: 'pointer'
  },
  opcoesCor: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  opcaoCor: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    width: '64px',
    padding: '6px',
    background: '#f7f7f8',
    border: '1px solid #ececec',
    borderRadius: '14px',
    cursor: 'pointer'
  },
  opcaoCorSelecionada: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    width: '64px',
    padding: '6px',
    background: '#fff0f1',
    border: '1px solid #e4002b',
    borderRadius: '14px',
    cursor: 'pointer'
  },
  opcaoCorFoto: {
    width: '48px',
    height: '48px',
    objectFit: 'contain',
    borderRadius: '8px',
    background: '#ffffff'
  },
  opcaoCorNome: {
    fontSize: '9.5px',
    fontWeight: 700,
    color: '#14141a',
    textAlign: 'center',
    lineHeight: 1.2,
    maxWidth: '60px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  selectParcelamento: {
    width: '100%',
    padding: '15px 16px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#14141a',
    background: '#f7f7f8',
    border: '1px solid #ececec',
    borderRadius: '14px',
    appearance: 'auto'
  },
  dica: {
    fontSize: '13px',
    color: '#8a8a92',
    padding: '22px 18px 0',
    margin: 0
  },
  dicaCarregando: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#8a8a92',
    margin: 0
  },
  spinner: {
    width: '13px',
    height: '13px',
    borderRadius: '50%',
    border: '2px solid #ececec',
    borderTopColor: '#e4002b',
    animation: 'mersanGirar 0.7s linear infinite',
    flexShrink: 0
  },
  carrossel: {
    display: 'flex',
    gap: '12px',
    overflowX: 'auto',
    padding: '0 18px 4px',
    WebkitOverflowScrolling: 'touch'
  },
  miniCard: {
    flexShrink: 0,
    width: '128px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    textDecoration: 'none',
    color: '#14141a'
  },
  miniFotoWrapper: {
    width: '128px',
    height: '128px',
    borderRadius: '14px',
    background: '#f7f7f8',
    overflow: 'hidden'
  },
  miniFoto: {
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  },
  miniNome: {
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: 1.3,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  miniPreco: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#14141a'
  },
  rodape: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    background: '#ffffff',
    boxShadow: '0 -2px 12px rgba(20,20,26,0.08)',
    padding: '14px 16px',
    zIndex: 10
  },
  botaoWhatsApp: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    textAlign: 'center',
    padding: '17px',
    fontSize: '16px',
    fontWeight: 800,
    letterSpacing: '0.01em',
    color: '#ffffff',
    background: '#25D366',
    borderRadius: '999px',
    textDecoration: 'none'
  },
  botaoWhatsAppDesabilitado: {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    padding: '17px',
    fontSize: '16px',
    fontWeight: 800,
    color: '#b3b3ba',
    background: '#f0f0f1',
    border: 'none',
    borderRadius: '999px',
    cursor: 'not-allowed'
  }
}
