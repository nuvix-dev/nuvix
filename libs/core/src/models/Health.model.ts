import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class HealthAntivirusModel extends BaseModel {
  @Expose() version = ''
  @Expose() status = ''

  constructor(partial: Partial<HealthAntivirusModel>) {
    super()
    Object.assign(this, partial)
  }

  getName(): string {
    return 'Health Antivirus'
  }
}

@Exclude()
export class HealthCertificateModel extends BaseModel {
  @Expose() name = ''
  @Expose() subjectSN = 'www.google.com'
  @Expose() issuerOrganisation = 'Google Trust Services LLC'
  @Expose() validFrom = ''
  @Expose() validTo = ''
  @Expose() signatureTypeSN = ''

  constructor(partial: Partial<HealthCertificateModel>) {
    super()
    Object.assign(this, partial)
  }

  getName(): string {
    return 'Health Certificate'
  }
}

@Exclude()
export class HealthQueueModel extends BaseModel {
  @Expose() size = 0

  constructor(partial: Partial<HealthQueueModel>) {
    super()
    Object.assign(this, partial)
  }

  getName(): string {
    return 'Health Queue'
  }
}

@Exclude()
export class HealthStatusModel extends BaseModel {
  @Expose() name = ''
  @Expose() ping = 0
  @Expose() status = ''

  constructor(partial: Partial<HealthStatusModel>) {
    super()
    Object.assign(this, partial)
  }

  getName(): string {
    return 'Health Status'
  }
}

@Exclude()
export class HealthTimeModel extends BaseModel {
  @Expose() remoteTime = 0
  @Expose() localTime = 0
  @Expose() diff = 0

  constructor(partial: Partial<HealthTimeModel>) {
    super()
    Object.assign(this, partial)
  }

  getName(): string {
    return 'Health Time'
  }
}

@Exclude()
export class HealthVersionModel extends BaseModel {
  @Expose() version = ''

  constructor(partial: Partial<HealthVersionModel>) {
    super()
    Object.assign(this, partial)
  }

  getName(): string {
    return 'Health Version'
  }
}
