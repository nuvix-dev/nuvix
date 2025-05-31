import { LocaleTranslator } from '@nuvix/core/helper';
import { Database, Query } from '@nuvix/database';
import { CreateMailgunProviderDTO } from './DTO/mailgun.dto';
import { CreateSendgridProviderDTO } from './DTO/sendgrid.dto';
import { CreateTwilioProviderDTO } from './DTO/twilio.dto';
import { CreateSMTPProviderDTO } from './DTO/smtp.dto';
import { CreateMsg91ProviderDTO } from './DTO/msg91.dto';
import { CreateTelesignProviderDTO } from './DTO/telesign.dto';
import { CreateTextmagicProviderDTO } from './DTO/textmagic.dto';
import { CreateVonageProviderDTO } from './DTO/vonage.dto';
import { CreateFcmProviderDTO } from './DTO/fcm.dto';
import { CreateApnsProviderDTO } from './DTO/apns.dto';

interface DB {
  db: Database;
}

interface ReqRes {
  request: NuvixRequest;
  response: NuvixRes;
}

interface User {
  user: Document;
}

interface Project {
  project: Document;
}

interface Locale {
  locale: LocaleTranslator;
}

interface QandS {
  queries: Query[];
  search?: string;
}

interface CreateProviderBase<T> extends DB {
  input: T;
}

export interface CreateMailgunProvider
  extends CreateProviderBase<CreateMailgunProviderDTO> {}
export interface CreateSendgridProvider
  extends CreateProviderBase<CreateSendgridProviderDTO> {}
export interface CreateSmtpProvider
  extends CreateProviderBase<CreateSMTPProviderDTO> {}
export interface CreateMsg91Provider
  extends CreateProviderBase<CreateMsg91ProviderDTO> {}
export interface CreateTelesignProvider
  extends CreateProviderBase<CreateTelesignProviderDTO> {}
export interface CreateTextmagicProvider
  extends CreateProviderBase<CreateTextmagicProviderDTO> {}
export interface CreateTwilioProvider
  extends CreateProviderBase<CreateTwilioProviderDTO> {}
export interface CreateVonageProvider
  extends CreateProviderBase<CreateVonageProviderDTO> {}
export interface CreateFcmProvider
  extends CreateProviderBase<CreateFcmProviderDTO> {}
export interface CreateApnsProvider
  extends CreateProviderBase<CreateApnsProviderDTO> {}

export type CreateProviderInput =
  | CreateMailgunProviderDTO
  | CreateSendgridProviderDTO
  | CreateSMTPProviderDTO
  | CreateMsg91ProviderDTO
  | CreateTelesignProviderDTO
  | CreateTextmagicProviderDTO
  | CreateTwilioProviderDTO
  | CreateVonageProviderDTO
  | CreateFcmProviderDTO
  | CreateApnsProviderDTO;

export type CreateAnyProvider = CreateProviderBase<CreateProviderInput>;

export interface ListProviders extends DB, QandS {}
