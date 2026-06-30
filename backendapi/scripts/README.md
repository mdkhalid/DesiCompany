# Database & Admin Scripts

## update-db-password.sql
Run in PostgreSQL to sync DB password after changing `.env`:
```
psql -U postgres -d desicompany -f scripts/update-db-password.sql
```

## Payment Gateway Key Rotation
If `PAYMENT_GATEWAY_ENCRYPTION_KEY` was rotated, existing encrypted credentials can't be decrypted.
1. Revert to the old key in `.env` temporarily
2. Start the backend and re-submit each gateway's credentials via the admin UI
3. The UI will re-encrypt them with the current key
4. Then update `.env` with the new key
