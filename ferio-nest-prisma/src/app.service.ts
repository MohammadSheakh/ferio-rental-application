import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getApplicationInfo() {
    return {
      name: 'Ferio Commerce API',
      version: '0.1.0',
    };
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
