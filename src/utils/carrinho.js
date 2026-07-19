// Carrinho de compras, guardado no navegador (localStorage).
// Cada item é { codigo, tamanho }. O tamanho começa vazio (null) e é
// escolhido depois, obrigatoriamente, na página do carrinho.

const CHAVE = 'mersan_carrinho'

export function listarCarrinho() {
  try {
    const bruto = localStorage.getItem(CHAVE)
    const lista = bruto ? JSON.parse(bruto) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

export function estaNoCarrinho(codigo) {
  return listarCarrinho().some((item) => item.codigo === codigo)
}

export function adicionarAoCarrinho(codigo, tamanho = null) {
  const lista = listarCarrinho()
  if (lista.some((item) => item.codigo === codigo)) return false
  const novaLista = [...lista, { codigo, tamanho }]
  localStorage.setItem(CHAVE, JSON.stringify(novaLista))
  window.dispatchEvent(new Event('carrinho-mudou'))
  return true
}

export function removerDoCarrinho(codigo) {
  const novaLista = listarCarrinho().filter((item) => item.codigo !== codigo)
  localStorage.setItem(CHAVE, JSON.stringify(novaLista))
  window.dispatchEvent(new Event('carrinho-mudou'))
}

export function definirTamanho(codigo, tamanho) {
  const novaLista = listarCarrinho().map((item) =>
    item.codigo === codigo ? { ...item, tamanho } : item
  )
  localStorage.setItem(CHAVE, JSON.stringify(novaLista))
  window.dispatchEvent(new Event('carrinho-mudou'))
}

export function limparCarrinho() {
  localStorage.removeItem(CHAVE)
  window.dispatchEvent(new Event('carrinho-mudou'))
}

export function contarCarrinho() {
  return listarCarrinho().length
}
