import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { contarCarrinho } from '../utils/carrinho.js'
import { ID_ALVO_CARRINHO } from '../utils/carrinhoUI.js'

// Escondido só onde não faz sentido aparecer: a própria página do
// carrinho (redundante), o painel admin, e a página de seleção
// compartilhada (é a visão de quem RECEBE o link no WhatsApp, não de
// quem está montando o próprio carrinho).
function deveEsconder(pathname) {
  return (
    pathname === '/carrinho' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/selecao/')
  )
}

export default function CarrinhoFlutuante() {
  const location = useLocation()
  const navigate = useNavigate()
  const [quantidade, setQuantidade] = useState(contarCarrinho())
  const [bump, setBump] = useState(false)

  useEffect(() => {
    function atualizar() {
      setQuantidade(contarCarrinho())
    }
    window.addEventListener('carrinho-mudou', atualizar)
    return () => window.removeEventListener('carrinho-mudou', atualizar)
  }, [])

  useEffect(() => {
    let timer
    function aoReceberBump() {
      setBump(true)
      clearTimeout(timer)
      timer = setTimeout(() => setBump(false), 420)
    }
    window.addEventListener('carrinho-bump', aoReceberBump)
    return () => {
      window.removeEventListener('carrinho-bump', aoReceberBump)
      clearTimeout(timer)
    }
  }, [])

  if (deveEsconder(location.pathname)) return null

  return (
    <button
      onClick={() => navigate('/carrinho')}
      style={styles.botao}
      aria-label={`Meu carrinho, ${quantidade} ${quantidade === 1 ? 'produto' : 'produtos'}`}
    >
      <span
        id={ID_ALVO_CARRINHO}
        style={{
          ...styles.icone,
          animation: bump ? 'mersan-bump-carrinho 0.4s ease' : 'none'
        }}
      >
        🛒
        {quantidade > 0 && <span style={styles.badge}>{quantidade}</span>}
      </span>
      <span style={styles.texto}>Carrinho</span>
    </button>
  )
}

const styles = {
  botao: {
    position: 'fixed',
    right: '16px',
    bottom: '96px',
    zIndex: 28,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 18px 12px 14px',
    background: '#14141a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '999px',
    boxShadow: '0 4px 18px rgba(20,20,26,0.35)',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  icone: {
    position: 'relative',
    fontSize: '20px',
    lineHeight: 1,
    display: 'inline-flex'
  },
  badge: {
    position: 'absolute',
    top: '-9px',
    right: '-11px',
    background: '#e4002b',
    color: '#ffffff',
    borderRadius: '999px',
    minWidth: '18px',
    height: '18px',
    padding: '0 4px',
    fontSize: '11px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #14141a'
  },
  texto: {
    fontSize: '14px',
    fontWeight: 700
  }
}
