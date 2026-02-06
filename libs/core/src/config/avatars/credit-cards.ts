import * as path from 'node:path'
import { PROJECT_ROOT } from '@nuvix/utils'

const assetsPath = path.resolve(PROJECT_ROOT, 'assets/avatars/credit-cards')

export const creditCards = {
  amex: { name: 'American Express', path: `${assetsPath}/amex.png` },
  argencard: { name: 'Argencard', path: `${assetsPath}/argencard.png` },
  cabal: { name: 'Cabal', path: `${assetsPath}/cabal.png` },
  cencosud: { name: 'Cencosud', path: `${assetsPath}/cencosud.png` },
  diners: { name: 'Diners Club', path: `${assetsPath}/diners.png` },
  discover: { name: 'Discover', path: `${assetsPath}/discover.png` },
  elo: { name: 'Elo', path: `${assetsPath}/elo.png` },
  hipercard: { name: 'Hipercard', path: `${assetsPath}/hipercard.png` },
  jcb: { name: 'JCB', path: `${assetsPath}/jcb.png` },
  mastercard: { name: 'Mastercard', path: `${assetsPath}/mastercard.png` },
  naranja: { name: 'Naranja', path: `${assetsPath}/naranja.png` },
  'targeta-shopping': {
    name: 'Tarjeta Shopping',
    path: `${assetsPath}/tarjeta-shopping.png`,
  },
  'union-china-pay': {
    name: 'Union China Pay',
    path: `${assetsPath}/union-china-pay.png`,
  },
  visa: { name: 'Visa', path: `${assetsPath}/visa.png` },
  mir: { name: 'MIR', path: `${assetsPath}/mir.png` },
  maestro: { name: 'Maestro', path: `${assetsPath}/maestro.png` },
  rupay: { name: 'Rupay', path: `${assetsPath}/rupay.png` },
}
