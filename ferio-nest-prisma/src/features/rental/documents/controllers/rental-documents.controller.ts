import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalDocumentsService } from '../services/rental-documents.service';
import { UploadRentalDocumentDto } from '../dto/rental-document.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Document Vault & Compliance Files')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/documents')
export class RentalDocumentsController {
  constructor(private readonly documentsService: RentalDocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a document in the tenant/property compliance vault' })
  async uploadDocument(@Body() uploadDto: UploadRentalDocumentDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.documentsService.uploadDocument(uploadDto, userId);
    return {
      success: true,
      message: 'Document registered in vault successfully.',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all documents in an organization vault' })
  async findAllDocuments(@Query('organizationId') organizationId: string) {
    const data = await this.documentsService.findAllDocuments(organizationId);
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document details by ID' })
  async findDocumentById(@Param('id') id: string) {
    const data = await this.documentsService.findDocumentById(id);
    return {
      success: true,
      data,
    };
  }
}
