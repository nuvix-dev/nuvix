import { Injectable } from '@nestjs/common';
import { CreateRealtimeDTO } from './DTO/create-realtime.dto';
import { UpdateRealtimeDTO } from './DTO/update-realtime.dto';

@Injectable()
export class RealtimeService {
  create(createRealtimeDTO: CreateRealtimeDTO) {
    return 'This action adds a new realtime';
  }

  findAll() {
    return `This action returns all realtime`;
  }

  findOne(id: number) {
    return `This action returns a #${id} realtime`;
  }

  update(id: number, updateRealtimeDTO: UpdateRealtimeDTO) {
    return `This action updates a #${id} realtime`;
  }

  remove(id: number) {
    return `This action removes a #${id} realtime`;
  }
}
