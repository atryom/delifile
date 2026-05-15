import { TestBed } from '@angular/core/testing';
import { FileTypeIconComponent } from './file-type-icon.component';

describe('FileTypeIconComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileTypeIconComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(FileTypeIconComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render image icon for image mime', () => {
    const fixture = TestBed.createComponent(FileTypeIconComponent);
    fixture.componentRef.setInput('mime', 'image/png');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const svg = el.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('20');
  });

  it('should render link icon for url_file kind', () => {
    const fixture = TestBed.createComponent(FileTypeIconComponent);
    fixture.componentRef.setInput('kind', 'url_file');
    fixture.detectChanges();

    expect(fixture.componentInstance.iconType()).toBe('link');
  });

  it('should render pdf icon for pdf mime', () => {
    const fixture = TestBed.createComponent(FileTypeIconComponent);
    fixture.componentRef.setInput('mime', 'application/pdf');
    fixture.detectChanges();

    expect(fixture.componentInstance.iconType()).toBe('pdf');
  });

  it('should render default file icon for unknown mime', () => {
    const fixture = TestBed.createComponent(FileTypeIconComponent);
    fixture.componentRef.setInput('mime', 'application/octet-stream');
    fixture.detectChanges();

    expect(fixture.componentInstance.iconType()).toBe('file');
  });

  it('should respect size input', () => {
    const fixture = TestBed.createComponent(FileTypeIconComponent);
    fixture.componentRef.setInput('size', 32);
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
  });
});
