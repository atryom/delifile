import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { FilesApiService } from '../../../../core/api/files-api.service';
import { CreateLinkDialogComponent } from './create-link-dialog.component';

describe('CreateLinkDialogComponent', () => {
  const mockFilesApi = { createLink: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [CreateLinkDialogComponent],
      providers: [
        provideTranslateService(),
        { provide: FilesApiService, useValue: mockFilesApi },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(CreateLinkDialogComponent);
    fixture.componentRef.setInput('fileId', 'f1');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should validate ttl_hours as required and min 1', () => {
    const fixture = TestBed.createComponent(CreateLinkDialogComponent);
    fixture.componentRef.setInput('fileId', 'f1');
    const ttl = fixture.componentInstance.form.get('ttl_hours');
    ttl?.setValue(0);
    expect(ttl?.errors?.['min']).toBeTruthy();
    ttl?.setValue(1);
    expect(ttl?.valid).toBe(true);
    ttl?.setValue(null);
    expect(ttl?.errors?.['required']).toBe(true);
  });

  it('should create link and set createdLink', () => {
    mockFilesApi.createLink.mockReturnValue(of({
      data: { link: { id: 'l1', url: 'https://example.com/l1' } },
    }));

    const fixture = TestBed.createComponent(CreateLinkDialogComponent);
    fixture.componentRef.setInput('fileId', 'f1');
    fixture.componentInstance.submit();

    expect(mockFilesApi.createLink).toHaveBeenCalledWith('f1', 12, false);
    expect(fixture.componentInstance.createdLink()?.url).toBe('https://example.com/l1');
    expect(fixture.componentInstance.submitting()).toBe(false);
  });

  it('should set error on create failure', () => {
    mockFilesApi.createLink.mockReturnValue(throwError(() => ({
      message: 'File not found',
    })));

    const fixture = TestBed.createComponent(CreateLinkDialogComponent);
    fixture.componentRef.setInput('fileId', 'f1');
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.error()).toBe('File not found');
  });

  it('should not submit when form is invalid', () => {
    const fixture = TestBed.createComponent(CreateLinkDialogComponent);
    fixture.componentRef.setInput('fileId', 'f1');
    fixture.componentInstance.form.get('ttl_hours')?.setValue(null);
    fixture.componentInstance.submit();
    expect(mockFilesApi.createLink).not.toHaveBeenCalled();
  });

  it('should copy link via clipboard API when available', fakeAsync(() => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText }, configurable: true, writable: true,
    });

    const fixture = TestBed.createComponent(CreateLinkDialogComponent);
    fixture.componentRef.setInput('fileId', 'f1');
    fixture.componentInstance.createdLink.set({
      id: 'l1', url: 'https://example.com/l1', status: 'active',
      ttl_hours: 12, allow_save: false, expires_at: null,
      created_at: null, created_by: 'u1',
    });
    fixture.componentInstance.copyLink();

    expect(writeText).toHaveBeenCalledWith('https://example.com/l1');
    tick(); // flush microtasks (promise resolution)
    expect(fixture.componentInstance.copied()).toBe(true);
  }));

  it('should format null expiry as never', () => {
    const fixture = TestBed.createComponent(CreateLinkDialogComponent);
    fixture.componentRef.setInput('fileId', 'f1');
    const result = fixture.componentInstance.formatExpiry(null);
    expect(result).toContain('never');
  });

  it('should format valid expiry as date string', () => {
    const fixture = TestBed.createComponent(CreateLinkDialogComponent);
    fixture.componentRef.setInput('fileId', 'f1');
    const result = fixture.componentInstance.formatExpiry('2026-01-15T10:00:00Z');
    expect(result).toContain('2026');
  });
});
