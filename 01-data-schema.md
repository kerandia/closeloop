# CloseLoop — Data Schema
**Owner: Data/Backend · consumed by everyone**

Postgres. Status fields are `text` with allowed values in comments (not native enums — easier to evolve in a hackathon). All tables get `id uuid default gen_random_uuid()` and timestamps. `pgvector` is optional (KB retrieval only).

```sql
create extension if not exists "pgcrypto";   -- gen_random_uuid()
-- create extension if not exists "vector";   -- only if doing KB embeddings
```

---

## A. OPERATIONAL TABLES

### reps — salespeople (seeded for the hackathon)
```sql
create table reps (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  strengths   jsonb default '{}',   -- {buyer_types:["family","skeptic"], note:"calm closer"}
  stats       jsonb default '{}',   -- {close_rate_by_type:{skeptic:0.58,family:0.41}}  (seeded)
  created_at  timestamptz default now()
);
```

### customers — the homeowner / deal (central entity)
```sql
create table customers (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text,
  phone             text,
  address           jsonb default '{}',          -- {street,zip,city}
  language          text default 'de',           -- 'de' | 'en'
  stage             text default 'quoted',       -- imported|quoted|contacted|in_progress|won|lost
  assigned_rep_id   uuid references reps(id),
  assignment_reason text,                         -- WHY this rep (shown in UI)
  sign_likelihood   int,                          -- 0..100, set by ANALYZE
  ghost_risk        text,                          -- low|medium|high
  last_contact_at   timestamptz,
  next_action_at    timestamptz,                  -- mirrors current recommendation timing
  consent_voice     boolean default false,
  consent_marketing boolean default false,
  source            text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index on customers (sign_likelihood desc);
```

### quotes — the persuasion fuel (1+ per customer)
```sql
create table quotes (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references customers(id) on delete cascade,
  system_size_kwp   numeric,
  battery_kwh       numeric,
  product_summary   text,                          -- "12 kWp roof + 10 kWh battery"
  price_eur         numeric,
  monthly_saving_eur numeric,
  payback_years     numeric,
  annual_return_pct numeric,                        -- the "investor" number
  co2_tons_25y      numeric,                        -- the "environmentalist" number
  financing         jsonb,                          -- {type:"kfw", rate:..., monthly:...}
  pdf_url           text,
  sent_at           timestamptz,
  created_at        timestamptz default now()
);
```

### profiles — one current 2-layer profile per customer
```sql
create table profiles (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null unique references customers(id) on delete cascade,
  motivation        text,        -- savings|environment|independence|peace_of_mind|mixed
  motivation_conf   numeric,     -- 0..1
  -- negotiation layer (how they behave):
  negotiation       jsonb default '{}',
    -- { multi_quote_risk:"high"|"medium"|"low",
    --   price_sensitivity:"high"|"medium"|"low",
    --   decision_speed:"fast"|"slow",
    --   decision_makers:["husband","wife"],
    --   blockers:["spouse_buy_in"],
    --   buying_signals:["asked about install date"] }
  buyer_type        text,        -- derived label: family|investor|environmentalist|skeptic
  summary           text,        -- the short paragraph shown on the dashboard detail
  objections        jsonb default '[]',  -- [{key:"winter_yield", note:"..."}]
  completeness      int default 0,        -- 0..100, drives "collect" questions
  updated_at        timestamptz default now()
);
```

### profile_signals — evidence (every read backed by the customer's own words)
```sql
create table profile_signals (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references customers(id) on delete cascade,
  layer                text not null,   -- motivation|negotiation|objection|buying_signal
  label                text not null,   -- "multi_quote_risk: HIGH"
  evidence_quote       text,            -- "I'll need to check with a couple of other companies"
  source_interaction_id uuid references interactions(id),
  confidence           numeric,
  created_at           timestamptz default now()
);
```

### interactions — every touch (call / email / sms / whatsapp / visit)
```sql
create table interactions (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  rep_id          uuid references reps(id),     -- null = AI / voice agent
  channel         text not null,                 -- voice_ai|phone|email|sms|whatsapp|visit|system
  direction       text not null,                 -- inbound|outbound
  occurred_at     timestamptz default now(),
  content         text,                          -- message body / note text
  transcript_md   text,                          -- markdown transcript (calls/visits)
  transcript_raw  jsonb,                          -- provider turns, if available
  recording_url   text,
  outcome         text,                          -- "reached, learned winter doubt"
  rep_gut_feel    text,                          -- subjective signal ("wife not on board")
  created_by      text default 'system',         -- voice_agent|rep|system
  created_at      timestamptz default now()
);
create index on interactions (customer_id, occurred_at desc);
```

### extracted_actions — concrete asks from a call ("call me at 5pm")
```sql
create table extracted_actions (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  interaction_id  uuid references interactions(id),
  type            text not null,    -- callback|send_info|schedule_visit|other
  detail          text not null,    -- "Wants a call back Tuesday after 17:00"
  due_at          timestamptz,
  status          text default 'open',  -- open|done|dismissed
  created_at      timestamptz default now()
);
```

### recommendations — the next-best-action (human-in-the-loop spine)
```sql
create table recommendations (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete cascade,
  channel       text not null,        -- email|sms|whatsapp|phone|visit
  timing_at     timestamptz,
  timing_label  text,                 -- "within 48h"
  goal          text,                 -- "handle multi-quote risk, lock before competitors"
  rationale     text not null,        -- the WHY (explainability — shown big in UI)
  play_key      text,                 -- references kb_plays.key (nullable)
  priority      int default 0,
  status        text default 'pending', -- pending|approved|composing|ready|sent|dismissed|superseded
  created_by    text default 'analyze',
  approved_by   uuid references reps(id),
  approved_at   timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on recommendations (customer_id, status, priority desc);
```

### messages — generated outreach per recommendation (composed on click)
```sql
create table messages (
  id                 uuid primary key default gen_random_uuid(),
  recommendation_id  uuid references recommendations(id) on delete cascade,
  customer_id        uuid not null references customers(id) on delete cascade,
  channel            text not null,
  subject            text,            -- email only
  body               text not null,
  language           text default 'de',
  status             text default 'draft',  -- draft|edited|sent
  sent_at            timestamptz,
  created_at         timestamptz default now()
);
```

### score_history — optional, powers "watch the score change" (L3)
```sql
create table score_history (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references customers(id) on delete cascade,
  sign_likelihood int,
  ghost_risk      text,
  components      jsonb,   -- {engagement:.., objection_severity:.., buying_signals:.., recency:..}
  reason          text,
  created_at      timestamptz default now()
);
```

### outcomes — what actually happened (feeds the brain, L3)
```sql
create table outcomes (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references customers(id) on delete cascade,
  recommendation_id uuid references recommendations(id),
  result            text not null,  -- replied_positive|replied_negative|no_response|meeting_booked|won|lost
  notes             text,
  created_at        timestamptz default now()
);
```

---

## B. KNOWLEDGE BASE (the "Central Brain" — **seeded by the business/sales owner**)

This is the sales intelligence the ANALYZE step reasons against. In L1 it is curated content (no learning); in L3 `success_rate` fields update from `outcomes`.

### kb_buyer_types
```sql
create table kb_buyer_types (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,  -- family|investor|environmentalist|skeptic
  name          text not null,
  description   text,
  fears         jsonb,   -- ["surprise costs","making the wrong call"]
  motivators    jsonb,   -- ["predictable bills","peace of mind"]
  default_tone  text,    -- "warm, reassuring, no jargon"
  recommended_channels jsonb,  -- ["whatsapp","visit"]
  talking_points jsonb   -- ["frame as €/month not total","emphasise warranty"]
);
```

### kb_objections — objection → response library
```sql
create table kb_objections (
  id                  uuid primary key default gen_random_uuid(),
  key                 text unique not null,   -- price_too_high|winter_yield|need_other_quotes|spouse
  customer_phrasings  jsonb,   -- ["it's a lot of money","we want to check other companies"]
  read                text,    -- "value gap, not price"
  reframe_strategy    text,    -- "shift total price → monthly saving"
  do_list             jsonb,   -- ["reframe to €/month","name the multi-quote risk honestly"]
  dont_list           jsonb,   -- ["don't discount — signals padded price"]
  exact_lines         jsonb,   -- ["That's understandable — most people look at...", ...]
  applies_to          jsonb    -- buyer_type keys this is most relevant for
);
```

### kb_plays — tactics the recommendation can cite
```sql
create table kb_plays (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,   -- home_visit_trust|fast_lock|spouse_targeted
  name          text,
  description   text,
  when_to_use   text,
  channel       text,        -- email|sms|whatsapp|phone|visit
  buyer_types   jsonb,
  success_rate  numeric      -- seeded in L1; learned from outcomes in L3
);
```

### kb_channel_priors — timing/channel guidance
```sql
create table kb_channel_priors (
  id            uuid primary key default gen_random_uuid(),
  buyer_type    text,        -- kb_buyer_types.key
  stage         text,        -- quoted|contacted|in_progress
  best_channel  text,
  best_timing   text,        -- "within 48h" / "weekday evening"
  notes         text
);
```

### kb_cadence_templates — the sequence per buyer type (L2 strategy board)
```sql
create table kb_cadence_templates (
  id            uuid primary key default gen_random_uuid(),
  buyer_type    text,
  name          text,
  steps         jsonb   -- [{day_offset:0,channel:"whatsapp",goal:"...",play_key:"..."}, ...]
);
```

> **Optional retrieval:** if you want the agent to *retrieve* KB rows rather than be handed all of them, add a `kb_chunks(id, source_table, source_id, content, embedding vector(1536))` table and embed `kb_objections` + `kb_buyer_types`. **Skip for L1** — the KB is small enough to pass into the prompt whole.

---

## C. SEED DATA (minimum to demo)
- **4 `kb_buyer_types`**, **~6 `kb_objections`** (price, winter yield, need other quotes, spouse, install disruption, trust/new company), **~5 `kb_plays`**, **`kb_channel_priors`** + one **`kb_cadence_template`** per buyer type.
- **3 `reps`** with seeded strengths/stats.
- **5–8 `customers`** each with a `quote`; **1 fully fleshed (the Müllers)** with a complete seeded transcript so the golden path works even if live voice fails.

## D. Relationship summary
```
reps ──< customers ──< quotes
                  ├──1 profiles ──< profile_signals
                  ├──< interactions ──< extracted_actions
                  ├──< recommendations ──< messages
                  ├──< score_history
                  └──< outcomes
kb_* tables are reference data (joined by *_key / buyer_type, not FKs)
```
