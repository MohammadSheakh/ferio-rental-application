import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      uploadedFiles?: any;
    }
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        stream: any;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
  }
}
