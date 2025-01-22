import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    // @InjectDataSource('default') private readonly dataSource: DataSource
  ) {}

  @Get()
  async getHello(): Promise<string> {
    return this.appService.getHello();
  }
}
