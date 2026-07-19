import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Admin from './pages/Admin.jsx'
import Produto from './pages/Produto.jsx'
import Catalogo from './pages/Catalogo.jsx'
import Favoritos from './pages/Favoritos.jsx'
import Carrinho from './pages/Carrinho.jsx'
import Selecao from './pages/Selecao.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Catalogo />} />
          <Route path="admin" element={<Admin />} />
          <Route path="produto/:codigo" element={<Produto />} />
          <Route path="carrinho" element={<Carrinho />} />
          <Route path="selecao/:id" element={<Selecao />} />
          <Route path="carrinho" element={<Carrinho />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
