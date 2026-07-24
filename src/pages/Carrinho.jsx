import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listarCarrinho, removerDoCarrinho, definirTamanho } from '../utils/carrinho.js'
import { limparNomeProduto } from '../utils/nomeProduto.js'
import { corVendedor, ordenarVendedoresPorHora } from '../utils/vendedores.js'
import ModalConfirmarEnvioUnico from '../components/ModalConfirmarEnvioUnico.jsx'
import AvisoFlutuante from '../components/AvisoFlutuante.jsx'
import ConfirmacaoPedidoEnviado from '../components/ConfirmacaoPedidoEnviado.jsx'

const IMAGEM_PADRAO = '/icons/icon-512.svg'
const PARCELA_MINIMA = 29.99
const MAX_PARCELAS = 10

// Junta uma lista em texto natural: ["a"] -> "a"; ["a","b"] -> "a e b";
// ["a","b","c"] -> "a, b e c".
function juntarComE(itens) {
  if (itens.length === 0) return ''
  if (itens.length === 1) return itens[0]
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

export default function Carrinho() {
  const navigate = useNavigate()
  const [itens, setItens] = useState(listarCarrinho())
  const [produtos, setProdutos] = useState({})
  const [estoques, setEstoques] = useState({})
  const [loading, setLoading] = useState(true)
  const [vendedores, setVendedores] = useState([])
  const [vendedorEscolhido, setVendedorEscolhido] = useState(null)
  const [parcelasEscolhidas, setParcelasEscolhidas] = useState('')
  const [modalEnvioUnicoAberto, setModalEnvioUnicoAberto] = useState(false)
  const [avisoPendencia, setAvisoPendencia] = useState(null)
  const [pedidoEnviadoAberto, setPedidoEnviadoAberto] = useState(false)

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

        const respEstoque = await fetch(
          `/api/estoque?referencia=${encodeURIComponent(dadosProduto.referencia)}&cor=${encodeURIComponent(dadosProduto.cor || '')}`
        )
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

  const total = itens.reduce((soma, item) => {
    const p = produtos[item.codigo]
    return p?.preco ? soma + Number(p.preco) : soma
  }, 0)

  const maxParcelas = total > 0
    ? Math.min(MAX_PARCELAS, Math.max(1, Math.floor(total / PARCELA_MINIMA)))
    : 1
  const opcoesParcelas = Array.from({ length: maxParcelas }, (_, i) => i + 1)

  const todosComTamanho = itens.length > 0 && itens.every((i) => i.tamanho)
  const podeFinalizar = todosComTamanho && Boolean(vendedorEscolhido) && Boolean(parcelasEscolhidas)
  const nomeVendedorEscolhido = vendedores.find((v) => v.id === vendedorEscolhido)?.nome

  // Link de verdade (<a target="_blank">), não um window.open() disparado
  // por script — abrir nova aba por um clique real de link é sempre
  // confiável no navegador, sem depender de heurística de pop-up nenhuma.
  // Só fica pronto quando dá pra finalizar; nos outros casos o clique é
  // interceptado (preventDefault) pra mostrar aviso ou a confirmação.
  const linkFinalizar = podeFinalizar
    ? `/ir-vendedor-carrinho?${new URLSearchParams({
        vendedor: vendedorEscolhido,
        itens: JSON.stringify(itens.map((i) => ({ codigo: i.codigo, tamanho: i.tamanho }))),
        parcelas: String(parcelasEscolhidas)
      }).toString()}`
    : null

  // Antes o botão só ficava desabilitado, sem dizer por quê. Agora ele
  // sempre reage ao clique: se faltar algo, mostra exatamente o que
  // falta (inclusive quantos itens estão sem tamanho).
  function handleFinalizarClick(e) {
    const faltando = []
    const semTamanho = itens.filter((i) => !i.tamanho).length
    if (semTamanho === 1) faltando.push('o tamanho de 1 produto')
    else if (semTamanho > 1) faltando.push(`o tamanho de ${semTamanho} produtos`)
    if (!vendedorEscolhido) faltando.push('o vendedor')
    if (!parcelasEscolhidas) faltando.push('o parcelamento')

    if (faltando.length > 0) {
      e.preventDefault()
      setAvisoPendencia(`Escolha ${juntarComE(faltando)} para continuar.`)
      return
    }

    setAvisoPendencia(null)

    // Com só 1 item no carrinho, o envio é, na prática, igual ao de mandar
    // um produto avulso — vale a mesma confirmação pra reforçar que dá pra
    // continuar comprando antes de fechar. Segura a navegação (o modal tem
    // seu próprio link) e mostra a confirmação de item único primeiro.
    if (itens.length === 1) {
      e.preventDefault()
      setModalEnvioUnicoAberto(true)
      return
    }

    // 2+ itens, tudo certo: deixa o link seguir normalmente (abre o
    // WhatsApp numa aba separada) e já mostra a confirmação aqui.
    setPedidoEnviadoAberto(true)
  }

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
          <div style={styles.vazio}>
            <span style={styles.vazioIcone}>🛒</span>
            <p style={styles.vazioTexto}>Seu carrinho está vazio.</p>
            <Link to="/" style={styles.vazioBotao}>Ver catálogo</Link>
          </div>
        )}

        {itens.length > 0 && (
          <div style={styles.blocoVendedor}>
            <span style={styles.tituloVendedor}>Escolha o vendedor</span>
            <div style={styles.opcoesVendedor}>
              {ordenarVendedoresPorHora(vendedores).map((v) => {
                const cor = corVendedor(v.id)
                const selecionado = vendedorEscolhido === v.id
                return (
                  <button
                    key={v.id}
                    onClick={() => setVendedorEscolhido(v.id)}
                    style={{
                      ...styles.botaoVendedor,
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
                <button
                  onClick={() => handleRemover(item.codigo)}
                  style={styles.botaoRemover}
                  aria-label="Remover produto do carrinho"
                >
                  ✕
                </button>
                <img
                  src={`/produto-foto/${encodeURIComponent(p.codigoBarras || item.codigo)}`}
                  alt={limparNomeProduto(p.nome)}
                  style={styles.foto}
                  onError={(e) => { e.currentTarget.src = IMAGEM_PADRAO }}
                />
                <div style={styles.info}>
                  <span style={styles.nome}>{limparNomeProduto(p.nome)}</span>
                  {p.cor && <span style={styles.detalhe}>Cor: {p.cor}</span>}
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
              </div>
            )
          })}
        </div>

        {total > 0 && (
          <div style={styles.blocoVendedor}>
            <span style={styles.tituloVendedor}>Total: R$ {total.toFixed(2).replace('.', ',')}</span>
            <select
              value={parcelasEscolhidas}
              onChange={(e) => setParcelasEscolhidas(e.target.value)}
              style={styles.selectTamanho}
            >
              <option value="" disabled>Selecione o parcelamento</option>
              {opcoesParcelas.map((n) => (
                <option key={n} value={n}>
                  {n === 1
                    ? `À vista – R$ ${total.toFixed(2).replace('.', ',')}`
                    : `${n}x de R$ ${(total / n).toFixed(2).replace('.', ',')}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {itens.length > 0 && (
          <a
            href={linkFinalizar || '#'}
            target={linkFinalizar ? '_blank' : undefined}
            rel="noopener"
            onClick={handleFinalizarClick}
            style={{ ...styles.botaoFinalizar, opacity: podeFinalizar ? 1 : 0.6 }}
          >
            Finalizar pedido
          </a>
        )}
      </main>

      <AvisoFlutuante mensagem={avisoPendencia} onFechar={() => setAvisoPendencia(null)} />

      <ModalConfirmarEnvioUnico
        aberto={modalEnvioUnicoAberto}
        linkEnvio={linkFinalizar}
        onContinuarComprando={() => {
          setModalEnvioUnicoAberto(false)
          navigate('/')
        }}
        onEnviarMesmoAssim={() => {
          setModalEnvioUnicoAberto(false)
          setPedidoEnviadoAberto(true)
        }}
      />

      <ConfirmacaoPedidoEnviado
        aberto={pedidoEnviadoAberto}
        nomeVendedor={nomeVendedorEscolhido}
        onFechar={() => setPedidoEnviadoAberto(false)}
      />
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
    border: '1px solid #ddd', borderRadius: '999px',
    padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
  },
  lista: { display: 'flex', flexDirection: 'column', gap: '12px' },
  itemCard: {
    position: 'relative',
    display: 'flex', gap: '14px', background: '#fff', borderRadius: '16px',
    padding: '14px', boxShadow: '0 1px 2px rgba(20,20,26,0.06), 0 3px 10px rgba(20,20,26,0.04)'
  },
  foto: { width: '84px', height: '84px', objectFit: 'contain', flexShrink: 0 },
  info: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, paddingRight: '28px' },
  nome: { fontWeight: 700, fontSize: '14px', lineHeight: 1.3 },
  detalhe: { fontSize: '12.5px', color: '#6b6b6b', fontWeight: 600 },
  preco: { fontWeight: 800, fontSize: '15px', marginTop: '2px' },
  selectTamanho: {
    marginTop: '6px', padding: '11px 10px', borderRadius: '10px',
    border: '1px solid #ddd', fontSize: '14px'
  },
  avisoTamanho: { fontSize: '12px', color: '#e4002b', fontWeight: 600 },
  botaoRemover: {
    position: 'absolute', top: '10px', right: '10px',
    width: '30px', height: '30px',
    background: '#f2f2f3', color: '#6b6b6b', border: 'none', borderRadius: '999px',
    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  vazio: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    padding: '48px 16px'
  },
  vazioIcone: { fontSize: '48px' },
  vazioTexto: { color: '#666', fontSize: '15px', margin: 0 },
  vazioBotao: {
    marginTop: '4px', background: '#14141a', color: '#fff', textDecoration: 'none',
    fontWeight: 700, fontSize: '14px', padding: '13px 24px', borderRadius: '999px'
  },
  botaoFinalizar: {
    display: 'block', boxSizing: 'border-box',
    position: 'fixed', bottom: '16px', left: '16px', right: '16px',
    background: '#e4002b', color: '#fff', border: 'none', borderRadius: '14px',
    padding: '17px', fontSize: '16px', fontWeight: 800, cursor: 'pointer',
    textAlign: 'center', textDecoration: 'none'
  }
}
