-- sc-38005 checks: two waiting requests to get back in (one phone-proved) and one request to join, in OWNER's organisation.
-- psql -v owner=<owner email> -v a=<member A email> -v b=<member B email> -v c=<joiner email> -f seed.sql
-- OWNER from `qa-env.mjs account --ready`; A, B and C from three plain `qa-env.mjs account` runs.
\set ON_ERROR_STOP 1
begin;
create temp table seed on commit drop as
select (select m.organisation_id from memberships m join email_addresses e on e.user_id = m.user_id where e.address = :'owner' limit 1) as org,
       (select r.id from roles r join memberships m on m.organisation_id = r.organisation_id join email_addresses e on e.user_id = m.user_id
         where e.address = :'owner' and r.seeded_as = 'member' limit 1) as role,
       (select user_id from email_addresses where address = :'a') as a,
       (select id from email_addresses where address = :'a') as a_email,
       (select user_id from email_addresses where address = :'b') as b,
       (select id from email_addresses where address = :'b') as b_email,
       (select user_id from email_addresses where address = :'c') as c;
update users set name = 'Adébáyọ̀ Ọláolúwa' where id = (select a from seed);
update users set name = 'Małgorzata Wiśniewska-Kowalczyk' where id = (select b from seed);
update users set name = 'Inês Conceição' where id = (select c from seed);
insert into memberships(id, organisation_id, user_id, role_id, status, created_at, updated_at, joined_at)
select gen_random_uuid(), org, u, role, 'active', now(), now(), now() from seed, unnest(array[a, b]) u;
insert into memberships(id, organisation_id, user_id, role_id, status, created_at, updated_at, request_expires_at, request_message)
select gen_random_uuid(), org, c, role, 'pending_approval', now(), now(), now() + interval '14 days', 'Olá!' from seed;
insert into phone_numbers(id, user_id, number, verified_at, is_primary, created_at, updated_at, country_code)
select '11111111-1111-4111-8111-111111111111', a, '+447700900123', now(), true, now(), now(), 'GB' from seed;
insert into two_factor_recoveries(id, user_id, email_address_id, phone_number_id, status, proved_at, expires_at, created_at, updated_at)
select '22222222-2222-4222-8222-222222222221'::uuid, a, a_email, '11111111-1111-4111-8111-111111111111'::uuid, 'waiting',
       now() - interval '2 hours', now() + interval '46 hours', now() - interval '2 hours', now() from seed
union all
select '22222222-2222-4222-8222-222222222222'::uuid, b, b_email, null::uuid, 'waiting',
       now() - interval '1 hour', now() + interval '47 hours', now() - interval '1 hour', now() from seed;
commit;
-- Between checks that answer a request, put both back to waiting:
-- update two_factor_recoveries set status = 'waiting', closed_at = null, decided_by_id = null, expires_at = now() + interval '46 hours', updated_at = now()
--  where id in ('22222222-2222-4222-8222-222222222221', '22222222-2222-4222-8222-222222222222');
