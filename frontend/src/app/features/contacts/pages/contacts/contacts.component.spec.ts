import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { ContactsApiService } from '../../../../core/api/domain-api.services';
import { ContactsComponent } from './contacts.component';

describe('ContactsComponent', () => {
  const mockContactsApi = {
    list: vi.fn(),
    create: vi.fn(),
    resolve: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [ContactsComponent],
      providers: [
        provideTranslateService(),
        { provide: ContactsApiService, useValue: mockContactsApi },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    mockContactsApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(ContactsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load contacts on init', () => {
    mockContactsApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(ContactsComponent);
    fixture.detectChanges();
    expect(mockContactsApi.list).toHaveBeenCalledWith(undefined);
  });

  it('should validate add form', () => {
    mockContactsApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(ContactsComponent);
    const form = fixture.componentInstance.addForm;
    expect(form.get('name')?.errors?.['required']).toBe(true);
    form.patchValue({ name: 'Test', email: 'bad' });
    expect(form.get('email')?.errors?.['email']).toBe(true);
    form.patchValue({ name: 'Test', email: 'test@test.com' });
    expect(form.valid).toBe(true);
  });

  it('should detect duplicate email before adding', () => {
    const existing: any = { id: '1', name: 'Existing', email: 'dup@test.com' };
    mockContactsApi.list.mockReturnValue(of({ data: { items: [existing] } }));
    const fixture = TestBed.createComponent(ContactsComponent);
    fixture.detectChanges();

    fixture.componentInstance.addForm.setValue({ name: 'New', email: 'dup@test.com' });
    fixture.componentInstance.addContact();

    expect(mockContactsApi.create).not.toHaveBeenCalled();
    expect(fixture.componentInstance.addError()).toBe('contacts.duplicate_error');
  });

  it('should add contact', () => {
    mockContactsApi.list.mockReturnValue(of({ data: { items: [] } }));
    mockContactsApi.create.mockReturnValue(of({
      data: { invitation_sent: false },
    }));

    const fixture = TestBed.createComponent(ContactsComponent);
    fixture.detectChanges();
    fixture.componentInstance.addForm.setValue({ name: 'New', email: 'new@test.com' });
    fixture.componentInstance.addContact();

    expect(mockContactsApi.create).toHaveBeenCalledWith({
      name: 'New', email: 'new@test.com',
    });
  });

  it('should resolve contacts', () => {
    mockContactsApi.list.mockReturnValue(of({ data: { items: [] } }));
    mockContactsApi.resolve.mockReturnValue(of({ data: { newly_resolved: 2 } }));

    const fixture = TestBed.createComponent(ContactsComponent);
    fixture.componentInstance.resolveContacts();

    expect(mockContactsApi.resolve).toHaveBeenCalled();
  });

  it('should delete contact', () => {
    const contact: any = { id: 'c1', name: 'Test' };
    mockContactsApi.list.mockReturnValue(of({ data: { items: [contact] } }));
    mockContactsApi.delete.mockReturnValue(of({}));

    const fixture = TestBed.createComponent(ContactsComponent);
    fixture.detectChanges();

    globalThis.confirm = vi.fn(() => true);
    fixture.componentInstance.deleteContact(contact);

    expect(mockContactsApi.delete).toHaveBeenCalledWith('c1');
    expect(fixture.componentInstance.contacts().length).toBe(0);
  });

  it('should not delete contact when confirm is false', () => {
    const contact: any = { id: 'c1', name: 'Test' };
    mockContactsApi.list.mockReturnValue(of({ data: { items: [] } }));
    const fixture = TestBed.createComponent(ContactsComponent);

    globalThis.confirm = vi.fn(() => false);
    fixture.componentInstance.deleteContact(contact);

    expect(mockContactsApi.delete).not.toHaveBeenCalled();
  });
});
