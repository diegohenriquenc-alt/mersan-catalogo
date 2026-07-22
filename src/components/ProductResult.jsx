import { limparNomeProduto } from '../utils/nomeProduto.js'

const IMAGEM_PADRAO = '/icons/icon-512.svg' // trocado pelo sistema próprio de fotos na Etapa 3

export default function ProductResult({ produto, ocultarEstoque = false }) {
  const { nome, referencia, cor, preco, foto, estoque, loja } = produto
  const nomeExibido = limparNomeProduto(nome)

  const semEstoque = !estoque || estoque.length === 0

  return (
    <div style={styles.card}>
      <img
        src={foto || IMAGEM_PADRAO}
        alt={nomeExibido || referencia}
        style={styles.foto}
        onError={(e) => {
          e.currentTarget.onerror = null
          e.currentTarget.src = IMAGEM_PADRAO
        }}
      />

      <div style={styles.info}>
        <h1 style={styles.nome}>{nomeExibido || 'Produto'}</h1>
        <p style={styles.linha}>Ref: {referencia}</p>
        {cor && <p style={styles.linha}>Cor: {cor}</p>}
        {preco != null && (
          <p style={styles.preco}>
            {preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        )}
      </div>

      {!ocultarEstoque && (
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
      )}
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
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#111111',
    margin: '0 0 8px',
    textAlign: 'center'
  },
  lista: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center'
  },
  item: {
    fontSize: '14px',
    fontWeight: 600,
    background: '#f2f6ff',
    color: '#0057ff',
    borderRadius: '999px',
    padding: '6px 14px'
  },
  semEstoque: {
    fontSize: '14px',
    color: '#6b6b6b',
    textAlign: 'center',
    margin: 0
  }
}
