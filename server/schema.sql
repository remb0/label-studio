create table if not exists users (
  id char(36) primary key,
  email varchar(320) not null,
  password_hash varchar(255) not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  unique key users_email_unique (email)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists user_sessions (
  token_hash char(64) primary key,
  user_id char(36) not null,
  expires_at timestamp not null,
  created_at timestamp not null default current_timestamp,
  constraint user_sessions_user foreign key (user_id) references users(id) on delete cascade,
  key user_sessions_expires (expires_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists password_reset_tokens (
  token_hash char(64) primary key,
  user_id char(36) not null,
  expires_at timestamp not null,
  used_at timestamp null,
  created_at timestamp not null default current_timestamp,
  constraint password_reset_user foreign key (user_id) references users(id) on delete cascade,
  key password_reset_expires (expires_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists user_studio_data (
  user_id char(36) primary key,
  payload json not null,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint user_studio_data_user foreign key (user_id) references users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists printer_compatibility_reports (
  id char(36) primary key,
  user_id char(36) not null,
  model_id varchar(120) not null,
  result enum('works', 'fails') not null,
  connected boolean not null default false,
  test_label_printed boolean not null default false,
  size_alignment_checked boolean not null default false,
  qr_scanned boolean not null default false,
  reconnect_checked boolean not null default false,
  browser varchar(40) not null,
  operating_system varchar(40) not null,
  firmware varchar(120) null,
  notes varchar(1000) null,
  app_version varchar(80) not null,
  moderation_status enum('pending', 'approved', 'rejected') not null default 'pending',
  created_at timestamp not null default current_timestamp,
  reviewed_at timestamp null,
  constraint printer_reports_user foreign key (user_id) references users(id) on delete cascade,
  key printer_reports_public_summary (moderation_status, model_id, created_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists printer_model_proposals (
  id char(36) primary key,
  user_id char(36) not null,
  brand varchar(120) not null,
  model varchar(120) not null,
  connection_type varchar(60) not null,
  bluetooth_name varchar(160) null,
  max_width_mm decimal(7,2) null,
  dpi smallint unsigned null,
  media varchar(500) null,
  product_url varchar(1000) null,
  operating_system varchar(120) null,
  test_result enum('not-tested', 'connected', 'printed', 'failed') not null,
  observations varchar(1000) null,
  moderation_status enum('pending', 'approved', 'rejected') not null default 'pending',
  created_at timestamp not null default current_timestamp,
  constraint printer_proposals_user foreign key (user_id) references users(id) on delete cascade,
  key printer_proposals_moderation (moderation_status, created_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- One row per label; payload is null for a deletion (tombstone).
-- changed_at_ms is the client edit/delete time used for newest-wins merging.
create table if not exists user_labels (
  user_id char(36) not null,
  label_id varchar(200) not null,
  payload json null,
  changed_at_ms bigint not null,
  server_updated_at timestamp(3) not null default current_timestamp(3) on update current_timestamp(3),
  primary key (user_id, label_id),
  constraint user_labels_user foreign key (user_id) references users(id) on delete cascade,
  key user_labels_cursor (user_id, server_updated_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Preferences and settings; revision guards against concurrent overwrites.
create table if not exists user_settings (
  user_id char(36) primary key,
  payload json not null,
  revision int unsigned not null default 1,
  updated_at timestamp(3) not null default current_timestamp(3) on update current_timestamp(3),
  constraint user_settings_user foreign key (user_id) references users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Shared fixed-window rate limiting across API replicas.
create table if not exists rate_limits (
  bucket varchar(255) primary key,
  hits int unsigned not null,
  reset_at timestamp(3) not null,
  key rate_limits_reset (reset_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
