import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Aplicamos el tema guardado ANTES de renderizar, para que no haya parpadeo de claro a oscuro.
// Se hace una sola vez al cargar la app, asi el tema vale en todas las paginas.
if (localStorage.getItem('tema') === 'oscuro') {
  document.documentElement.setAttribute('data-theme', 'dark')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
