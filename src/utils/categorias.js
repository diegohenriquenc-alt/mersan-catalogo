// Lista única das categorias "de verdade" (atribuídas por produto, seja
// pela planilha de gêneros ou manualmente pelo admin). "Promoção" NÃO
// entra aqui de propósito: é um filtro calculado na hora (a partir do
// preço promocional vindo da Mersan), nunca uma categoria gravada no
// produto — por isso só existe no menu da vitrine (Catalogo.jsx), não
// na lista de atribuição manual (Admin.jsx).
export const CATEGORIAS_PRODUTO = [
  'Feminino',
  'Masculino',
  'Esportivo Feminino',
  'Esportivo Masculino',
  'Chuteira',
  'Infantil Feminino',
  'Infantil Masculino'
]
