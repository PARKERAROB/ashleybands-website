-- Unified "who is touching this business" view across BOTH paths.
-- Warm path lives in `prospects` (a family pursuing a business); cold path lives in
-- `business_outreach` (a cold willingness send). Before this, nothing joined them,
-- so a business could be cold-emailed while a family was already visiting it in
-- person. This view is the single place to see all activity per business.

create or replace view business_touchpoints as
select
  b.id as business_id,
  b.name_display,
  b.outreach_status,
  b.zone,
  b.distance_mi,
  b.email,
  -- warm path
  count(distinct p.family_id) as family_count,
  array_remove(array_agg(distinct f.display_name), null) as families,
  bool_or(p.status = 'yes') as any_family_committed,
  -- cold path
  count(distinct o.id) as cold_sends,
  max(o.sent_at) as last_cold_sent_at,
  bool_or(o.click_yes_at is not null) as ever_clicked_yes
from businesses b
left join prospects p on p.business_id = b.id
left join families f on f.id = p.family_id
left join business_outreach o on o.business_id = b.id
group by b.id, b.name_display, b.outreach_status, b.zone, b.distance_mi, b.email;
