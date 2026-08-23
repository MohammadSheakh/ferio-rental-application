import { Module } from '@nestjs/common';
import { RentalOrganizationsModule } from './organizations/rental-organizations.module';
import { RentalPropertiesModule } from './properties/rental-properties.module';
import { RentalPeopleModule } from './people/rental-people.module';
import { RentalLeasingModule } from './leasing/rental-leasing.module';
import { RentalBillingModule } from './billing/rental-billing.module';
import { RentalCrmModule } from './crm/rental-crm.module';
import { RentalMaintenanceModule } from './maintenance/rental-maintenance.module';
import { RentalDocumentsModule } from './documents/rental-documents.module';
import { RentalUtilitiesModule } from './utilities/rental-utilities.module';
import { RentalInspectionsModule } from './inspections/rental-inspections.module';
import { RentalExpensesModule } from './expenses/rental-expenses.module';
import { RentalPaymentsModule } from './payments/rental-payments.module';
import { RentalCommunicationsModule } from './communications/rental-communications.module';
import { RentalReportsModule } from './reports/rental-reports.module';
import { RentalSubscriptionsModule } from './subscriptions/rental-subscriptions.module';
import { RentalWebhooksModule } from './webhooks/rental-webhooks.module';
import { RentalAutomationsModule } from './automations/rental-automations.module';
import { RentalAdminModule } from './admin/rental-admin.module';
import { RentalImportsModule } from './imports/rental-imports.module';

@Module({
  imports: [
    RentalOrganizationsModule,
    RentalPropertiesModule,
    RentalPeopleModule,
    RentalLeasingModule,
    RentalBillingModule,
    RentalCrmModule,
    RentalMaintenanceModule,
    RentalDocumentsModule,
    RentalUtilitiesModule,
    RentalInspectionsModule,
    RentalExpensesModule,
    RentalPaymentsModule,
    RentalCommunicationsModule,
    RentalReportsModule,
    RentalSubscriptionsModule,
    RentalWebhooksModule,
    RentalAutomationsModule,
    RentalAdminModule,
    RentalImportsModule,
  ],
  exports: [
    RentalOrganizationsModule,
    RentalPropertiesModule,
    RentalPeopleModule,
    RentalLeasingModule,
    RentalBillingModule,
    RentalCrmModule,
    RentalMaintenanceModule,
    RentalDocumentsModule,
    RentalUtilitiesModule,
    RentalInspectionsModule,
    RentalExpensesModule,
    RentalPaymentsModule,
    RentalCommunicationsModule,
    RentalReportsModule,
    RentalSubscriptionsModule,
    RentalWebhooksModule,
    RentalAutomationsModule,
    RentalAdminModule,
    RentalImportsModule,
  ],
})
export class RentalModule {}
