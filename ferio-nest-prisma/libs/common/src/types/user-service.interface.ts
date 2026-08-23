export interface IUserService {
  isSecondaryUser(userId: string): Promise<boolean>;
}

export const I_USER_SERVICE = 'I_USER_SERVICE';
