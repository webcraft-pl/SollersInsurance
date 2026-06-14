import { useState } from 'react'

interface Props {
  onSave: (key: string) => void
  onClose: () => void
}

export default function ApiBanner({ onSave, onClose }: Props) {
  const [key, setKey] = useState('')

  return (
    <div className="api-banner">
      <i className="ti ti-robot" />
      <span>Podaj klucz Anthropic API, aby aktywować funkcje AI (flood check, rekomendacje pakietów):</span>
      <input
        type="password"
        placeholder="sk-ant-..."
        value={key}
        onChange={e => setKey(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && key && onSave(key)}
      />
      <button onClick={() => key && onSave(key)}>Aktywuj AI</button>
      <button
        onClick={onClose}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--info-t)', marginLeft: 4 }}
      >
        <i className="ti ti-x" />
      </button>
    </div>
  )
}
