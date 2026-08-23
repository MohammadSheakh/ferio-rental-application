import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateRentalLeadDto, ScheduleViewingDto, CreateRentalApplicationDto, AddGuarantorDto } from '../dto/rental-crm.dto';
import { RentalLeadStatus, RentalApplicationStatus, RentalVerificationType } from '@prisma/client';

@Injectable()
export class RentalCrmService {
  constructor(private readonly prisma: PrismaService) {}

  async createLead(dto: CreateRentalLeadDto) {
    const person = await this.prisma.rentalPerson.findUnique({
      where: { id: dto.personId },
    });

    if (!person) {
      throw new NotFoundException(`Person with ID '${dto.personId}' not found.`);
    }

    return this.prisma.rentalLead.create({
      data: {
        organizationId: dto.organizationId,
        personId: dto.personId,
        interestedUnitId: dto.interestedUnitId,
        source: dto.source,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        expectedMoveIn: dto.expectedMoveIn ? new Date(dto.expectedMoveIn) : undefined,
        familySize: dto.familySize,
        occupation: dto.occupation,
        status: RentalLeadStatus.NEW,
      },
    });
  }

  async scheduleViewing(dto: ScheduleViewingDto) {
    const lead = await this.prisma.rentalLead.findUnique({
      where: { id: dto.leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${dto.leadId}' not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const viewing = await tx.rentalViewing.create({
        data: {
          leadId: dto.leadId,
          unitId: dto.unitId,
          scheduledAt: new Date(dto.scheduledAt),
          status: 'SCHEDULED',
        },
      });

      await tx.rentalLead.update({
        where: { id: dto.leadId },
        data: { status: RentalLeadStatus.VIEWING_SCHEDULED },
      });

      return viewing;
    });
  }

  async createApplication(dto: CreateRentalApplicationDto) {
    const unit = await this.prisma.rentalUnit.findUnique({
      where: { id: dto.unitId },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID '${dto.unitId}' not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Application
      const app = await tx.rentalApplication.create({
        data: {
          organizationId: dto.organizationId,
          unitId: dto.unitId,
          applicantPersonId: dto.applicantPersonId,
          offeredRent: dto.offeredRent,
          expectedMoveIn: new Date(dto.expectedMoveIn),
          occupation: dto.occupation,
          employer: dto.employer,
          monthlyIncome: dto.monthlyIncome,
          previousLandlordName: dto.previousLandlordName,
          previousLandlordPhone: dto.previousLandlordPhone,
          status: RentalApplicationStatus.SUBMITTED,
        },
      });

      // 2. Initialize Mandatory Screening Checklists for Bangladesh context
      const defaultChecklists: RentalVerificationType[] = [
        RentalVerificationType.NID_MANUAL,
        RentalVerificationType.PHONE,
        RentalVerificationType.EMPLOYER_CONTACT,
        RentalVerificationType.GUARANTOR_CONTACT,
      ];

      await tx.rentalVerificationChecklist.createMany({
        data: defaultChecklists.map((vType) => ({
          applicationId: app.id,
          verificationType: vType,
          status: 'PENDING',
        })),
      });

      return app;
    });
  }

  async addGuarantor(dto: AddGuarantorDto) {
    const app = await this.prisma.rentalApplication.findUnique({
      where: { id: dto.applicationId },
    });

    if (!app) {
      throw new NotFoundException(`Application with ID '${dto.applicationId}' not found.`);
    }

    return this.prisma.rentalGuarantor.create({
      data: {
        applicationId: dto.applicationId,
        personId: dto.personId,
        relationship: dto.relationship,
        guarantorType: dto.guarantorType,
        incomeProofUrl: dto.incomeProofUrl,
      },
    });
  }

  async findApplicationById(id: string) {
    const app = await this.prisma.rentalApplication.findUnique({
      where: { id },
      include: {
        applicantPerson: true,
        unit: { include: { property: true } },
        guarantors: { include: { person: true } },
        verifications: true,
      },
    });

    if (!app) {
      throw new NotFoundException(`Application with ID '${id}' not found.`);
    }

    return app;
  }
}
