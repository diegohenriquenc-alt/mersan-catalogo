import Logo from '../components/Logo.jsx'
import SearchBar from '../components/SearchBar.jsx'
import ProductResult from '../components/ProductResult.jsx'
import { useProductSearch } from '../hooks/useProductSearch.js'

export default function Home() {
  const { search, loading, error, resultado } = useProductSearch()

  return (
    <main style={styles.main}>
      <div style={styles.content}>
        <Logo />
        <SearchBar onSearch={search} loading={loading} />

        {error && <p style={styles.error}>{error}</p>}

        {resultado && <ProductResult produto={resultado} />}
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
  },
  error: {
    color: '#d92d20',
    fontSize: '14px',
    textAlign: 'center',
    maxWidth: '480px'
  }
}
