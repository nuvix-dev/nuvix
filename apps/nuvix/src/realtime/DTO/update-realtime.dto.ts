import { PartialType } from '@nestjs/swagger';
import { CreateRealtimeDTO } from './create-realtime.dto';

export class UpdateRealtimeDTO extends PartialType(CreateRealtimeDTO) {
  id: number;
}
