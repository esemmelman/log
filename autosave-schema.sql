grant update(body,speaker) on public.elliot_log_records_v1 to authenticated;
create policy elliot_log_records_v1_update on public.elliot_log_records_v1 for update to authenticated
using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
