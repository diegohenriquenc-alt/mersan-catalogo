const IMAGEM_PADRAO = '/icons/icon-512.svg' // trocado pelo sistema próprio de fotos na Etapa 3

export default function ProductResult({ produto }) {
  const { nome, referencia, cor, preco, foto, estoque, loja } = produto

  const semEstoque = !estoque || estoque.length === 0

  return (
    <div style={styles.card}>
      <img
        src={foto || IMAGEM_PADRAO}
        alt={nome || referencia}
        style={styles.foto}
        onError={(e) => {
          e.currentTarget.onerror = null
          e.currentTarget.src = IMAGEM_PADRAO
        }}
      />

      <div style={styles.info}>
        <h1 style={styles.nome}>{nome || 'Produto'}</h1>
        <p style={styles.linha}>Ref: {referencia}</p>
        {cor && <p style={styles.linha}>Cor: {cor}</p>}
        {preco != null && (
          <p style={styles.preco}>
            {preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        )}
      </div>

      <div style={styles.estoqueBox}>
        <h2 style={styles.estoqueTitulo}>Estoque Loja {loja}</h2>
        {semEstoque ? (
          <p style={styles.semEstoque}>Sem estoque nesta loja.</p>
        ) : (
          <ul style={styles.lista}>
            {estoque.map((item) => (
              <li key={item.tamanho} style={styles.item}>
                {item.tamanho} • {item.pares} {item.pares === 1 ? 'par' : 'pares'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const styles = {
  card: {
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    border: '1px solid #e6e6e6',
    borderRadius: '16px',
    padding: '20px'
  },
  foto: {
    width: '160px',
    height: '160px',
    objectFit: 'contain',
    borderRadius: '12px',
    background: '#fafafa'
  },
  info: {
    textAlign: 'center'
  },
  nome: {
    fontSize: '18px',
    fontWeight: 700,
    margin: '0 0 4px'
  },
  linha: {
    fontSize: '14px',
    color: '#6b6b6b',
    margin: '2px 0'
  },
  preco: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#111111',
    margin: '8px 0 0'
  },
  estoqueBox: {
    width: '100%',
    borderTop: '1px solid #e6e6e6',
    paddingTop: '16px'
  },
  estoqueTitulo: {
    fontSize: '13px',
