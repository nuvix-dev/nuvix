export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  enabled?: boolean;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  secure: 'tls' | 'ssl' | false;
}

export const defaultSmtpConfig: SmtpConfig = {
  host: '',
  port: 0,
  username: '',
  password: '',
  from: '',
  enabled: false,
  senderName: '',
  senderEmail: '',
  replyTo: '',
  secure: false,
};
