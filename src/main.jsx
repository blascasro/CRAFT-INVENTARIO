import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import './index.css'

// ─── Supabase auth callback ───────────────────────────────────────────────────
// Magic links y password-reset redirigen con #access_token=… en el hash.
// Si el path no es "/", el catch-all de React Router navegaría a "/" y
// eliminaría el hash ANTES de que el cliente de Supabase (async) lo lea.
// Normalizamos a "/" preservando el hash, en forma SINCRÓNICA antes de que
// React renderice y React Router inicialice su historial.
if (window.location.hash.includes('access_token=')) {
  window.history.replaceState(null, '', '/' + window.location.hash)
}
// ─────────────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
