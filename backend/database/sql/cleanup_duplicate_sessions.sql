-- Удаление дублирующихся сессий: оставляем только самую свежую
-- по (user_id, device_name, device_type) для каждого пользователя.
--
-- ВНИМАНИЕ: выполнить на ПРОДЕ вручную.
-- Сначала проверить что удалится:
--
--   SELECT id, user_id, device_name, device_type, last_active_at
--   FROM device_sessions
--   WHERE id NOT IN (
--     SELECT SUBSTRING_INDEX(GROUP_CONCAT(id ORDER BY last_active_at DESC), ',', 1)
--     FROM device_sessions
--     GROUP BY user_id, device_name, device_type
--   )
--   ORDER BY user_id, device_name, device_type;

DELETE FROM device_sessions
WHERE id NOT IN (
    SELECT id FROM (
        SELECT SUBSTRING_INDEX(GROUP_CONCAT(id ORDER BY last_active_at DESC SEPARATOR ','), ',', 1) AS id
        FROM device_sessions
        GROUP BY user_id, device_name, device_type
    ) AS keep
);

-- После удаления сессий удалить осиротевшие токены (у которых нет сессии)
DELETE FROM personal_access_tokens
WHERE tokenable_type = 'App\\Models\\User'
  AND id NOT IN (
      SELECT token_id FROM device_sessions WHERE token_id IS NOT NULL
  );
