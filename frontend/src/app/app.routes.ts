// src/app/app-routing.module.ts

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from "./components/home/home.component";
import { PageLayoutComponent } from "./layouts/page-layout/page-layout.comonent";
import { AppLayoutComponent } from "./layouts/app-layout/app-layout.component";

export const routes: Routes = [
  { path: '',
    component: PageLayoutComponent,
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent }
    ]
  },
  { path: '',
    component: AppLayoutComponent,
    loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule),
    // children: [
    //   // { path: 'confirm-email', component: ConfirmEmailComponent },
    //   // { path: 'confirm-phone', component: ConfirmPhoneComponent },
    //   // { path: 'mfa-setup', component: MFASetupComponent },
    //   // { path: 'signin', component: SignInComponent },
    //   // { path: 'signup', component: SignUpComponent },
    //   // { path: 'customer', loadChildren: () => import('./pages/customer/customer.module').then(m => m.CustomerModule) },
    //   // { path: 'client', loadChildren: () => import('./pages/client/client.module').then(m => m.ClientModule) },
    //   // { path: 'developer', loadChildren: () => import('./pages/developer/developer.module').then(m => m.DeveloperModule) },
    //   // { path: 'administrator', loadChildren: () => import('./pages/administrator/administrator.module').then(m => m.AdministratorModule) },
    //   // { path: 'owner', loadChildren: () => import('./pages/owner/owner.module').then(m => m.OwnerModule) }
    // ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
