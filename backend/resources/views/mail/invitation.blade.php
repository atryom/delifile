<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Приглашение</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 24px; color: #111827; }
  .card { background: #fff; border-radius: 12px; max-width: 480px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
  .logo { font-size: 2rem; text-align: center; margin-bottom: 8px; }
  h1 { font-size: 1.3rem; font-weight: 700; text-align: center; margin: 0 0 12px; }
  p { font-size: 0.97rem; line-height: 1.6; color: #374151; margin: 0 0 16px; }
  .btn { display: block; width: 100%; text-align: center; background: #6366f1; color: #fff; text-decoration: none; font-weight: 600; font-size: 1rem; padding: 14px 0; border-radius: 8px; margin: 24px 0; }
  .comment { background: #f3f4f6; border-left: 3px solid #6366f1; border-radius: 4px; padding: 12px 16px; font-style: italic; margin: 16px 0; }
  .note { font-size: 0.82rem; color: #6b7280; text-align: center; margin-top: 24px; }
  .url-wrap { word-break: break-all; font-size: 0.8rem; color: #6366f1; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">🗂</div>
  <h1>Вас приглашают в {{ config('app.name') }}</h1>
  <p><strong>{{ $senderName }}</strong> приглашает вас воспользоваться личным файловым хранилищем <strong>{{ config('app.name') }}</strong>.</p>
  @if($invitation->comment)
  <div class="comment">{{ $invitation->comment }}</div>
  @endif
  <p>Нажмите кнопку ниже, чтобы принять приглашение. Если у вас уже есть аккаунт — просто войдите. Если нет — зарегистрируйтесь, форма автоматически заполнит ваш email.</p>
  <a href="{{ $inviteUrl }}" class="btn">Принять приглашение</a>
  <p style="font-size:0.85rem;color:#6b7280;">Если кнопка не работает, скопируйте ссылку:</p>
  <p class="url-wrap">{{ $inviteUrl }}</p>
  <p class="note">Приглашение действительно 7 дней. Если вы не ожидали этого письма — просто проигнорируйте его.</p>
</div>
</body>
</html>
