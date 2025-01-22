import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class HealthAntivirusModel extends BaseModel {
  @Expose() version: string = '';
  @Expose() status: string = '';

  constructor(partial: Partial<HealthAntivirusModel>) {
    super();
    Object.assign(this, partial);
  }

  getName(): string {
    return 'Health Antivirus';
  }
}

@Exclude()
export class HealthCertificateModel extends BaseModel {
  @Expose() name: string = '';
  @Expose() subjectSN: string = 'www.google.com';
  @Expose() issuerOrganisation: string = 'Google Trust Services LLC';
  @Expose() validFrom: string = '';
  @Expose() validTo: string = '';
  @Expose() signatureTypeSN: string = '';

  constructor(partial: Partial<HealthCertificateModel>) {
    super();
    Object.assign(this, partial);
  }

  getName(): string {
    return 'Health Certificate';
  }
}

@Exclude()
export class HealthQueueModel extends BaseModel {
  @Expose() size: number = 0;

  constructor(partial: Partial<HealthQueueModel>) {
    super();
    Object.assign(this, partial);
  }

  getName(): string {
    return 'Health Queue';
  }
}

@Exclude()
export class HealthStatusModel extends BaseModel {
  @Expose() name: string = '';
  @Expose() ping: number = 0;
  @Expose() status: string = '';

  constructor(partial: Partial<HealthStatusModel>) {
    super();
    Object.assign(this, partial);
  }

  getName(): string {
    return 'Health Status';
  }
}

@Exclude()
export class HealthTimeModel extends BaseModel {
  @Expose() remoteTime: number = 0;
  @Expose() localTime: number = 0;
  @Expose() diff: number = 0;

  constructor(partial: Partial<HealthTimeModel>) {
    super();
    Object.assign(this, partial);
  }

  getName(): string {
    return 'Health Time';
  }
}

@Exclude()
export class HealthVersionModel extends BaseModel {
  @Expose() version: string = '';

  constructor(partial: Partial<HealthVersionModel>) {
    super();
    Object.assign(this, partial);
  }

  getName(): string {
    return 'Health Version';
  }
}
