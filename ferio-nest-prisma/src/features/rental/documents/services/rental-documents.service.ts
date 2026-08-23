import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { UploadRentalDocumentDto } from '../dto/rental-document.dto';

@Injectable()
export class RentalDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadDocument(dto: UploadRentalDocumentDto, uploadedByUserId: string) {
    return this.prisma.rentalDocument.create({
      data: {
        organizationId: dto.organizationId,
        fileName: dto.fileName,
        category: dto.category,
        documentType: dto.documentType,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize ?? 0,
        uploadedByUserId,
      },
    });
  }

  async findAllDocuments(organizationId: string) {
    return this.prisma.rentalDocument.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDocumentById(id: string) {
    const doc = await this.prisma.rentalDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID '${id}' not found.`);
    }

    return doc;
  }
}
