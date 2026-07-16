import { useNavigate, Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import SearchBar from '../components/SearchBar.jsx'

// Tela inicial: logo, busca, e um link para a vitrine completa (onde o
// cliente pode navegar por todos os produtos com foto, sem precisar saber
// nenhum código).
export default function Home() {
  const navigate = useNavigate()

  function handleSearch(termo) {
    navigate(`/produto/${encodeURIComponent(termo)}`)
  }

  return (
    <main style={styles.main}>
      <div style={styles.content}>
        <Logo />
        <SearchBar onSearch={handleSearch} loading={false} />
        <Link to="/catalogo" style={styles.link}>
          Ver vitrine completa
        </Link>
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
    gap: '20px'
  },
  link: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0057ff',
    textDecoration: 'none'
  }
}
