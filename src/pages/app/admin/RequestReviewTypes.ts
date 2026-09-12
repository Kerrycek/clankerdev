import type { ChangeRequest, RegistrationRequest } from '../../../lib/api/requests';

export type RequestReviewType = 'registration' | 'change';

export type ReviewableRequest = RegistrationRequest | ChangeRequest;

export type RequestResolveOverrides = {
  login: string;
  fullName: string;
  orgName: string;
  orgId: string;
  email: string;
  address: string;
  yearOfBirth: string;
  how: string;
  note: string;
  osTemplate: string;
  location: string;
  currency: string;
  language: string;
  timeZone: string;
  changeReason: string;
};
