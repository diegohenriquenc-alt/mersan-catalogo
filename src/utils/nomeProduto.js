// O tamanho é uma variante escolhida pelo cliente, não faz parte do nome do
// produto — por isso nunca deve aparecer no título/nome exibido, só no
// campo "Tamanho" (seleção de tamanho, carrinho, seleção do cliente,
// mensagem do WhatsApp). Esta função só limpa o texto exibido nas telas;
// os dados originais (banco, API, agrupamento, estoque) não são alterados.
//
// Remove o número do calçado que às vezes vem "colado" no final do nome
// vindo da Mersan (ex: "TENIS REEBOK RF 100201946 PRETO. 42" -> "...
// PRETO"). Funciona para qualquer numeração de 2 a 3 dígitos no final
// (34 a 44 ou qualquer outra), independente do tamanho específico daquele
// item.
export function limparNomeProduto(nome) {
  if (!nome) return ''
  return nome.replace(/\.?\s*\d{2,3}$/, '').trim() || nome
}
