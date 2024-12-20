import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule} from "@angular/forms";

import { AppComponent } from './app.component';
import { AppRoutingModule } from "./app.routes";
import { NgOptimizedImage } from "@angular/common";
import { AppLayoutComponent } from "./layouts/app-layout/app-layout.component";
import { PageLayoutComponent } from "./layouts/page-layout/page-layout.comonent";
import {EffectsModule} from "@ngrx/effects";
import {StoreModule} from "@ngrx/store";
import {AuthModule} from "./features/auth/auth.module";

@NgModule({
  declarations: [
    AppComponent,
    AppLayoutComponent,
    PageLayoutComponent,
  ],
  imports: [
    BrowserModule,
    ReactiveFormsModule,
    AppRoutingModule,
    NgOptimizedImage,
    AuthModule,
    StoreModule.forRoot({}),
    EffectsModule.forRoot([])
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
