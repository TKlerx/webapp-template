WITH delivery AS (
  SELECT "finishedAt",
    CASE WHEN pg_input_is_valid(result, 'jsonb') THEN result::jsonb END AS receipt
  FROM "BackgroundJob"
  WHERE "jobType" = 'notification_delivery' AND status = 'COMPLETED'
), confirmed AS (
  SELECT receipt->>'notificationId' AS id, max("finishedAt") AS "finishedAt"
  FROM delivery
  WHERE receipt->>'status' = 'sent'
  GROUP BY receipt->>'notificationId'
)
UPDATE "Notification" notification
SET status = 'SENT', "sentAt" = COALESCE(notification."sentAt", confirmed."finishedAt"),
    "lastError" = NULL, "updatedAt" = NOW()
FROM confirmed
WHERE notification.id = confirmed.id AND notification.status = 'SENDING';
