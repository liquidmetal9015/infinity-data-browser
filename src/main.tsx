import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DatabaseProvider } from './context/DatabaseContext.tsx'
import { ListProvider } from './context/ListContext.tsx'
import { WorkspaceProvider } from './context/WorkspaceContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DatabaseProvider>
      <WorkspaceProvider>
        <ListProvider>
          <App />
        </ListProvider>
      </WorkspaceProvider>
    </DatabaseProvider>
  </StrictMode>,
)

