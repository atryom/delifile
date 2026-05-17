import { TestBed, fakeAsync, tick, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DocumentsApiService } from '../../../core/api/documents-api.service';
import { DocumentLockService } from './document-lock.service';

type ApiMock = { [K in keyof Pick<DocumentsApiService, 'acquireLock' | 'releaseLock' | 'heartbeat' | 'takeover'>]: ReturnType<typeof vi.fn> };

describe('DocumentLockService', () => {
  let service: DocumentLockService;
  let api: ApiMock;

  const okLock = { result: 'success', message: '', data: { lock: { isLocked: true } } } as const;
  const okVoid = { result: 'success', message: '', data: {} } as const;

  beforeEach(() => {
    api = {
      acquireLock: vi.fn().mockReturnValue(of(okLock)),
      releaseLock: vi.fn().mockReturnValue(of(okVoid)),
      heartbeat:   vi.fn().mockReturnValue(of(okVoid)),
      takeover:    vi.fn().mockReturnValue(of(okLock)),
    };

    TestBed.configureTestingModule({
      providers: [
        DocumentLockService,
        { provide: DocumentsApiService, useValue: api },
      ],
    });

    service = TestBed.inject(DocumentLockService);
  });

  afterEach(() => {
    service.reset();
  });

  it('starts in idle state', () => {
    expect(service.lockState()).toBe('idle');
    expect(service.takenOverBy()).toBeNull();
    expect(service.isEditing()).toBe(false);
  });

  it('acquire() → held + isEditing on success', async () => {
    const result = await service.acquire('doc_1');
    expect(result).toBe(true);
    expect(service.lockState()).toBe('held');
    expect(service.isEditing()).toBe(true);
    expect(api.acquireLock).toHaveBeenCalledWith('doc_1');
  });

  it('acquire() → readonly on 423 error', async () => {
    api.acquireLock.mockReturnValue(throwError(() => ({ status: 423 })));
    const result = await service.acquire('doc_1');
    expect(result).toBe(false);
    expect(service.lockState()).toBe('readonly');
    expect(service.isEditing()).toBe(false);
  });

  it('release() → idle + calls releaseLock', async () => {
    await service.acquire('doc_1');
    service.release('doc_1');
    expect(service.lockState()).toBe('idle');
    expect(api.releaseLock).toHaveBeenCalledWith('doc_1');
  });

  it('takeover() → held on success', async () => {
    const result = await service.takeover('doc_1');
    expect(result).toBe(true);
    expect(service.lockState()).toBe('held');
    expect(api.takeover).toHaveBeenCalledWith('doc_1');
  });

  it('takeover() → false on 403', async () => {
    api.takeover.mockReturnValue(throwError(() => ({ status: 403 })));
    const result = await service.takeover('doc_1');
    expect(result).toBe(false);
  });

  it('reacquire() stops existing heartbeat and re-acquires', async () => {
    await service.acquire('doc_1');
    const result = await service.reacquire('doc_1');
    expect(result).toBe(true);
    expect(service.lockState()).toBe('held');
  });

  it('reset() clears all state', async () => {
    await service.acquire('doc_1');
    service.reset();
    expect(service.lockState()).toBe('idle');
    expect(service.takenOverBy()).toBeNull();
    expect(service.isEditing()).toBe(false);
  });

  it('heartbeat failure with LOCK_EXPIRED → lost_expired', fakeAsync(() => {
    service.acquire('doc_1');
    flushMicrotasks();
    api.heartbeat.mockReturnValue(throwError(() => ({
      error: { data: { reason: 'LOCK_EXPIRED' } },
    })));
    tick(60_001);
    expect(service.lockState()).toBe('lost_expired');
    expect(service.takenOverBy()).toBeNull();
  }));

  it('heartbeat failure with LOCK_TAKEN_OVER → lost_takeover + takenOverBy name', fakeAsync(() => {
    service.acquire('doc_1');
    flushMicrotasks();
    api.heartbeat.mockReturnValue(throwError(() => ({
      error: { data: { reason: 'LOCK_TAKEN_OVER', lockedBy: { name: 'Алекс' } } },
    })));
    tick(60_001);
    expect(service.lockState()).toBe('lost_takeover');
    expect(service.takenOverBy()).toBe('Алекс');
  }));

  it('heartbeat failure without reason → lost_expired', fakeAsync(() => {
    service.acquire('doc_1');
    flushMicrotasks();
    api.heartbeat.mockReturnValue(throwError(() => ({})));
    tick(60_001);
    expect(service.lockState()).toBe('lost_expired');
  }));

  it('takenOverBy defaults to fallback when lockedBy.name is absent', fakeAsync(() => {
    service.acquire('doc_1');
    flushMicrotasks();
    api.heartbeat.mockReturnValue(throwError(() => ({
      error: { data: { reason: 'LOCK_TAKEN_OVER' } },
    })));
    tick(60_001);
    expect(service.takenOverBy()).toBe('другой пользователь');
  }));
});
