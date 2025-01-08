
export interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
  enabled: boolean;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  secure: boolean;
}

export const defaultSmtpConfig: SmtpConfig = {
  host: "",
  port: "",
  user: "",
  pass: "",
  from: "",
  enabled: false,
  senderName: "",
  senderEmail: "",
  replyTo: "",
  secure: false
}