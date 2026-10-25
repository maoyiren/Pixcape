'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return <button className="pixel-button cdpc-control" type="button" onClick={() => signOut({ callbackUrl: '/' })}>退出登录</button>
}
