'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { SignOutButton } from '@/app/account/sign-out-button'

type AccountMenuProps = {
  name: string
  email: string
  role: string
  status: string
}

const roleLabels: Record<string, string> = {
  USER: '普通账户',
  CREATOR: '创作者',
  ADMIN: '管理员',
}

function initials(name: string) {
  const value = name.trim()
  if (!value) return '我'
  return Array.from(value).slice(0, 1).join('').toUpperCase()
}

export function AccountMenu({ name, email, role, status }: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [])

  return (
    <div
      ref={menuRef}
      className="site-account-menu"
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setOpen(true) }}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') setOpen(false) }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          setOpen(false)
          triggerRef.current?.focus()
        }
      }}
    >
      <button
        ref={triggerRef}
        className="site-account-trigger"
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="site-account-dropdown"
        onClick={() => setOpen(true)}
      >
        <span className="site-nav-avatar" aria-hidden="true">{initials(name)}</span>
        <span className="site-account-trigger-copy">
          <strong>{name || '我的账户'}</strong>
          <small>{roleLabels[role] ?? 'CDPC 账户'}</small>
        </span>
        <span className="site-account-chevron" aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className="site-account-dropdown" id="site-account-dropdown">
          <div className="site-account-summary">
            <span className="site-nav-avatar site-account-avatar-large" aria-hidden="true">{initials(name)}</span>
            <span className="site-account-identity">
              <strong>{name || 'CDPC 用户'}</strong>
              <small>{email}</small>
              <small className="site-account-status">{status === 'ACTIVE' ? '● 账户正常' : '● 账户状态待确认'}</small>
            </span>
          </div>
          <div className="site-account-links">
            <Link href="/account" onClick={() => setOpen(false)}>账户资料<span>›</span></Link>
            <Link href="/wardrobe" onClick={() => setOpen(false)}>我的衣橱<span>›</span></Link>
            <Link href="/creator" onClick={() => setOpen(false)}>创作者中心<span>›</span></Link>
          </div>
          <div className="site-account-logout"><SignOutButton /></div>
        </div>
      ) : null}
    </div>
  )
}
