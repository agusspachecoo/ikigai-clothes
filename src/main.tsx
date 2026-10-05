import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'
import { FavoritosProvider } from './context/FavoritosContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <FavoritosProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </FavoritosProvider>
    </AuthProvider>
  </StrictMode>,
)
