'use client'

import { useEffect } from 'react'

export default function MetaSuccessPage() {
  useEffect(() => {
    // Notify opener window and close popup
    if (window.opener) {
      window.opener.postMessage({ type: 'meta_connected' }, '*')
      window.close()
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0f0f0f',
      color: '#fff',
      fontFamily: 'sans-serif',
      gap: '12px',
    }}>
      <div style={{ fontSize: 48 }}>✅</div>
      <h2 style={{ margin: 0 }}>Meta conectado com sucesso!</h2>
      <p style={{ color: '#888', margin: 0 }}>Esta janela fechará automaticamente...</p>
    </div>
  )
}
