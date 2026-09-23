import type { TargetsDoc, UsersDoc } from '../../types/generated'
import { formatTarget, type TargetView } from '../users/formatter'

export interface AccountView {
  $id: string
  name: string
  email: string
  phone: string
  emailVerification: boolean
  phoneVerification: boolean
  status: boolean
  labels: string[]
  mfa: boolean
  prefs: Record<string, unknown>
  targets: TargetView[]
  accessedAt: string
  registration: string
  $createdAt?: string
  $updatedAt?: string
}

export function formatAccount(user: UsersDoc, targets: TargetsDoc[] = []): AccountView {
  const createdAt = user.get('$createdAt')
  const updatedAt = user.get('$updatedAt')

  return {
    $id: user.getId(),
    name: user.get('name') ?? '',
    email: user.get('email') ?? '',
    phone: user.get('phone') ?? '',
    emailVerification: Boolean(user.get('emailVerification')),
    phoneVerification: Boolean(user.get('phoneVerification')),
    status: Boolean(user.get('status') ?? true),
    labels: (user.get('labels') ?? []) as string[],
    mfa: Boolean(user.get('mfa')),
    prefs: (user.get('prefs') ?? {}) as Record<string, unknown>,
    targets: targets.map(formatTarget),
    accessedAt: String(user.get('accessedAt') ?? ''),
    registration: String(user.get('registration') ?? ''),
    $createdAt: createdAt ? String(createdAt) : undefined,
    $updatedAt: updatedAt ? String(updatedAt) : undefined,
  }
}
