import { PartialType } from '@nestjs/mapped-types';
import { CreateRealtimeDTO } from './create-realtime.dto';

export class UpdateRealtimeDTO extends PartialType(CreateRealtimeDTO) {
  id: number;
}
