import { useRef, useState } from 'react'

/**
 * Campo único de busca da tela inicial.
 * - Sem botão "Pesquisar" (conforme briefing).
 * - Leitores de código de barras enviam o texto seguido de Enter,
 *   então tratar a tecla Enter cobre tanto digitação manual quanto bipagem.
 */
export default function SearchBar({ onSearch, loading }) {
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  function handleKeyDown(e) {
    if (e.key === 'Enter' && value.trim().length > 0) {
      onSearch(value.trim())
    }
  }

  return (
    <div style={styles.container}>
      <input
        ref={inputRef}
        type="text"
        inputMode="search"
        autoFocus
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Código de barras, referência ou nome"
        style={styles.input}
        aria-label="Código de barras, referência ou nome"
      />
      {loading && <span style={styles.status}>Consultando…</span>}
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  input: {
    width: '100%',
    padding: '16px 18px',
    fontSize: '17px',
    borderRadius: '12px',
    border: '1px solid #e6e6e6',
    outline: 'none',
    color: '#111111',
    background: '#ffffff'
  },
  status: {
    fontSize: '13px',
    color: '#6b6b6b',
    textAlign: 'center'
  }
}
