import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Hide the loading screen once React is ready
const hideLoader = () => {
  const loader = document.getElementById('app-loader')
  if (loader) {
    loader.classList.add('hidden')
    // Remove from DOM after fade out
    setTimeout(() => {
      loader.remove()
    }, 300)
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Hide loader after a short delay to ensure app is rendered
setTimeout(hideLoader, 100)
