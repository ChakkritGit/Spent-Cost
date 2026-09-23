-- The app only ever summed `paid` from entries ticked inside it, so a debt the
-- client has been paying for a year read 0% on day one. `paid_before` is the
-- one-time opening balance that makes the progress bar mean something for a
-- debt that predates the app.
alter table plans
  add column paid_before numeric(12,2) not null default 0 check (paid_before >= 0);
