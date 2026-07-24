import { Outlet } from 'react-router-dom'
import CarrinhoFlutuante from './components/CarrinhoFlutuante.jsx'
import ToastCarrinho from './components/ToastCarrinho.jsx'

// Casca da aplicação. Mantida propositalmente vazia/leve:
// o briefing pede interface extremamente limpa, sem telas desnecessárias.
// CarrinhoFlutuante e ToastCarrinho ficam montados uma vez só aqui, pra
// aparecerem em qualquer página sem precisar duplicar em cada uma.
export default function App() {
  return (
    <>
      <Outlet />
      <CarrinhoFlutuante />
      <ToastCarrinho />
    </>
  )
}
