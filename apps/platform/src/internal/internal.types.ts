import { CreateFeedbackDTO } from './DTO/feedback.dto';

export interface CreateFeedback {
  data: CreateFeedbackDTO;
  ip: string;
  userAgent: string | undefined;
  userEmail?: string;
  userName?: string;
}
