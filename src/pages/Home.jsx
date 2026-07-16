import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import SearchBar from '../components/SearchBar.jsx'

// Tela inicial: só a logo e a busca. Ao pesquisar, navega para a página
// própria do produto (/produto/:codigo) — é essa página que consulta a
// API, mostra o resultado e permite compartilhar (Etapa 4).
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
    gap: '32px'
  }
}
