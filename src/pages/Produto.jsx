import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import ProductResult from '../components/ProductResult.jsx'
import ApiService from '../services/api.js'

export default function Produto() {
  const { codigo } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [produto, setProduto] = useState(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let cancelado = false

    setLoading(true)
    setError(null)
    setProduto(null)

    ApiService.buscarProduto(codigo)
      .then((data) => {
        if (!cancelado) setProduto(data)
      })
      .catch((err) => {
        if (!cancelado) setError(err.message || 'Não foi possível consultar o produto.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [codigo])

  const urlProduto = typeof window !== 'undefined' ? window.location.href : ''
  const mensagemWhatsApp = produto
    ? `Mersan Calçados • Loja 261\n${produto.nome}\n${urlProduto}`
    : ''

  async function handleCompartilhar() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: produto?.nome || 'Mersan Calçados',
          text: 'Mersan Calçados • Loja 261',
          url: urlProduto
        })
      } catch {
        // Pessoa cancelou o compartilhamento — não faz nada.
      }
    } else {
      handleCopiarLink()
    }
  }

  async function handleCopiarLink() {
    try {
      await navigator.clipboard.writeText(urlProduto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sem permissão de clipboard — sem problema, a pessoa pode copiar da barra de endereço.
    }
  }

  function handleWhatsApp() {
    const link = `https://wa.me/?text=${encodeURIComponent(mensagemWhatsApp)}`
    window.open(link, '_blank')
  }

  return (
    <main style={styles.main}>
      <div style={styles.content}>
        <Logo />

        {loading && <p style={styles.status}>Consultando…</p>}
        {error && <p style={styles.error}>{error}</p>}

        {produto && (
          <>
            <ProductResult produto={produto} />

            <div style={styles.botoes}>
              <button onClick={handleCompartilhar} style={styles.botaoPrimario}>
                Compartilhar
              </button>
              <button onClick={handleWhatsApp} style={styles.botaoWhatsApp}>
                Enviar para WhatsApp
              </button>
              <button onClick={handleCopiarLink} style={styles.botaoSecundario}>
                {copiado ? 'Link copiado!' : 'Copiar link'}
              </button>
              <Link to="/" style={styles.botaoVoltar}>
                Voltar
              </Link>
            </div>
          </>
        )}

        {!loading && !produto && !error && (
          <Link to="/" style={styles.botaoVoltar}>
            Voltar para a busca
          </Link>
        )}
      </div>
    </main>
  )
}

const styles = {
  main: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  content: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px'
  },
  status: {
    fontSize: '14px',
    color: '#6b6b6b'
  },
  error: {
    color: '#d92d20',
    fontSize: '14px',
    textAlign: 'center',
    maxWidth: '480px'
  },
  botoes: {
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  botaoPrimario: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#0057ff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  botaoWhatsApp: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#25D366',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  botaoSecundario: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: 700,
    color: '#111111',
    background: '#f2f2f2',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  botaoVoltar: {
    padding: '14px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#6b6b6b',
    textAlign: 'center',
    textDecoration: 'none'
  }
}
