<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{{ $title }}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 24px; color: #111827; }
  .card { background: #fff; border-radius: 12px; max-width: 480px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
  .logo { text-align: center; margin-bottom: 8px; }
  h1 { font-size: 1.3rem; font-weight: 700; text-align: center; margin: 0 0 20px; }
  p { font-size: 0.97rem; line-height: 1.6; color: #374151; margin: 0 0 16px; }
  .message-box { background: #f8fafc; border-left: 4px solid #6366f1; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  .note { font-size: 0.82rem; color: #6b7280; text-align: center; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m10 18 3-3-3-3"/></svg>
  </div>
  <h1>{{ $title }}</h1>
  <p>Здравствуйте, {{ $user->name ?? $user->email }}!</p>
  <div class="message-box">
    <p style="margin:0;white-space:pre-line">{{ $body }}</p>
  </div>
  <hr class="divider" />
  <p class="note">Это сообщение отправлено администратором сервиса {{ config('app.name') }}.</p>
</div>
</body>
</html>
