// Efeitos visuais de "adicionar ao carrinho": a animação de voar até o
// ícone flutuante e o disparo do toast de confirmação. Fica separado de
// carrinho.js de propósito — aquele arquivo é só dado (sessionStorage),
// este aqui é só efeito colateral visual, sem nenhuma regra de negócio.

const ID_ALVO_CARRINHO = 'mersan-carrinho-flutuante-alvo'

function prefereMovimentoReduzido() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Anima um "🛒" saindo do botão clicado até o ícone do carrinho flutuante.
// Se o alvo não existir na tela (ex: página ainda carregando) ou o
// navegador preferir menos movimento, não faz nada — a falha aqui nunca
// pode impedir o produto de já ter sido adicionado ao carrinho.
export function voarParaCarrinho(elementoOrigem) {
  try {
    if (prefereMovimentoReduzido()) return
    const alvo = document.getElementById(ID_ALVO_CARRINHO)
    if (!elementoOrigem || !alvo || typeof elementoOrigem.getBoundingClientRect !== 'function') return

    const rectOrigem = elementoOrigem.getBoundingClientRect()
    const rectAlvo = alvo.getBoundingClientRect()

    const bola = document.createElement('div')
    bola.textContent = '🛒'
    bola.setAttribute('aria-hidden', 'true')
    Object.assign(bola.style, {
      position: 'fixed',
      left: `${rectOrigem.left + rectOrigem.width / 2 - 14}px`,
      top: `${rectOrigem.top + rectOrigem.height / 2 - 14}px`,
      width: '28px',
      height: '28px',
      fontSize: '20px',
      lineHeight: '28px',
      textAlign: 'center',
      zIndex: 9999,
      pointerEvents: 'none',
      willChange: 'transform, opacity'
    })
    document.body.appendChild(bola)

    const deltaX = (rectAlvo.left + rectAlvo.width / 2) - (rectOrigem.left + rectOrigem.width / 2)
    const deltaY = (rectAlvo.top + rectAlvo.height / 2) - (rectOrigem.top + rectOrigem.height / 2)

    const remover = () => bola.remove()

    if (typeof bola.animate === 'function') {
      const animacao = bola.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${deltaX * 0.55}px, ${deltaY - 36}px) scale(0.85)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${deltaX}px, ${deltaY}px) scale(0.3)`, opacity: 0.15 }
        ],
        { duration: 550, easing: 'cubic-bezier(0.35, 0, 0.25, 1)' }
      )
      animacao.onfinish = () => {
        remover()
        window.dispatchEvent(new Event('carrinho-bump'))
      }
      // Rede de segurança: se onfinish não disparar por algum motivo, o
      // elemento não pode ficar preso na tela para sempre.
      setTimeout(remover, 900)
    } else {
      // Navegador sem Web Animations API: some sem animação, sem travar nada.
      remover()
      window.dispatchEvent(new Event('carrinho-bump'))
    }
  } catch {
    // Efeito puramente decorativo — qualquer erro aqui é ignorado.
  }
}

// Avisa o toast global (montado uma vez em App.jsx) que um produto acabou
// de ser adicionado, para ele se mostrar com as opções de continuar
// comprando ou ver o carrinho.
export function dispararToastCarrinho() {
  window.dispatchEvent(new Event('carrinho-adicionado'))
}

export { ID_ALVO_CARRINHO }
