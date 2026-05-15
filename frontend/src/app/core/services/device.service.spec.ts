import { TestBed } from '@angular/core/testing';
import { DeviceService } from './device.service';

describe('DeviceService', () => {
  let service: DeviceService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeviceService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should generate and persist device id', () => {
    const id1 = service.getDeviceId();
    expect(id1).toBeTruthy();
    expect(typeof id1).toBe('string');

    const id2 = service.getDeviceId();
    expect(id2).toBe(id1);
  });

  it('should detect desktop device type', () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (X11; Linux x86_64)', configurable: true });
    Object.defineProperty(navigator, 'platform', { value: 'Linux', configurable: true });
    const type = service.getDeviceType();
    expect(type).toContain('Desktop');
    expect(type).toContain('Linux');
  });
});
