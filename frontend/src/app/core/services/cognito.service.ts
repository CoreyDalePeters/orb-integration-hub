// file: frontend/src/app/services/cognito.service.ts
// author: Corey Peters
// date: 2024-12-06
// description: Service for handling user authentication

// 3rd-party imports
import {Injectable} from '@angular/core';
import {
  confirmSignIn,
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  fetchUserAttributes,
  resendSignUpCode,
  setUpTOTP,
  signIn,
  signOut,
  signUp,
  updateMFAPreference,
  updateUserAttributes,
  SignUpOutput,
  verifyTOTPSetup,
  VerifyTOTPSetupInput
} from 'aws-amplify/auth';
import {BehaviorSubject, Observable} from 'rxjs';


import {Router} from '@angular/router';


// Application-specific imports
import {UserCreateInput, User, } from '../models/user.model';
import {ApiService} from "./api.service";
import {sendSMSVerificationCodeMutation, SMSVerificationInput, SMSVerificationResponse} from "../models/sms.model";
import {GraphQLResult} from "@aws-amplify/api-graphql";
import {UserService} from "./user.service";

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  needsMFA?: boolean;
  needsMFASetup?: boolean;
  mfaType?: 'sms' | 'totp';
  setupDetails?: {
    qrCode: string;
    secretKey: string;
  };
}

export interface MFASetupResponse {
  success: boolean;
  needsMFASetup?: boolean;
  error?: string;
  setupDetails?: {
    qrCode: string;
    secretKey: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class CognitoService {

  public currentUser: Observable<User | null>;
  public isAuthenticated: Observable<boolean>;
  public mfaSetupRequired: Observable<boolean>;

  private currentUserSubject: BehaviorSubject<User | null>;
  private isAuthenticatedSubject: BehaviorSubject<boolean>;
  private mfaSetupRequiredSubject: BehaviorSubject<boolean>;

  constructor() {

    // Get BehaviorSubjects for current user, authentication status, and MFA setup
    this.currentUserSubject = new BehaviorSubject<User | null>(null);
    this.isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
    this.mfaSetupRequiredSubject = new BehaviorSubject<boolean>(false);

    // Set Observables for current user, authentication status, and MFA setup
    this.currentUser = this.currentUserSubject.asObservable();
    this.isAuthenticated = this.isAuthenticatedSubject.asObservable();
    this.mfaSetupRequired = this.mfaSetupRequiredSubject.asObservable();
  }

  /**
   * Register a new user
   * @param input
   * @param password
   */
  public async createCognitoUser(input: UserCreateInput, password:string): Promise<SignUpOutput> {

      console.debug('Creating Cognito user:', input);

      return await signUp({
        username: input.cognito_id,
        password,
        options: {
          userAttributes: {
            email: input.email,
          }
        }
      });

  }

  /**
   * Confirm the email using the verification code
   * @param cognito_id
   * @param code
   */
  public async emailVerify(cognito_id: string, code: string): Promise<AuthResponse> {
    console.debug('Verifying email:', cognito_id, code);
    try {
      await confirmSignUp({ username: cognito_id, confirmationCode: code });

      return {
        success: true
      };

    } catch (error) {
      console.error('Confirmation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Confirmation failed'
      };
    }
  }

  /**
   * Sign in a user
   * @param username
   * @param password
   */
  public async signIn(username: string, password: string): Promise<AuthResponse> {
    try {
      console.info('Starting sign in process for:', username);
      const signInResult = await signIn({ username, password });
      console.debug('Sign in result:', signInResult);
      const nextStep = signInResult.nextStep.signInStep;
      console.debug('Next step:', nextStep);

      if (nextStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
        console.info('TOTP setup required');
        const totpSetupDetails = signInResult.nextStep.totpSetupDetails;

        const qrCodeUri = totpSetupDetails.getSetupUri(
          'OneRedBoot Integration Hub',
          username
        ).toString();

        return {
          success: false,
          needsMFA: true,
          mfaType: 'totp',
          setupDetails: {
            qrCode: qrCodeUri,
            secretKey: totpSetupDetails.sharedSecret
          }
        };
      }

      if (nextStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        return {
          success: false,
          needsMFA: true,
          mfaType: 'totp'
        };
      }

      if (nextStep === 'CONFIRM_SIGN_IN_WITH_SMS_CODE') {
        return {
          success: false,
          needsMFA: true,
          mfaType: 'sms'
        };
      }

      if (nextStep === 'DONE') {
        console.info('Sign in completed');
        return {
          success: true
        };
      }

      return {
        success: false,
        error: `Authentication requires: ${nextStep}`
      };

    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign in failed'
      };
    }
  }

  /**
   * Get the current user
   */
  public isAuthenticated$(): Observable<boolean> {
    return this.isAuthenticated;
  }

  /**
   * Set the current user
   * @param user
   */
  public setCurrentUser(user: User | null): void {
    console.debug('Setting current user:', user);
    try {
      this.currentUserSubject.next(user);
    } catch (error) {
      console.error('Error setting current user:', error);
      throw new AuthError(error instanceof Error ? error.message : 'Error setting current user');
    }
  }

  /**
   * Get the current user
   */
  public getCurrentUser$(): Observable<User | null> {
    return this.currentUser;
  }

  /**
   * Get the current user
   */
  public async checkIsAuthenticated(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      const isAuth = !!session.tokens;
      this.isAuthenticatedSubject.next(isAuth);
      return isAuth;
    } catch {
      this.isAuthenticatedSubject.next(false);
      return false;
    }
  }

  /**
   * Send a verification code to the phone number
   * @param input SMSVerificationInput
   */
  // public async sendVerificationCode(input: SMSVerificationInput): Promise<SMSVerificationResponse> {
  //   console.debug('Sending verification code:', input);
  //   try {
  //     const response = await this.mutate(
  //       sendSMSVerificationCodeMutation, input) as GraphQLResult<SMSVerificationResponse>;
  //     console.debug('Verification code sent:', response);
  //
  //     return response.data;
  //
  //   } catch (error) {
  //     console.error('Verification code error:', error);
  //     return {
  //       status_code: 500,
  //       message: 'Error sending verification code'
  //     };
  //   }
  // }

  /**
   * Confirm the phone number using the verification code
   * @param generated_code
   * @param entered_code
   * @param expiration
   */
  public async confirmPhone(generated_code: number, entered_code: number, expiration: number): Promise<AuthResponse> {
    try {

      // check if the code has expired
      if (new Date().getTime() > expiration) {
        return {
          success: false,
          error: 'Verification code has expired'
        };
      }

      // if the codes are not equal, then the phone number is verified
      if (generated_code !== entered_code) {
        return {
          success: false
        };
      }

      // Update the phone number attribute to mark it as verified in Cognito
      await updateUserAttributes({
        userAttributes: {
          'phone_number_verified': 'true',
        }
      });

      return {
        success: true,
      };

    } catch (error) {
      console.error('Error verifying phone number:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Phone verification failed',
      };
    }
  }

  public async getCognitoProfile(): Promise<any | null> {
    try {
      // Fetch the current session
      const session = await fetchAuthSession();

      if (!session.tokens?.idToken?.payload) {
        console.debug('No valid session found');
        return null;
      }

      // Get current authenticated user
      const { username, signInDetails } = await getCurrentUser();

      // Get user attributes using getCurrentUser() and getUserAttributes()
      const userAttributes = await fetchUserAttributes();

      return {
        username,
        ...userAttributes,
        sub: session.tokens.idToken.payload.sub,
        groups: session.tokens.idToken.payload['cognito:groups'] || []
      };

    } catch (error) {
      console.error('Error fetching Cognito profile:', error);
      return null;
    }
  }

  async setupSMSMFA(phoneNumber: string): Promise<MFASetupResponse> {
    try {
      await updateMFAPreference({
        sms: "PREFERRED",
        totp: "ENABLED"
      });

      return {
        success: true
      };
    } catch (error) {
      console.error('SMS MFA setup error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS MFA setup failed'
      };
    }
  }

  async setupTOTP(): Promise<MFASetupResponse> {
    try {
      const totpSetup = await setUpTOTP();
      const setupDetails = totpSetup as any;

      return {
        success: true,
        setupDetails: {
          qrCode: setupDetails.qrCode,
          secretKey: setupDetails.secretKey
        }
      };
    } catch (error) {
      console.error('TOTP setup error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MFA setup failed'
      };
    }
  }

  async verifyMFA(code: string, rememberDevice = false): Promise<AuthResponse> {
    try {
      console.info('Verifying MFA code');
      const result = await confirmSignIn({
        challengeResponse: code,
        options: { rememberDevice }
      });
      console.debug('MFA verification result:', result);

      if (result.isSignedIn) {
        console.info('MFA verification successful');

        return {
          success: true,
          user: this.currentUserSubject.value || undefined
        };
      }

      return {
        success: false,
        error: 'MFA verification failed'
      };
    } catch (error) {
      console.error('MFA verification error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'MFA verification failed'
      };
    }
  }

  // async verifyMFASetup(code: string, mfaType: MFAType): Promise<AuthResponse> {
  //   try {
  //     // change to switch
  //     switch (mfaType) {
  //       case MFAType.TOTP:
  //         // Verify TOTP setup
  //         const answer: VerifyTOTPSetupInput = {
  //           code,
  //           options: {
  //             friendlyDeviceName: 'OneRedBoot Integration Hub'
  //           }
  //         }
  //         await verifyTOTPSetup( answer );
  //         break;
  //       case MFAType.SMS:
  //         // Verify SMS MFA setup
  //         // No verification required
  //         break;
  //       case MFAType.EMAIL:
  //         // Verify EMAIL MFA setup
  //         // No verification required
  //         break;
  //       default:
  //         throw new Error('Invalid MFA type');
  //     }
  //
  //     this.mfaSetupRequiredSubject.next(false);
  //
  //     return {
  //       success: true
  //     };
  //   } catch (error) {
  //     console.error('MFA verification error:', error);
  //     return {
  //       success: false,
  //       error: error instanceof Error ? error.message : 'MFA verification failed'
  //     };
  //   }
  // }

  async signOut(): Promise<void> {
    try {
      await signOut();
      this.currentUserSubject.next(null);
      this.isAuthenticatedSubject.next(false);
    } catch (error) {
      console.error('Sign out error:', error);
      throw new AuthError(error instanceof Error ? error.message : 'Sign out failed');
    }
  }

  async resendConfirmationCode(username: string): Promise<AuthResponse> {
    try {
      await resendSignUpCode({ username });
      return {
        success: true
      };
    } catch (error) {
      console.error('Code resend error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend code'
      };
    }
  }

}
