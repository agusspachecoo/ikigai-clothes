import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CartProvider } from './context/CartContext'
import { AuthProvider } from './context/AuthContext'
import { FavoritosProvider } from './context/FavoritosContext'
import { instalarFallbackGlobalImagenes } from './lib/fallbackImagenes'

instalarFallbackGlobalImagenes()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <FavoritosProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </FavoritosProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
