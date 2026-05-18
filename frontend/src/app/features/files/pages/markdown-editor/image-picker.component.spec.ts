import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { outputToObservable } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { ImagePickerComponent } from './image-picker.component';
import { DocumentsApiService } from '../../../../core/api/documents-api.service';
import { ImageAsset } from '../../../../shared/models/api.models';

const img = (id: string, name: string): ImageAsset => ({
  id,
  fileName: name,
  mimeType: 'image/png',
  size: 1024,
  previewUrl: `/preview/${id}`,
  assetUrl: `/api/v1/files/${id}/content`,
  stableUrl: `/api/v1/files/${id}/content`,
});

const makeResponse = (items: ImageAsset[], nextCursor: string | null = null) => ({
  result: 'success', message: '',
  data: { items, nextCursor },
});

describe('ImagePickerComponent', () => {
  let fixture: ComponentFixture<ImagePickerComponent>;
  let component: ImagePickerComponent;
  let getImagesMock: ReturnType<typeof vi.fn>;

  const sampleImages = [img('img_1', 'logo.png'), img('img_2', 'banner.jpg')];

  beforeEach(async () => {
    getImagesMock = vi.fn().mockReturnValue(of(makeResponse(sampleImages)));

    await TestBed.configureTestingModule({
      imports: [ImagePickerComponent],
      providers: [
        { provide: DocumentsApiService, useValue: { getImages: getImagesMock } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImagePickerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should call getImages on init', () => {
    fixture.detectChanges();
    expect(getImagesMock).toHaveBeenCalledOnce();
  });

  it('should display loaded images in grid', () => {
    fixture.detectChanges();
    expect(component.images().length).toBe(2);
    const items = fixture.nativeElement.querySelectorAll('.image-picker-item');
    expect(items.length).toBe(2);
  });

  it('should show image filenames', () => {
    fixture.detectChanges();
    const names = Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('.image-picker-name'))
      .map(el => el.textContent?.trim());
    expect(names).toContain('logo.png');
    expect(names).toContain('banner.jpg');
  });

  it('should show empty state when no images', () => {
    getImagesMock.mockReturnValue(of(makeResponse([])));
    fixture.detectChanges();
    const state = fixture.nativeElement.querySelector('.image-picker-state') as HTMLElement;
    expect(state.textContent).toContain('Изображения не найдены');
  });

  it('should select image on click and mark it', () => {
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll<HTMLElement>('.image-picker-item');
    items[0].click();
    fixture.detectChanges();
    expect(component.selected()?.id).toBe('img_1');
    expect(items[0].classList.contains('selected')).toBe(true);
  });

  it('confirm button is disabled until an image is selected', () => {
    fixture.detectChanges();
    const confirmBtn = fixture.nativeElement.querySelector<HTMLButtonElement>('.btn-primary');
    expect(confirmBtn.disabled).toBe(true);

    fixture.nativeElement.querySelectorAll<HTMLElement>('.image-picker-item')[1].click();
    fixture.detectChanges();
    expect(confirmBtn.disabled).toBe(false);
  });

  it('should emit selected event on confirm', () => {
    fixture.detectChanges();
    const emitted: ImageAsset[] = [];
    outputToObservable(component.selected$).subscribe(img => emitted.push(img));

    fixture.nativeElement.querySelectorAll<HTMLElement>('.image-picker-item')[0].click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector<HTMLButtonElement>('.btn-primary')?.click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].id).toBe('img_1');
  });

  it('should emit cancelled on close (✕) button click', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    outputToObservable(component.cancelled).subscribe(() => emitted.push(1));

    fixture.nativeElement.querySelector<HTMLButtonElement>('.image-picker-close')?.click();
    expect(emitted.length).toBe(1);
  });

  it('should emit cancelled on Отмена button click', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    outputToObservable(component.cancelled).subscribe(() => emitted.push(1));

    fixture.nativeElement.querySelector<HTMLButtonElement>('.btn-secondary')?.click();
    expect(emitted.length).toBe(1);
  });

  it('should show load-more button when nextCursor is present', () => {
    getImagesMock.mockReturnValue(of(makeResponse(sampleImages, 'cursor_abc')));
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.image-picker-load-more');
    expect(btn).toBeTruthy();
  });

  it('should hide load-more when nextCursor is null', () => {
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.image-picker-load-more');
    expect(btn).toBeNull();
  });

  it('should append images and update cursor on load more', () => {
    const more = [img('img_3', 'extra.png')];
    getImagesMock
      .mockReturnValueOnce(of(makeResponse(sampleImages, 'cursor_abc')))
      .mockReturnValue(of(makeResponse(more, null)));
    fixture.detectChanges();

    fixture.nativeElement.querySelector<HTMLButtonElement>('.image-picker-load-more')?.click();
    fixture.detectChanges();

    expect(component.images().length).toBe(3);
    expect(component.nextCursor()).toBeNull();
  });

  it('should debounce search and reload images', fakeAsync(() => {
    fixture.detectChanges();
    component.searchQuery = 'logo';
    component.onSearchChange();
    expect(getImagesMock).toHaveBeenCalledTimes(1); // only initial load

    tick(400);
    expect(getImagesMock).toHaveBeenCalledTimes(2);
    expect(getImagesMock.mock.calls[1][0]).toEqual(expect.objectContaining({ search: 'logo' }));
  }));

  it('should emit cancelled on overlay click', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    outputToObservable(component.cancelled).subscribe(() => emitted.push(1));

    const overlay = fixture.nativeElement.querySelector<HTMLElement>('.image-picker-overlay');
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: overlay, writable: false });
    overlay?.dispatchEvent(event);
    expect(emitted.length).toBe(1);
  });
});
