import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getApplicationInfo() {
    return this.appService.getApplicationInfo();
  }

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
