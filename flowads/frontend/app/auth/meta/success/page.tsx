'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function MetaSuccessInner() {
  const searchParams = useSearchParams()
  const errorMsg = searchParams.get('error')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (errorMsg) {
      setStatus('error')
      // Notify opener of error too
      if (window.opener) {
        window.opener.postMessage({ type: 'meta_error', error: errorMsg }, '*')
      }
      return
    }

    setStatus('success')
    if (window.opener) {
      const clientId = searchParams.get('client_id')
      window.opener.postMessage({ type: 'meta_connected', client_id: clientId }, '*')
      setTimeout(() => window.close(), 1500)
    }
  }, [errorMsg])

  if (status === 'error') {
    return (
      <div style={styles.container}>
        <div style={{ fontSize: 48 }}>❌</div>
        <h2 style={{ margin: 0, color: '#f87171' }}>Erro ao conectar Meta</h2>
        <p style={{ color: '#888', margin: 0, textAlign: 'center', maxWidth: 400, fontSize: 14 }}>{errorMsg}</p>
        <p style={{ color: '#555', margin: 0, fontSize: 12 }}>Pode fechar esta janela e tentar novamente.</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={{ fontSize: 48 }}>✅</div>
      <h2 style={{ margin: 0 }}>Meta conectado com sucesso!</h2>
      <p style={{ color: '#888', margin: 0 }}>Esta janela fechará automaticamente...</p>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: '100vh',
    background: '#0f0f0f',
    color: '#fff',
    fontFamily: 'sans-serif',
    gap: '12px',
  }
}

export default function MetaSuccessPage() {
  return (
    <Suspense>
      <MetaSuccessInner />
    </Suspense>
  )
}
