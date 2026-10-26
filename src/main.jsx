import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { StrokeOrderProvider } from './context/StrokeOrderContext.jsx'
import { applyTheme, watchSystemTheme } from './utils/theme'
import './index.css'
import './App.css'

// Before the first render, so the page never flashes the wrong palette.
applyTheme()
watchSystemTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <StrokeOrderProvider>
        <App />
      </StrokeOrderProvider>
    </AuthProvider>
  </React.StrictMode>,
)
