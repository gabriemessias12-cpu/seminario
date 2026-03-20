import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installApiFetchInterceptor } from './lib/api'
import './index.css'

installApiFetchInterceptor()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
