import {
  Auth,
  type HashAlgorithm,
  validatePasswordHistory,
  validatePersonalData,
} from '@nuvix/core/auth'
import { Doc, ID, Permission, Query, Role, type Session } from '@nuvix/db'
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors'
import type { Tokens, TokensDoc, UsersDoc } from '../../types/generated'
import { formatToken, type TokenView } from './formatter'
import { TokenType } from './sessions.service'

export interface CreateRecoveryInput {
  email: string
  url?: string
  ip?: string
  userAgent?: string
}

export interface UpdateRecoveryInput {
  userId: string
  secret: string
  password: string
}

export class AccountRecoveryService {
  constructor(private readonly session: Session) {}

  async createRecovery(input: CreateRecoveryInput): Promise<TokenView> {
    const email = input.email.toLowerCase()
    const user = (await this.session.findOne('users', [Query.equal('email', [email])])) as UsersDoc

    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    if (user.get('status') === false) {
      throw new ForbiddenError('User is blocked', { code: 'user_blocked' })
    }

    const secret = Auth.tokenGenerator(Auth.TOKEN_LENGTH_RECOVERY)
    const expire = new Date(Date.now() + Auth.TOKEN_EXPIRATION_RECOVERY * 1000)

    const tokenDoc = (await this.session.createDocument(
      'tokens',
      new Doc<Tokens>({
        $id: ID.unique(),
        $permissions: [
          Permission.read(Role.user(user.getId())),
          Permission.update(Role.user(user.getId())),
          Permission.delete(Role.user(user.getId())),
        ],
        userId: user.getId(),
        userInternalId: user.getSequence(),
        type: TokenType.RECOVERY,
        secret: Auth.hash(secret),
        expire,
        userAgent: input.userAgent ?? 'UNKNOWN',
        ip: input.ip ?? '127.0.0.1',
      }),
    )) as TokensDoc

    const formatted = formatToken(tokenDoc)
    formatted.secret = secret
    return formatted
  }

  async updateRecovery(input: UpdateRecoveryInput): Promise<TokenView> {
    const user = (await this.session.getDocument('users', input.userId)) as UsersDoc
    if (user.empty()) {
      throw new NotFoundError('User not found', { code: 'user_not_found' })
    }

    const tokens = (await this.session.find('tokens', [
      Query.equal('userId', [input.userId]),
      Query.equal('type', [TokenType.RECOVERY]),
    ])) as TokensDoc[]

    const verified = Auth.tokenVerify(tokens, TokenType.RECOVERY, input.secret)
    if (!verified) {
      throw new BadRequestError('Invalid token', { code: 'user_invalid_token' })
    }

    const validPersonal = validatePersonalData(input.password, {
      userId: user.getId(),
      email: user.get('email'),
      name: user.get('name'),
      phone: user.get('phone'),
    })
    if (!validPersonal) {
      throw new BadRequestError('Password must not include personal data', {
        code: 'user_password_personal_data',
      })
    }

    const history = (user.get('passwordHistory') ?? []) as string[]
    const validHistory = await validatePasswordHistory(
      input.password,
      history,
      (user.get('hash') as HashAlgorithm) ?? Auth.DEFAULT_ALGO,
    )
    if (!validHistory) {
      throw new BadRequestError('Password was recently used', {
        code: 'user_password_recently_used',
      })
    }

    const hashedPassword = await Auth.passwordHash(input.password, Auth.DEFAULT_ALGO)
    history.push(hashedPassword)
    if (history.length > 10) {
      history.splice(0, history.length - 10)
    }

    user.set('password', hashedPassword)
    user.set('passwordHistory', history)
    user.set('passwordUpdate', new Date())
    user.set('hash', Auth.DEFAULT_ALGO)
    user.set('hashOptions', Auth.DEFAULT_ALGO_OPTIONS)
    user.set('emailVerification', true)

    await this.session.updateDocument('users', user.getId(), user)
    await this.session.deleteDocument('tokens', verified.getId())

    const formatted = formatToken(verified as TokensDoc)
    formatted.secret = input.secret
    return formatted
  }
}
