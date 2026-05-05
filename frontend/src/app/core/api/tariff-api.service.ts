import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse, TariffPlanInfo } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class TariffApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1';

  getPlans(): Observable<ApiResponse<{ plans: TariffPlanInfo[] }>> {
    return this.http.get<ApiResponse<{ plans: TariffPlanInfo[] }>>(`${this.base}/tariffs`);
  }

  requestPlan(plan: string): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/tariffs/request`, { plan });
  }
}
