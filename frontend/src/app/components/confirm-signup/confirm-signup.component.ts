import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-confirm-signup',
  templateUrl: './confirm-signup.component.html',
  styleUrls: ['./confirm-signup.component.scss']
})
export class ConfirmSignupComponent implements OnInit {
  confirmationForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  username = '';
  resendDisabled = false;
  resendTimer: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.confirmationForm = this.fb.group({
      verificationCode: ['', [
        Validators.required,
        Validators.pattern('^[0-9]{6}$')
      ]]
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.username = params['username'];
      if (!this.username) {
        this.router.navigate(['/signup']);
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.confirmationForm.valid && !this.isLoading) {
      this.isLoading = true;
      this.errorMessage = '';

      try {
        await this.authService.confirmRegistration(
          this.username,
          this.confirmationForm.get('verificationCode')?.value
        );
        await this.router.navigate(['/signin']);
      } catch (error: any) {
        this.errorMessage = error.message || 'Failed to verify account';
      } finally {
        this.isLoading = false;
      }
    }
  }

  async resendCode(): Promise<void> {
    if (!this.resendDisabled) {
      try {
        await this.authService.resendConfirmationCode(this.username);
        this.startResendTimer();
      } catch (error: any) {
        this.errorMessage = error.message || 'Failed to resend code';
      }
    }
  }

  private startResendTimer(): void {
    this.resendDisabled = true;
    let timeLeft = 60;

    this.resendTimer = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        this.resendDisabled = false;
        clearInterval(this.resendTimer);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
  }
}
