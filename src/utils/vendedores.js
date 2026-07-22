// Cada vendedor recebe uma cor fixa e diferente, pra chamar mais atenção nos
// botões de escolha. A mesma paleta é usada na página do produto e no carrinho.
export const PALETA_VENDEDORES = ['#e4002b', '#0a7cff', '#0f9d58', '#f4a300', '#7b2ff7', '#00b8a9', '#ff6f3c', '#c2185b']

export function corVendedor(id) {
  let hash = 0
  for (let i = 0; i < String(id).length; i++) hash = (hash * 31 + String(id).charCodeAt(i)) >>> 0
  return PALETA_VENDEDORES[hash % PALETA_VENDEDORES.length]
}

// PRNG determinístico (mulberry32) — mesma semente sempre gera a mesma
// sequência, então todos os clientes veem a mesma ordem dentro da mesma hora.
function mulberry32(seed) {
  let t = seed
  return function () {
    t |= 0
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// Embaralha a lista de vendedores com uma ordem que muda automaticamente a
// cada hora (Fisher-Yates com semente derivada da hora atual), dando a todos
// a mesma chance de aparecer em qualquer posição. A ordem fica fixa durante
// a hora e não depende de qual vendedor o cliente já escolheu (isso é
// controlado à parte, por id, em cada tela).
export function ordenarVendedoresPorHora(lista) {
  if (!Array.isArray(lista) || lista.length <= 1) return lista
  const horaAtual = Math.floor(Date.now() / 3600000)
  const random = mulberry32(horaAtual)
  const embaralhada = [...lista]
  for (let i = embaralhada.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[embaralhada[i], embaralhada[j]] = [embaralhada[j], embaralhada[i]]
  }
  return embaralhada
}
