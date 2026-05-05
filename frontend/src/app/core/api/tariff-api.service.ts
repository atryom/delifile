import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, TariffPlanInfo, TariffUsage } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class TariffApiService {
  private readonly api = inject(ApiService);

  getPlans(): Observable<ApiResponse<{ plans: TariffPlanInfo[] }>> {
    return this.api.get('/tariffs');
  }

  getUsage(): Observable<ApiResponse<TariffUsage>> {
    return this.api.get('/tariffs/usage');
  }

  requestPlan(plan: string): Observable<ApiResponse> {
    return this.api.post('/tariffs/request', { plan });
  }
}
