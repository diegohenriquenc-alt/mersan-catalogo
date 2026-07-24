import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const DURACAO_MS = 4500

// Toast global de "produto adicionado ao carrinho". Fica escondido até
// alguém disparar o evento 'carrinho-adicionado' (ver utils/carrinhoUI.js).
// Não bloqueia o resto da tela — só o próprio cartão é clicável.
export default function ToastCarrinho() {
  const [visivel, setVisivel] = useState(false)
  const navigate = useNavigate()
  const timerRef = useRef(null)

  useEffect(() => {
    function mostrar() {
      setVisivel(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setVisivel(false), DURACAO_MS)
    }
    window.addEventListener('carrinho-adicionado', mostrar)
    return () => {
      window.removeEventListener('carrinho-adicionado', mostrar)
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!visivel) return null

  return (
    <div style={styles.wrapper}>
      <div style={styles.cartao} role="status">
        <span style={styles.mensagem}>✅ Produto adicionado ao carrinho</span>
        <div style={styles.acoes}>
          <button style={styles.botaoSecundario} onClick={() => setVisivel(false)}>
            Continuar comprando
          </button>
          <button
            style={styles.botaoPrimario}
            onClick={() => {
              setVisivel(false)
              navigate('/carrinho')
            }}
          >
            Ver carrinho
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    position: 'fixed',
    top: '14px',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    zIndex: 50,
    padding: '0 12px',
    pointerEvents: 'none'
  },
  cartao: {
    pointerEvents: 'auto',
    width: '100%',
    maxWidth: '420px',
    background: '#14141a',
    color: '#ffffff',
    borderRadius: '16px',
    padding: '14px 16px',
    boxShadow: '0 8px 28px rgba(20,20,26,0.35)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    animation: 'mersan-entrar-topo 0.28s ease'
  },
  mensagem: {
    fontSize: '14.5px',
    fontWeight: 700
  },
  acoes: {
    display: 'flex',
    gap: '8px'
  },
  botaoSecundario: {
    flex: 1,
    background: 'rgba(255,255,255,0.12)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '11px 10px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  botaoPrimario: {
    flex: 1,
    background: '#e4002b',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '11px 10px',
    fontSize: '13px',
    fontWeight: 800,
    cursor: 'pointer'
  }
}
