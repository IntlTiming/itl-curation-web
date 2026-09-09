import { useEffect, useState } from 'react'

type HealthResponse = {
  status: string
  db: boolean
}

function App() {
  const [health, setHealth] = useState<HealthResponse | 'loading' | 'error'>('loading')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: HealthResponse) => setHealth(data))
      .catch(() => setHealth('error'))
  }, [])

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>ITL Curation Web</h1>
      <p>
        API health:{' '}
        {health === 'loading'
          ? 'checking…'
          : health === 'error'
            ? 'unreachable'
            : `${health.status} (db: ${health.db ? 'connected' : 'unreachable'})`}
      </p>
    </main>
  )
}

export default App
