import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DatabaseInitializer } from './components/DatabaseInitializer.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DatabaseInitializer>
      <App />
    </DatabaseInitializer>
  </StrictMode>,
)

