import { TestBed } from '@angular/core/testing';
import { VersionCheckService } from './version-check.service';

describe('VersionCheckService', () => {
  let service: VersionCheckService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VersionCheckService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should init without build hash', () => {
    (window as any).__BUILD_HASH__ = undefined;
    expect(() => service.init()).not.toThrow();
  });
});
