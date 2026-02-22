import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DatabaseProvider } from './context/DatabaseContext.tsx'
import { WorkspaceProvider } from './context/WorkspaceContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DatabaseProvider>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </DatabaseProvider>
  </StrictMode>,
)

