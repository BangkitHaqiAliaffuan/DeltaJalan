#!/bin/bash
# Backup database PostgreSQL — jalankan via cron setiap hari jam 03:00
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/ubuntu/backups"
mkdir -p "$BACKUP_DIR"

# Dump database
pg_dump -U deltajalan deltajalan_backend | gzip > "$BACKUP_DIR/deltajalan_$TIMESTAMP.sql.gz"

# Hapus backup lebih dari 30 hari
find "$BACKUP_DIR" -name "deltajalan_*.sql.gz" -mtime +30 -delete

# Opsional: upload ke S3 (uncomment jika S3 dikonfigurasi)
# aws s3 cp "$BACKUP_DIR/deltajalan_$TIMESTAMP.sql.gz" s3://jalankita-backups/
