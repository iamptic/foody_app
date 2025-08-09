# Foody — Личный кабинет ресторана (офферы + брони)

## Что есть
- Создание офферов (с presigned загрузкой фото в S3/R2 через бэкенд `/upload_init`).
- Список офферов с удалением.
- Вкладка «Брони» с автоподтягиванием каждые 15 сек и кнопкой «Погасить».

## Деплой
Залей содержимое папки как статику (например, Vercel). Открывай с параметрами:
```
https://<твой-домен>/index.html?token=<VERIFY_TOKEN>&api=<BACKEND_PUBLIC>
```

## Требования к API
- `GET /verify/{token}` → { restaurant_id, restaurant_name }
- `POST /upload_init` → { upload_url, public_url, headers, max_mb }
- `POST /offers` / `GET /offers` / `DELETE /offers/{id}`
- `GET /restaurant_reservations/{restaurant_id}`
- `POST /reservations/{code}/redeem`
