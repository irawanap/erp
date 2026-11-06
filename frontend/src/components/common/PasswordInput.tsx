import { useState } from 'react'
import type { ComponentProps } from 'react'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'

export function PasswordInput(props: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false)
  return <div className="input-wrap">
    <LockKeyhole className="input-icon" size={17} aria-hidden="true" />
    <input {...props} type={visible ? 'text' : 'password'} className="text-input has-icon has-action" />
    <button type="button" className="input-action" aria-label={visible ? 'Sembunyikan password' : 'Tampilkan password'}
      aria-pressed={visible} onClick={() => setVisible(!visible)}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div>
}
