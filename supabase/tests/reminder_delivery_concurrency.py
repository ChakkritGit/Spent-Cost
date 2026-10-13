#!/usr/bin/env python3
"""Exercise real receipt row locks with the reminder cron paused; no pushes.

Run from the linked project: python3 supabase/tests/reminder_delivery_concurrency.py
Uses Supabase CLI credentials and removes its uniquely tagged synthetic receipts.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import secrets
import shutil
import subprocess
import time
import uuid


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cli", default=shutil.which("supabase"))
    args = parser.parse_args()
    if not args.cli:
        parser.error("Supabase CLI is required; use --cli /path/to/supabase")
    project = Path(__file__).resolve().parents[2]

    def query(sql):
        result = subprocess.run(
            [args.cli, "db", "query", "--linked", "--output", "json", sql],
            cwd=project, capture_output=True, text=True, timeout=45,
        )
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or "database query failed")
        return json.loads(result.stdout)["rows"]

    jobs = query("select active from cron.job where jobname = 'push-reminders'")
    if len(jobs) != 1 or jobs[0]["active"] is not False:
        raise RuntimeError("pause the single push-reminders cron before this test")
    if not query("select exists(select 1 from auth.users) as available")[0]["available"]:
        raise RuntimeError("receipt tests need one existing auth user")

    receipt_hash = secrets.token_hex(32)
    user = "(select id from auth.users order by id limit 1)"
    owner, contender = str(uuid.uuid4()), str(uuid.uuid4())
    lock_key = secrets.randbelow(1_000_000_000) + 1_000_000_000

    def params(day, token):
        return f"date '{day}', {user}, '{receipt_hash}', '{token}'::uuid"

    def assert_sql(expression, expected):
        return (
            "do $test$ begin if (" + expression + ") is distinct from " + expected
            + " then raise exception 'unexpected receipt result'; end if; end; $test$;"
        )

    def race(day, operation, expected, attempts):
        hold = (
            "begin; set local statement_timeout = '30s'; " + operation
            + f" select pg_advisory_xact_lock({lock_key}::bigint);"
            + " select pg_sleep(12); commit; select pg_backend_pid() as pid;"
        )
        with ThreadPoolExecutor(max_workers=1) as pool:
            first = pool.submit(query, hold)
            try:
                deadline = time.monotonic() + 10
                while True:
                    ready = query(
                        "select exists(select 1 from pg_locks where locktype = 'advisory'"
                        + f" and classid = 0 and objid = {lock_key} and objsubid = 1"
                        + " and granted) as ready"
                    )[0]["ready"]
                    if ready:
                        break
                    if first.done():
                        first.result()
                        raise RuntimeError("owner finished before lock readiness was observed")
                    if time.monotonic() >= deadline:
                        raise RuntimeError("owner lock was not observed")
                    time.sleep(0.1)
                rows = query(
                    "with started as materialized (select clock_timestamp() as at,"
                    + " pg_backend_pid() as pid), claimed as materialized (select at, pid,"
                    + f" public.claim_reminder_delivery({params(day, contender)}) as verdict"
                    + " from started) select verdict, pid,"
                    + " extract(epoch from clock_timestamp() - at) as wait_seconds from claimed"
                )
            finally:
                owner_result = first.result()
        result = rows[0]
        if result["verdict"] != expected:
            raise AssertionError(f"contender returned {result['verdict']}, expected {expected}")
        if result["pid"] == owner_result[0]["pid"]:
            raise AssertionError("queries did not use distinct database connections")
        if float(result["wait_seconds"]) < 1:
            raise AssertionError("contender did not wait for the uncommitted receipt lock")
        receipt = query(
            "select state, attempts, claim_id from public.reminder_deliveries"
            + f" where reminder_day = date '{day}' and endpoint_hash = '{receipt_hash}'"
            + f" and user_id = {user}"
        )[0]
        if receipt["claim_id"] != owner or receipt["attempts"] != attempts:
            raise AssertionError("contender changed receipt ownership or attempt count")
        state = "sent" if expected == "sent" else "sending"
        if receipt["state"] != state:
            raise AssertionError(f"unexpected state: {receipt['state']}")
        print(f"PASS {day}: {expected}, distinct connections, row-lock wait "
              f"{float(result['wait_seconds']):.2f}s", flush=True)

    try:
        day = "1900-01-01"
        race(day, assert_sql(f"public.claim_reminder_delivery({params(day, owner)})", "'claimed'"), "busy", 1)

        day = "1900-01-02"
        query("begin; "
              + assert_sql(f"public.claim_reminder_delivery({params(day, contender)})", "'claimed'")
              + assert_sql(f"public.finish_reminder_delivery({params(day, contender)}, 'failed')", "true")
              + " commit; select true as seeded;")
        race(day, assert_sql(f"public.claim_reminder_delivery({params(day, owner)})", "'claimed'"), "busy", 2)

        day = "1900-01-03"
        query("begin; "
              + assert_sql(f"public.claim_reminder_delivery({params(day, owner)})", "'claimed'")
              + " commit; select true as seeded;")
        race(day, assert_sql(f"public.finish_reminder_delivery({params(day, owner)}, 'sent')", "true"), "sent", 1)
    finally:
        cleanup = query("delete from public.reminder_deliveries"
              + f" where endpoint_hash = '{receipt_hash}' and user_id = {user}"
              + " and reminder_day in (date '1900-01-01', date '1900-01-02', date '1900-01-03');"
              + " select count(*) as remaining from public.reminder_deliveries"
              + f" where endpoint_hash = '{receipt_hash}';")
        if cleanup[0]["remaining"] != 0:
            raise AssertionError("synthetic concurrency receipts remain")
        print("Synthetic concurrency receipts cleaned up", flush=True)


if __name__ == "__main__":
    main()
