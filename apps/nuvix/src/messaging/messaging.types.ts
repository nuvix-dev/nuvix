import { LocaleTranslator } from '@nuvix/core/helper';
import { Database, Query } from '@nuvix/database';
import {
  CreateMailgunProviderDTO,
  UpdateMailgunProviderDTO,
} from './DTO/mailgun.dto';
import {
  CreateSendgridProviderDTO,
  UpdateSendgridProviderDTO,
} from './DTO/sendgrid.dto';
import {
  CreateTwilioProviderDTO,
  UpdateTwilioProviderDTO,
} from './DTO/twilio.dto';
import { CreateSMTPProviderDTO, UpdateSMTPProviderDTO } from './DTO/smtp.dto';
import {
  CreateMsg91ProviderDTO,
  UpdateMsg91ProviderDTO,
} from './DTO/msg91.dto';
import {
  CreateTelesignProviderDTO,
  UpdateTelesignProviderDTO,
} from './DTO/telesign.dto';
import {
  CreateTextmagicProviderDTO,
  UpdateTextmagicProviderDTO,
} from './DTO/textmagic.dto';
import {
  CreateVonageProviderDTO,
  UpdateVonageProviderDTO,
} from './DTO/vonage.dto';
import { CreateFcmProviderDTO, UpdateFcmProviderDTO } from './DTO/fcm.dto';
import { CreateApnsProviderDTO, UpdateApnsProviderDTO } from './DTO/apns.dto';
import { CreateTopicDTO } from './DTO/topics.dto';

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

interface UpdateProviderBase<T> extends DB {
  input: T;
  providerId: string;
}

export interface UpdateMailgunProvider
  extends UpdateProviderBase<UpdateMailgunProviderDTO> {}
export interface UpdateSendgridProvider
  extends UpdateProviderBase<UpdateSendgridProviderDTO> {}
export interface UpdateSmtpProvider
  extends UpdateProviderBase<UpdateSMTPProviderDTO> {}
export interface UpdateMsg91Provider
  extends UpdateProviderBase<UpdateMsg91ProviderDTO> {}
export interface UpdateTelesignProvider
  extends UpdateProviderBase<UpdateTelesignProviderDTO> {}
export interface UpdateTextmagicProvider
  extends UpdateProviderBase<UpdateTextmagicProviderDTO> {}
export interface UpdateTwilioProvider
  extends UpdateProviderBase<UpdateTwilioProviderDTO> {}
export interface UpdateVonageProvider
  extends UpdateProviderBase<UpdateVonageProviderDTO> {}
export interface UpdateFcmProvider
  extends UpdateProviderBase<UpdateFcmProviderDTO> {}
export interface UpdateApnsProvider
  extends UpdateProviderBase<UpdateApnsProviderDTO> {}

export interface CreateTopic extends DB {
  input: CreateTopicDTO;
}
