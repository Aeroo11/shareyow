-- Memeriksa apakah skema sudah terpasang lengkap.
--
-- Jalankan di SQL Editor. Semua kolom harus menunjukkan "ok".

select
  case when (
    select count(*) from information_schema.tables
     where table_schema = 'public'
       and table_name in ('profiles','groups','group_access','group_invites','ops')
  ) = 5 then 'ok' else 'KURANG' end as tabel_5,

  case when (
    select count(*) from pg_policies where schemaname = 'public'
  ) = 10 then 'ok' else 'KURANG' end as policy_10,

  case when (
    select count(*) from information_schema.routines
     where routine_schema = 'public'
       and routine_name in ('is_member','join_group','assign_op_seq')
  ) = 3 then 'ok' else 'KURANG' end as fungsi_3,

  case when (
    select count(*) from information_schema.triggers
     where trigger_schema = 'public' and trigger_name = 'ops_assign_seq'
  ) >= 1 then 'ok' else 'KURANG' end as trigger_seq,

  case when (
    select count(*) from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ops'
  ) = 1 then 'ok' else 'KURANG' end as realtime,

  -- Yang paling penting: ops TIDAK BOLEH punya policy UPDATE atau DELETE.
  -- Ketiadaannya yang menegakkan sifat append-only, jadi ia diperiksa terbalik.
  case when (
    select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'ops' and cmd in ('UPDATE','DELETE')
  ) = 0 then 'ok' else 'BAHAYA: ops bisa diubah' end as ops_append_only;
