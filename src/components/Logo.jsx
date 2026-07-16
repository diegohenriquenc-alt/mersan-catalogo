// Placeholder textual até a logo oficial (arquivo/imagem) ser adicionada em src/assets.
// Basta trocar este componente por um <img src={logo} /> quando o arquivo existir.
export default function Logo() {
  return (
    <div style={styles.wrapper}>
      <span style={styles.mark}>MERSAN</span>
      <span style={styles.sub}>CALÇADOS</span>
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    userSelect: 'none'
  },
  mark: {
    fontSize: '28px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    color: '#111111'
  },
  sub: {
    fontSize: '12px',
    fontWeight: 500,
    letterSpacing: '0.2em',
    color: '#6b6b6b'
  }
}
