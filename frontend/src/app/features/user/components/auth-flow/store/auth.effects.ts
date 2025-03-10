// file: frontend/src/app/features/user/components/auth-flow/store/auth.effects.ts
// author: Corey Dale Peters
// date: 2024-12-20
// description: Contains all GraphQL queries and mutations for the User service

// 3rd Party Imports
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { from, of } from "rxjs";
import { Store } from '@ngrx/store';

// Application Imports
import { UserService } from "../../../../../core/services/user.service";
import { UserQueryInput } from "../../../../../core/graphql/user.graphql";
import { AuthActions } from "./auth.actions";
import * as fromAuth from "./auth.selectors";
import { CognitoService } from "../../../../../core/services/cognito.service";

@Injectable()
export class AuthEffects {

  checkEmail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.checkEmail),
      tap(action => console.debug('Effect [CheckEmail]: Starting', action)),
      switchMap(({ email }) => {
        console.debug('Effect [CheckEmail]: Making service call');
        return from(this.userService.userExists({ email } as UserQueryInput)).pipe(
          tap(result => console.debug('Effect [CheckEmail]: Service returned', result)),
          map((exists: boolean) => {
            console.debug('Effect [CheckEmail]: Success, user exists:', exists);
            return AuthActions.checkEmailSuccess({ userExists: exists });
          }),
          catchError((error: Error) => {
            console.error('Effect [CheckEmail]: Error caught', error);
            return of(AuthActions.checkEmailFailure({
              error: error.message || 'An error occurred while checking email'
            }));
          }),
          tap(resultAction => console.debug('Effect [CheckEmail]: Emitting action', resultAction))
        );
      }),
      catchError(error => {
        console.error('Effect [CheckEmail]: Outer error caught', error);
        return of(AuthActions.checkEmailFailure({
          error: 'An unexpected error occurred'
        }));
      })
    )
  );

  createUser$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.createUser),
      switchMap(({ input, password }) => {
        // create the user
        return from(this.userService.userCreate(input, password)).pipe(
          map(response => {
            if (response.userQueryById?.status_code === 200) {
              return AuthActions.createUserSuccess();
            }
            return AuthActions.createUserFailure({
              error: response.userQueryById?.message || 'Failed to create user'
            });
          }),
          catchError(error => of(AuthActions.createUserFailure({
            error: error instanceof Error ? error.message : 'Failed to create user'
          })))
        );
      })
    )
  );

  verifyEmail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.verifyEmail),
      switchMap(({ input, code }) =>
        from(this.userService.emailVerify(input, code)).pipe(
          map(response => {
            if (response) {
              return AuthActions.verifyEmailSuccess();
            }
            return AuthActions.verifyEmailFailure({
              error: 'Failed to verify email'
            });
          })
        )
      )
    )
  );

  verifyCognitoPassword = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.verifyCognitoPassword),
      switchMap(({ email, password }) =>
        from(this.userService.userSignIn( email, password )).pipe(
          map(response => {

            console.debug('verifyCognitoPassword response:', response);

            // error state
            if (response.status_code !== 200) {
              return AuthActions.verifyCognitoPasswordFailure({
                error: response?.message || 'Failed to verify email and password'
              });
            }

            return AuthActions.verifyCognitoPasswordSuccess({
              needsMFA: response.needsMFA,
              needsMFASetup: response.needsMFASetup,
              message: 'Successfully verified email and password',
              mfaSetupDetails: response.mfaSetupDetails
            });

          }),
          catchError(error => of(AuthActions.verifyCognitoPasswordFailure({
            error: error instanceof Error ? error.message : 'Failed to sign in'
          }))
        )
      )
    )
  ));

  setupMFA$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.needsMFASetup),
      switchMap(() =>
        from(this.userService.mfaSetup()).pipe(
          map(response => {
            if (response.status_code === 200) {
              return AuthActions.needsMFASetupSuccess();
            }
            return AuthActions.needsMFASetupFailure({
              error: response.message || 'Failed to setup MFA'
            });
          }),
          catchError(error => of(AuthActions.needsMFASetupFailure({
            error: error instanceof Error ? error.message : 'Failed to setup MFA'
          }))
        )
      )
    )
  ));

  verifyMFA$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.needsMFA),
      switchMap(({ code }) =>
        from(this.userService.mfaVerify(code)).pipe(
          map(response => {
            if (response.status_code === 200) {
              return AuthActions.needsMFASuccess();
            }
            return AuthActions.needsMFAFailure({
              error: response.message || 'Failed to verify MFA code'
            });
          }),
          catchError(error => of(AuthActions.needsMFAFailure({
            error: error instanceof Error ? error.message : 'Failed to verify MFA code'
          }))
        )
      )
    )
  ));

  // Add signout effect
  signout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.signout),
      switchMap(() => {
        // Then attempt to sign out from Cognito service
        return from(this.cognitoService.signOut()).pipe(
          map(() => {
            console.debug('Signout successful, returning success action');
            return AuthActions.signoutSuccess();
          }),
          catchError(error => {
            console.error('Error during signout:', error);
            // Even on error, we return success to ensure state is reset
            return of(AuthActions.signoutSuccess());
          })
        );
      })
    )
  );

  // Check phone required
  checkPhoneRequired$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.checkPhoneRequired),
      tap(() => console.debug('Effect: Checking if phone setup is required')),
      switchMap(() => {
        return of(AuthActions.checkPhoneRequiredSuccess({ required: true }))
          .pipe(
            catchError(error => of(AuthActions.checkPhoneRequiredFailure({ 
              error: error instanceof Error ? error.message : 'Failed to check phone requirement'
            })))
          );
      })
    )
  );
  
  // Setup phone number
  setupPhone$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.setupPhone),
      tap(action => console.debug('Effect: Setting up phone', action)),
      switchMap(({ phoneNumber }) => {
        return from(this.userService.sendSMSVerificationCode(phoneNumber)).pipe(
          map(response => {
            if (response.status_code === 200) {
              return AuthActions.setupPhoneSuccess({ 
                validationId: phoneNumber, // Store the phone number as validation ID for reference
                expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
              });
            }
            return AuthActions.setupPhoneFailure({
              error: response.message || 'Failed to send verification code'
            });
          }),
          catchError(error => of(AuthActions.setupPhoneFailure({ 
            error: error instanceof Error ? error.message : 'Failed to set up phone verification'
          })))
        );
      })
    )
  );
  
  // Verify phone number
  verifyPhone$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.verifyPhone),
      tap(action => console.debug('Effect: Verifying phone code', action)),
      withLatestFrom(this.store.select(fromAuth.selectPhoneValidationId)),
      switchMap(([{ code }, phoneNumber]) => {
        if (!phoneNumber) {
          return of(AuthActions.verifyPhoneFailure({ 
            error: 'No phone number found for verification'
          }));
        }
        
        return from(this.userService.verifySMSCode(phoneNumber, code)).pipe(
          map(isValid => {
            if (isValid) {
              return AuthActions.verifyPhoneSuccess();
            }
            return AuthActions.verifyPhoneFailure({
              error: 'Invalid verification code'
            });
          }),
          catchError(error => of(AuthActions.verifyPhoneFailure({ 
            error: error instanceof Error ? error.message : 'Failed to verify phone code'
          })))
        );
      })
    )
  );

  constructor(
    private actions$: Actions,
    private userService: UserService,
    private cognitoService: CognitoService,
    private store: Store
  ) {}
}
