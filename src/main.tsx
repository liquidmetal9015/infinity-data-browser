import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'
import App from './App.tsx'
import { DatabaseInitializer } from './components/DatabaseInitializer.tsx'

// Dev-only theme exploration: load alt palettes and honor ?theme=<name> /
// localStorage.themePreview. Production always renders dark.
if (import.meta.env.DEV) {
  await Promise.all([
    import('./themes/cyberpunk.css'),
    import('./themes/clean.css'),
  ])
  const allowed = new Set(['dark', 'cyberpunk', 'clean'])
  const fromUrl = new URLSearchParams(window.location.search).get('theme')
  const fromStorage = localStorage.getItem('themePreview')
  const next = (fromUrl && allowed.has(fromUrl) && fromUrl)
    || (fromStorage && allowed.has(fromStorage) && fromStorage)
    || 'dark'
  document.documentElement.dataset.theme = next
  if (fromUrl && allowed.has(fromUrl)) localStorage.setItem('themePreview', fromUrl)
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <DatabaseInitializer>
            <App />
          </DatabaseInitializer>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)

