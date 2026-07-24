// Confirmação mostrada assim que o pedido é disparado pro vendedor
// (WhatsApp abre em paralelo, numa aba/app separado — este card fica na
// tela mesmo se o cliente fechar o seletor do WhatsApp sem escolher nada).
export default function ConfirmacaoPedidoEnviado({ aberto, nomeVendedor, onFechar }) {
  if (!aberto) return null

  return (
    <div style={styles.overlay} onClick={onFechar}>
      <div style={styles.cartao} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div style={styles.iconeCirculo}>
          <span style={styles.icone}>✓</span>
        </div>
        <h2 style={styles.titulo}>Pedido Enviado!</h2>
        <p style={styles.texto}>
          Seu pedido foi enviado para {nomeVendedor || 'o vendedor'}. Em breve ele entrará em contato!
        </p>
        <button style={styles.botao} onClick={onFechar}>
          Ótimo!
        </button>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,20,26,0.5)',
    zIndex: 65,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  cartao: {
    width: '100%',
    maxWidth: '360px',
    background: '#ffffff',
    borderRadius: '20px',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    boxShadow: '0 12px 40px rgba(20,20,26,0.3)',
    animation: 'mersan-entrar-baixo 0.25s ease'
  },
  iconeCirculo: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: '#0a7d3a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '18px'
  },
  icone: {
    fontSize: '32px',
    color: '#ffffff',
    fontWeight: 900,
    lineHeight: 1
  },
  titulo: {
    fontSize: '21px',
    fontWeight: 800,
    color: '#14141a',
    margin: '0 0 10px'
  },
  texto: {
    fontSize: '14.5px',
    color: '#6b6b6b',
    lineHeight: 1.45,
    margin: '0 0 24px'
  },
  botao: {
    width: '100%',
    padding: '15px',
    fontSize: '15.5px',
    fontWeight: 800,
    color: '#ffffff',
    background: '#0a7d3a',
    border: 'none',
    borderRadius: '999px',
    cursor: 'pointer'
  }
}
