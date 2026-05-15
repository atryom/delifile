import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('theme-dark');
  });

  it('should default to light theme', () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    expect(service.isDark()).toBe(false);
  });

  it('should toggle theme', () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    service.toggle();
    expect(service.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(localStorage.getItem('app-theme')).toBe('dark');

    service.toggle();
    expect(service.isDark()).toBe(false);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(localStorage.getItem('app-theme')).toBe('light');
  });

  it('should restore dark theme from localStorage', () => {
    localStorage.setItem('app-theme', 'dark');
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    expect(service.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
  });
});
