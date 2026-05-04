import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export function translateInitializer(): () => Promise<void> {
  const translate = inject(TranslateService);
  return () => firstValueFrom(translate.use('ru')).then(() => {});
}
