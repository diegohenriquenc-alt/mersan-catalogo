// Modal usado sempre que o cliente está prestes a mandar para o WhatsApp
// SÓ o produto atual, sem passar pelo carrinho (ou com o carrinho tendo
// só 1 item). "Enviar somente este produto" é um link <a target="_blank">
// de verdade (não um window.open() disparado por script) — abrir nova aba
// por um clique real de link é sempre confiável no navegador, sem
// depender de heurística nenhuma de bloqueio de pop-up.
export default function ModalConfirmarEnvioUnico({ aberto, linkEnvio, onContinuarComprando, onEnviarMesmoAssim }) {
  if (!aberto) return null

  return (
    <div style={styles.overlay} onClick={onContinuarComprando}>
      <div style={styles.cartao} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <p style={styles.texto}>
          Você está enviando apenas um produto.
          <br />
          <br />
          Deseja continuar comprando para adicionar mais itens ao carrinho?
        </p>
        <div style={styles.botoes}>
          <button style={styles.botaoPrimario} onClick={onContinuarComprando}>
            Continuar comprando
          </button>
          <a
            href={linkEnvio}
            target="_blank"
            rel="noopener"
            onClick={onEnviarMesmoAssim}
            style={styles.botaoSecundario}
          >
            Enviar somente este produto
          </a>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,20,26,0.5)',
    zIndex: 60,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  cartao: {
    width: '100%',
    maxWidth: '480px',
    background: '#ffffff',
    borderRadius: '20px 20px 0 0',
    padding: '24px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
    boxShadow: '0 -8px 28px rgba(20,20,26,0.25)',
    animation: 'mersan-entrar-baixo 0.25s ease'
  },
  texto: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#14141a',
    lineHeight: 1.4,
    margin: '0 0 20px'
  },
  botoes: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  botaoPrimario: {
    width: '100%',
    padding: '16px',
    fontSize: '15.5px',
    fontWeight: 800,
    color: '#ffffff',
    background: '#e4002b',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer'
  },
  botaoSecundario: {
    display: 'block',
    width: '100%',
    padding: '16px',
    fontSize: '15.5px',
    fontWeight: 700,
    color: '#14141a',
    background: '#f2f2f3',
    border: 'none',
    borderRadius: '14px',
    cursor: 'pointer',
    textAlign: 'center',
    textDecoration: 'none',
    boxSizing: 'border-box'
  }
}
