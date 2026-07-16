import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Home from './pages/Home.jsx'
import Admin from './pages/Admin.jsx'
import Produto from './pages/Produto.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="admin" element={<Admin />} />
          <Route path="produto/:codigo" element={<Produto />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
