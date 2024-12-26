import {createAction, createActionGroup, emptyProps, props} from '@ngrx/store';
import {User, UserCreateInput, UserQueryInput, UserResponse} from '../../../core/models/user.model';

// Check if email exists
export const checkEmail = createAction(
  '[Auth] Check Email',
  props<{ email: string }>()
);

export const checkEmailSuccess = createAction(
  '[Auth] Check Email Success',
  props<{ userExists: boolean }>()
);

export const checkEmailFailure = createAction(
  '[Auth] Check Email Failure',
  props<{ error: string }>()
);

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    'Signin': props<{ email: string; password: string }>(),
    'Signin Success': props<{ user: User }>(),
    'Signin Failure': props<{ error: string }>(),

    'Signout': emptyProps(),
    'Signout Success': emptyProps(),
    'Signout Failure': props<{ error: string }>(),

    'Create User': props<{ input: UserCreateInput, password: string}>(),
    'Create User Success': emptyProps(),
    'Create User Failure': props<{ error: string }>(),

    'Register': props<{ email: string; password: string; firstName: string; lastName: string }>(),
    'Register Success': props<{ user: User }>(),
    'Register Failure': props<{ error: string }>(),

    'Setup Password': props<{ password: string }>(),
    'Setup Password Success': emptyProps(),
    'Setup Password Failure': props<{ error: string }>(),

    'Verify Email': props<{ input: UserQueryInput, code: string }>(),
    'Verify Email Success': emptyProps(),
    'Verify Email Failure': props<{ error: string }>(),

    'Setup MFA': props<{ mfaType: 'sms' | 'totp' }>(),
    'Setup MFA Success': emptyProps(),
    'Setup MFA Failure': props<{ error: string }>(),

    'Verify MFA': props<{ code: string }>(),
    'Verify MFA Success': emptyProps(),
    'Verify MFA Failure': props<{ error: string }>(),

    'Send Phone Code Verification': props<{ phoneNumber: string }>(),
    'Verify Phone Code': props<{ phoneNumber: string; code: string }>(),

    'Refresh Session': emptyProps(),
    'Refresh Session Success': props<{ user: User }>(),
    'Refresh Session Failure': props<{ error: string }>()
  }
});
