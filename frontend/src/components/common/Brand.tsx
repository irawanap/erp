import { Layers2 } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand" aria-label="EMP People">
    <span className="brand-symbol"><Layers2 size={21} strokeWidth={1.7} /></span>
    {!compact && <span>EMP<span className="brand-accent">people</span><span className="brand-dot">.</span></span>}
  </span>
}
