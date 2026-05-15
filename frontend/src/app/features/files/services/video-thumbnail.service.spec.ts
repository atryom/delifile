import { TestBed } from '@angular/core/testing';
import { VideoThumbnailService } from './video-thumbnail.service';

describe('VideoThumbnailService', () => {
  let service: VideoThumbnailService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VideoThumbnailService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });
});
