// Favoritos do cliente, guardados no próprio navegador (sessionStorage).
// Cada favorito é o código do produto; não depende do servidor.

const CHAVE = 'mersan_favoritos'

export function listarFavoritos() {
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    const lista = bruto ? JSON.parse(bruto) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

export function ehFavorito(codigo) {
  return listarFavoritos().includes(codigo)
}

export function alternarFavorito(codigo) {
  const lista = listarFavoritos()
  const jaTem = lista.includes(codigo)
  const novaLista = jaTem ? lista.filter((c) => c !== codigo) : [...lista, codigo]
  sessionStorage.setItem(CHAVE, JSON.stringify(novaLista))
  window.dispatchEvent(new Event('favoritos-mudaram'))
  return !jaTem
}

export function removerFavorito(codigo) {
  const novaLista = listarFavoritos().filter((c) => c !== codigo)
  sessionStorage.setItem(CHAVE, JSON.stringify(novaLista))
  window.dispatchEvent(new Event('favoritos-mudaram'))
}

export function contarFavoritos() {
  return listarFavoritos().length
}
