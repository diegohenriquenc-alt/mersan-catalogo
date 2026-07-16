// Proxy serverless: GET /api/produto?termo=...
//
// AINDA NÃO CONECTADO A UM ENDPOINT REAL.
// A Mersan ainda não nos passou o endpoint que retorna nome, cor e preço
// do produto (só temos o de estoque, em estoque.js).
//
// Quando esse endpoint existir, o padrão é o mesmo do estoque.js:
// buscar na Mersan, filtrar/mapear o formato que o front espera, cachear
// por 30 min com a Cache API, e devolver JSON.
//
// Por enquanto devolve 501 (Não implementado) de forma explícita, para que
// o front (services/api.js) saiba tratar isso e cair no modo "somente estoque".

export async function onRequestGet(context) {
  const url = new URL(context.request.url)
  const termo = url.searchParams.get('termo')

  return new Response(
    JSON.stringify({
      error: 'Endpoint de dados do produto ainda não configurado.',
      termoConsultado: termo
    }),
    {
      status: 501,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  )
}
