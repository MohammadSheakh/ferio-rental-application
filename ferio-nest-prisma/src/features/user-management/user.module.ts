import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { AuthModule } from '../authentication/auth.module';

import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';

import { UserProfileController } from './userProfile/userProfile.controller';
import { UserProfileService } from './userProfile/userProfile.service';
// import { UserProfile, UserProfileSchema } from './userProfile/userProfile.schema';

import { UserDevicesController } from './userDevices/userDevices.controller';
import { UserDevicesService } from './userDevices/userDevices.service';
// import { UserDevices, UserDevicesSchema } from './userDevices/userDevices.schema';

import { OAuthAccountController } from './oauthAccount/oauthAccount.controller';
import { OAuthAccountService } from './oauthAccount/oauthAccount.service';
// import { OAuthAccount, OAuthAccountSchema } from './oauthAccount/oauthAccount.schema';

import { UserRoleDataController } from './userRoleData/userRoleData.controller';
import { UserRoleDataService } from './userRoleData/userRoleData.service';
// import { UserRoleData, UserRoleDataSchema } from './userRoleData/userRoleData.schema';

import { RedisModule } from '@app/redis';

/**
 * User Module
 *
 * Includes:
 * - User (core entity)
 * - UserProfile (extended profile information)
 * - UserDevices (FCM tokens, device tracking)
 * - OAuthAccount (Google/Apple account linking)
 */
@Module({
  imports: [
    /*
    // MongoDB - UserProfile collection
     // MongooseModule.forFeature([{ name: UserProfile.name, schema: UserProfileSchema }]),
    
    // MongoDB - UserDevices collection
     // MongooseModule.forFeature([{ name: UserDevices.name, schema: UserDevicesSchema }]),
    
    // MongoDB - OAuthAccount collection
     // MongooseModule.forFeature([{ name: OAuthAccount.name, schema: OAuthAccountSchema }]),

    // MongoDB - UserRoleData collection
     // MongooseModule.forFeature([{ name: UserRoleData.name, schema: UserRoleDataSchema }]),
    */

    // Redis Module (for caching)
    RedisModule,

    // Prisma Module (primary database access for User service)
    PrismaModule,

    // Auth Module (required for AuthGuard / JwtService)
    AuthModule,
  ],
  controllers: [UserController, UserProfileController, UserDevicesController, OAuthAccountController, UserRoleDataController],
  providers: [UserService, UserProfileService, UserDevicesService, OAuthAccountService, UserRoleDataService],
  exports: [UserService, UserProfileService, UserDevicesService, OAuthAccountService, UserRoleDataService],
})
export class UserModule {}
