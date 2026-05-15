import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { ActivityApiService } from '../../../../core/api/domain-api.services';
import { ActivityComponent } from './activity.component';

describe('ActivityComponent', () => {
  const mockActivityApi = { list: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ActivityComponent],
      providers: [
        provideTranslateService(),
        { provide: ActivityApiService, useValue: mockActivityApi },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    mockActivityApi.list.mockReturnValue(of({
      data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } },
    }));
    const fixture = TestBed.createComponent(ActivityComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load activity on init', () => {
    mockActivityApi.list.mockReturnValue(of({
      data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } },
    }));
    const fixture = TestBed.createComponent(ActivityComponent);
    fixture.detectChanges();
    expect(mockActivityApi.list).toHaveBeenCalledWith(1);
  });

  it('should set totalPages from pagination', () => {
    mockActivityApi.list.mockReturnValue(of({
      data: {
        items: [{ id: '1', action: 'uploaded', label: 'Upload', created_at: null }],
        pagination: { page: 1, per_page: 10, total: 25 },
      },
    }));
    const fixture = TestBed.createComponent(ActivityComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.totalPages()).toBe(3);
    expect(fixture.componentInstance.logs().length).toBe(1);
  });

  it('should navigate to a page', () => {
    mockActivityApi.list.mockReturnValue(of({
      data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } },
    }));
    const fixture = TestBed.createComponent(ActivityComponent);
    fixture.componentInstance.goToPage(3);

    expect(fixture.componentInstance.page()).toBe(3);
    expect(mockActivityApi.list).toHaveBeenCalledWith(3);
  });

  it('should return icon for known actions', () => {
    mockActivityApi.list.mockReturnValue(of({
      data: { items: [], pagination: { page: 1, per_page: 20, total: 0 } },
    }));
    const fixture = TestBed.createComponent(ActivityComponent);
    const icon = fixture.componentInstance.actionIcon;

    expect(icon('uploaded')).toBe('☁️');
    expect(icon('downloaded')).toBe('⬇️');
    expect(icon('deleted')).toBe('🗑️');
    expect(icon('unknown_action')).toBe('📋');
  });
});
