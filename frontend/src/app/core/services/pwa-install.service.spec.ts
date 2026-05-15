import { TestBed } from '@angular/core/testing';
import { PwaInstallService } from './pwa-install.service';

describe('PwaInstallService', () => {
  let service: PwaInstallService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should create', () => {
    service = TestBed.inject(PwaInstallService);
    expect(service).toBeTruthy();
  });

  it('should not show install UI by default', () => {
    service = TestBed.inject(PwaInstallService);
    expect(service.showInstallUI()).toBe(false);
  });

  it('should run install without prompt', async () => {
    service = TestBed.inject(PwaInstallService);
    await expect(service.install()).resolves.toBeUndefined();
  });
});
