#!/usr/bin/env bash
# 로컬 PostgreSQL(16+)에서 마이그레이션과 RLS 를 검증합니다.
#   사용법: PGUSER=postgres ./scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-awards_test}
dropdb --if-exists "$DB"
createdb "$DB"
run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }
run supabase/tests/00_local_stub.sql
for f in supabase/migrations/*.sql; do echo "▶ $f"; run "$f"; done
echo "▶ 재실행(멱등성) 확인"
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed.sql
psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/10_security_test.sql
dropdb "$DB"
