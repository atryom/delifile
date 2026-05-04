<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Подтвердите почту</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 24px; color: #111827; }
  .card { background: #fff; border-radius: 12px; max-width: 480px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
  .logo { font-size: 2rem; text-align: center; margin-bottom: 8px; }
  h1 { font-size: 1.3rem; font-weight: 700; text-align: center; margin: 0 0 12px; }
  p { font-size: 0.97rem; line-height: 1.6; color: #374151; margin: 0 0 20px; }
  .btn { display: block; width: 100%; text-align: center; background: #6366f1; color: #fff; text-decoration: none; font-weight: 600; font-size: 1rem; padding: 14px 0; border-radius: 8px; margin: 24px 0; }
  .note { font-size: 0.82rem; color: #6b7280; text-align: center; margin-top: 24px; }
  .url-wrap { word-break: break-all; font-size: 0.8rem; color: #6366f1; }
</style>
</head>
<body>
<div class="card">
  <div class="logo"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                         class="lucide lucide-file-symlink-icon lucide-file-symlink"><path
              d="M4 11V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path
              d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m10 18 3-3-3-3"/></svg></div>
  <h1>Подтвердите адрес электронной почты</h1>
  <p>Здравствуйте! Для завершения регистрации в <strong>{{ config('app.name') }}</strong> подтвердите ваш email-адрес, нажав на кнопку ниже.</p>
  <p><strong>Важно:</strong> у вас есть 24 часа с момента регистрации. Если почта не будет подтверждена вовремя, учётная запись будет заблокирована.</p>
  <a href="{{ $verifyUrl }}" class="btn">Подтвердить почту</a>
  <p style="font-size:0.85rem;color:#6b7280;">Если кнопка не работает, скопируйте ссылку:</p>
  <p class="url-wrap">{{ $verifyUrl }}</p>
  <p class="note">Если вы не регистрировались в {{ config('app.name') }}, просто проигнорируйте это письмо.</p>
</div>
</body>
</html>
