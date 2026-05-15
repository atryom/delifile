import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { OrganizationApiService } from '../../../../core/api/organization-api.service';
import { TagsListComponent } from './tags-list.component';

describe('TagsListComponent', () => {
  const mockOrgApi = {
    getTags: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [TagsListComponent],
      providers: [
        provideTranslateService(),
        { provide: OrganizationApiService, useValue: mockOrgApi },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();
  });

  // ─── Init ───────────────────────────────────────────────────────

  it('should create', () => {
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(TagsListComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load tags on init', () => {
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(TagsListComponent);
    fixture.detectChanges();
    expect(mockOrgApi.getTags).toHaveBeenCalled();
  });

  // ─── Search / Filter ────────────────────────────────────────────

  it('should filter tags by search query', () => {
    mockOrgApi.getTags.mockReturnValue(of({
      data: {
        items: [
          { id: '1', name: 'Work' },
          { id: '2', name: 'Personal' },
        ] as any[],
      },
    }));
    const fixture = TestBed.createComponent(TagsListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.filtered().length).toBe(2);
    fixture.componentInstance.searchQuery.set('work');
    expect(fixture.componentInstance.filtered().length).toBe(1);
    expect(fixture.componentInstance.filtered()[0].name).toBe('Work');
  });

  // ─── Add Tag ────────────────────────────────────────────────────

  it('should validate add form', () => {
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(TagsListComponent);
    const name = fixture.componentInstance.addForm.get('name');
    expect(name?.errors?.['required']).toBe(true);
    name?.setValue('New Tag');
    expect(name?.valid).toBe(true);
  });

  it('should add tag', () => {
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: [] } }));
    mockOrgApi.createTag.mockReturnValue(of({
      data: { tag: { id: 't1', name: 'New Tag' } },
    }));

    const fixture = TestBed.createComponent(TagsListComponent);
    fixture.detectChanges();
    fixture.componentInstance.addForm.setValue({ name: 'New Tag' });
    fixture.componentInstance.addTag();

    expect(mockOrgApi.createTag).toHaveBeenCalledWith('New Tag');
    expect(fixture.componentInstance.tags().length).toBe(1);
    expect(fixture.componentInstance.tags()[0].name).toBe('New Tag');
  });

  it('should show error on add failure', () => {
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: [] } }));
    mockOrgApi.createTag.mockReturnValue(throwError(() => ({
      message: 'Duplicate name',
    })));

    const fixture = TestBed.createComponent(TagsListComponent);
    fixture.detectChanges();
    fixture.componentInstance.addForm.setValue({ name: 'Dup' });
    fixture.componentInstance.addTag();

    expect(fixture.componentInstance.addError()).toBe('Duplicate name');
  });

  // ─── Edit Tag ───────────────────────────────────────────────────

  it('should start and cancel edit', () => {
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(TagsListComponent);
    const tag: any = { id: 't1', name: 'Old' };

    fixture.componentInstance.startEdit(tag);
    expect(fixture.componentInstance.editingId()).toBe('t1');
    expect(fixture.componentInstance.editName()).toBe('Old');

    fixture.componentInstance.cancelEdit();
    expect(fixture.componentInstance.editingId()).toBeNull();
  });

  it('should save edit', () => {
    const tags: any[] = [{ id: 't1', name: 'Old' }];
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: tags } }));
    mockOrgApi.updateTag.mockReturnValue(of({
      data: { tag: { id: 't1', name: 'Renamed' } },
    }));

    const fixture = TestBed.createComponent(TagsListComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit(tags[0]);
    fixture.componentInstance.editName.set('Renamed');
    fixture.componentInstance.saveEdit(tags[0]);

    expect(mockOrgApi.updateTag).toHaveBeenCalledWith('t1', 'Renamed');
    expect(fixture.componentInstance.tags()[0].name).toBe('Renamed');
    expect(fixture.componentInstance.editingId()).toBeNull();
  });

  it('should cancel edit when name unchanged', () => {
    const tag: any = { id: 't1', name: 'Same' };
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: [tag] } }));

    const fixture = TestBed.createComponent(TagsListComponent);
    fixture.detectChanges();
    fixture.componentInstance.startEdit(tag);
    fixture.componentInstance.saveEdit(tag);

    expect(mockOrgApi.updateTag).not.toHaveBeenCalled();
    expect(fixture.componentInstance.editingId()).toBeNull();
  });

  it('should cancel edit when name is empty after trim', () => {
    const tag: any = { id: 't1', name: 'Tag' };
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: [tag] } }));

    const fixture = TestBed.createComponent(TagsListComponent);
    fixture.detectChanges();
    fixture.componentInstance.startEdit(tag);
    fixture.componentInstance.editName.set('   ');
    fixture.componentInstance.saveEdit(tag);

    expect(mockOrgApi.updateTag).not.toHaveBeenCalled();
  });

  // ─── Delete Tag ─────────────────────────────────────────────────

  it('should confirm and delete tag', () => {
    const tags: any[] = [{ id: 't1', name: 'ToDelete' }];
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: tags } }));
    mockOrgApi.deleteTag.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(TagsListComponent);
    fixture.detectChanges();

    fixture.componentInstance.confirmDelete(tags[0]);
    expect(fixture.componentInstance.deleteTarget()).toBe(tags[0]);

    fixture.componentInstance.deleteTag();
    expect(mockOrgApi.deleteTag).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.tags().length).toBe(0);
    expect(fixture.componentInstance.deleteTarget()).toBeNull();
  });

  it('should cancel delete', () => {
    mockOrgApi.getTags.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(TagsListComponent);
    fixture.componentInstance.confirmDelete({ id: 't1', name: 'T' } as any);
    expect(fixture.componentInstance.deleteTarget()).toBeTruthy();
    fixture.componentInstance.cancelDelete();
    expect(fixture.componentInstance.deleteTarget()).toBeNull();
  });
});
