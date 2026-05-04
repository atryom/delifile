<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Восстановление пароля</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 24px; color: #111827; }
  .card { background: #fff; border-radius: 12px; max-width: 480px; margin: 0 auto; padding: 40px 36px; box-shadow: 0 1px 8px rgba(0,0,0,.08); }
  .logo { text-align: center; margin-bottom: 8px; }
  h1 { font-size: 1.3rem; font-weight: 700; text-align: center; margin: 0 0 12px; }
  p { font-size: 0.97rem; line-height: 1.6; color: #374151; margin: 0 0 16px; }
  .btn { display: block; width: 100%; text-align: center; background: #6366f1; color: #fff; text-decoration: none; font-weight: 600; font-size: 1rem; padding: 14px 0; border-radius: 8px; margin: 24px 0; box-sizing: border-box; }
  .code-box { background: #f0f4ff; border: 2px solid #c7d2fe; border-radius: 10px; text-align: center; padding: 18px; margin: 20px 0; }
  .code-label { font-size: 0.82rem; color: #6b7280; margin: 0 0 8px; }
  .code-value { font-size: 2rem; font-weight: 800; letter-spacing: 0.15em; color: #4f46e5; margin: 0; }
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  .note { font-size: 0.82rem; color: #6b7280; text-align: center; }
  .url-wrap { word-break: break-all; font-size: 0.79rem; color: #6366f1; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="m10 18 3-3-3-3"/></svg>
  </div>
  <h1>Восстановление пароля</h1>
  <p>Здравствуйте! Мы получили запрос на сброс пароля для аккаунта <strong>{{ $user->email }}</strong>.</p>
  <p>Вы можете восстановить пароль двумя способами:</p>

  <p><strong>Способ 1 — нажмите кнопку:</strong></p>
  <a href="{{ $resetUrl }}" class="btn">Сбросить пароль</a>

  <hr class="divider" />

  <p><strong>Способ 2 — введите код в форму:</strong></p>
  <div class="code-box">
    <p class="code-label">Ваш код подтверждения</p>
    <p class="code-value">{{ $code }}</p>
  </div>

  <p>Код и ссылка действительны <strong>1 час</strong>.</p>
  <p class="note">Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо. Ваш пароль останется прежним.</p>
  <hr class="divider" />
  <p style="font-size:0.82rem;color:#6b7280;">Если кнопка не работает, скопируйте ссылку:</p>
  <p class="url-wrap">{{ $resetUrl }}</p>
</div>
</body>
</html>
