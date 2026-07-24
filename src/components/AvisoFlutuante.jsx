import { useEffect } from 'react'

const DURACAO_MS = 4000

// Aviso rápido de "falta escolher algo", usado quando o cliente tenta
// finalizar/falar com o vendedor sem preencher tudo. Diferente do
// ToastCarrinho (sucesso, verde/preto): este é de atenção, vermelho, sem
// botões — só avisa o que falta e some sozinho.
export default function AvisoFlutuante({ mensagem, onFechar }) {
  useEffect(() => {
    if (!mensagem) return undefined
    const timer = setTimeout(onFechar, DURACAO_MS)
    return () => clearTimeout(timer)
  }, [mensagem, onFechar])

  if (!mensagem) return null

  return (
    <div style={styles.wrapper}>
      <div style={styles.cartao} role="status">
        <span style={styles.icone}>⚠️</span>
        <span style={styles.texto}>{mensagem}</span>
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
    zIndex: 55,
    padding: '0 12px',
    pointerEvents: 'none'
  },
  cartao: {
    pointerEvents: 'auto',
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#e4002b',
    color: '#ffffff',
    borderRadius: '14px',
    padding: '14px 16px',
    boxShadow: '0 8px 28px rgba(20,20,26,0.3)',
    animation: 'mersan-entrar-topo 0.28s ease',
    fontSize: '14px',
    fontWeight: 700
  },
  icone: {
    fontSize: '17px',
    flexShrink: 0
  },
  texto: {
    flex: 1,
    lineHeight: 1.35
  }
}
