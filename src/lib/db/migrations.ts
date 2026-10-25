/**
 * Schema migrations, applied in order on first database use. Append a new
 * entry for every change; never edit an applied one. Amount-bearing columns are
 * stored encrypted (see ./crypto.ts) so a database dump exposes no finances.
 */
export type Migration = { id: string; statements: string[] };

export const MIGRATIONS: Migration[] = [
  {
    id: "0001_member_app",
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        email VARCHAR(254) NOT NULL UNIQUE,
        email_verified_at DATETIME NULL,
        password_hash VARCHAR(255) NULL,
        name VARCHAR(100) NOT NULL,
        preferred_name VARCHAR(100) NULL,
        dob DATE NULL,
        gender VARCHAR(20) NULL,
        marital_status VARCHAR(20) NULL,
        dependants INT NOT NULL DEFAULT 0,
        city VARCHAR(100) NULL,
        state VARCHAR(100) NULL,
        pin VARCHAR(10) NULL,
        city_tier TINYINT NOT NULL DEFAULT 1,
        locale VARCHAR(8) NOT NULL DEFAULT 'en',
        number_format VARCHAR(16) NOT NULL DEFAULT 'indian',
        employment VARCHAR(20) NOT NULL DEFAULT 'salaried',
        retirement_age INT NULL,
        risk_profile VARCHAR(20) NULL,
        smoker TINYINT(1) NULL,
        existing_conditions TINYINT(1) NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        failed_logins INT NOT NULL DEFAULT 0,
        locked_until DATETIME NULL,
        deletion_requested_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        user_agent VARCHAR(255) NULL,
        ip VARCHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        INDEX idx_sessions_user (user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS email_tokens (
        token_hash CHAR(64) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        purpose VARCHAR(16) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        INDEX idx_email_tokens_user (user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS passkeys (
        id VARCHAR(255) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        public_key BLOB NOT NULL,
        counter BIGINT NOT NULL DEFAULT 0,
        transports VARCHAR(120) NULL,
        device_type VARCHAR(32) NULL,
        backed_up TINYINT(1) NOT NULL DEFAULT 0,
        name VARCHAR(100) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME NULL,
        INDEX idx_passkeys_user (user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS webauthn_challenges (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NULL,
        challenge VARCHAR(255) NOT NULL,
        purpose VARCHAR(16) NOT NULL,
        expires_at DATETIME NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS consents (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        kind VARCHAR(32) NOT NULL,
        granted TINYINT(1) NOT NULL,
        recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_consents_user (user_id, kind)
      )`,
      `CREATE TABLE IF NOT EXISTS households (
        id CHAR(36) PRIMARY KEY,
        owner_user_id CHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_households_owner (owner_user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS household_members (
        id CHAR(36) PRIMARY KEY,
        household_id CHAR(36) NOT NULL,
        user_id CHAR(36) NULL,
        name VARCHAR(100) NOT NULL,
        relation VARCHAR(20) NOT NULL,
        dob DATE NULL,
        earns TINYINT(1) NOT NULL DEFAULT 0,
        dependant TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        archived_at DATETIME NULL,
        INDEX idx_members_household (household_id)
      )`,
      `CREATE TABLE IF NOT EXISTS financial_items (
        id CHAR(36) PRIMARY KEY,
        household_id CHAR(36) NOT NULL,
        family VARCHAR(16) NOT NULL,
        type VARCHAR(40) NOT NULL,
        member_id CHAR(36) NULL,
        payload_enc TEXT NOT NULL,
        confidence VARCHAR(16) NOT NULL DEFAULT 'entered',
        archived_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_items_household (household_id, family)
      )`,
      `CREATE TABLE IF NOT EXISTS goals (
        id CHAR(36) PRIMARY KEY,
        household_id CHAR(36) NOT NULL,
        member_id CHAR(36) NULL,
        template VARCHAR(40) NOT NULL,
        name VARCHAR(120) NOT NULL,
        target_date DATE NOT NULL,
        priority VARCHAR(10) NOT NULL DEFAULT 'should',
        flexibility_years INT NOT NULL DEFAULT 0,
        payload_enc TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        archived_at DATETIME NULL,
        INDEX idx_goals_household (household_id)
      )`,
      `CREATE TABLE IF NOT EXISTS checkups (
        id CHAR(36) PRIMARY KEY,
        household_id CHAR(36) NOT NULL,
        rulepack_version VARCHAR(40) NOT NULL,
        inputs_enc TEXT NOT NULL,
        result_enc MEDIUMTEXT NOT NULL,
        overall INT NOT NULL,
        grade VARCHAR(20) NOT NULL,
        confidence VARCHAR(10) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_checkups_household (household_id, created_at)
      )`,
      `CREATE TABLE IF NOT EXISTS plan_items (
        household_id CHAR(36) NOT NULL,
        item_id VARCHAR(60) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'todo',
        skip_reason VARCHAR(255) NULL,
        snoozed_until DATE NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (household_id, item_id)
      )`,
      `CREATE TABLE IF NOT EXISTS audit_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        actor_user_id CHAR(36) NULL,
        action VARCHAR(40) NOT NULL,
        entity VARCHAR(40) NOT NULL,
        entity_id VARCHAR(64) NULL,
        at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_actor (actor_user_id, at)
      )`,
    ],
  },
  {
    // Two check-ups run within the same second must still order correctly for
    // "latest" and "what changed", so the timestamp keeps milliseconds.
    id: "0002_checkups_created_at_ms",
    statements: [
      `ALTER TABLE checkups MODIFY created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`,
    ],
  },
  {
    // The short quick start asks yes / no / not sure about term and health
    // cover (NULL = not sure), and the rest of the profile one question at a
    // time; profile_steps lists the questions answered or skipped.
    // last_reminder_at paces the opt-in monthly plan reminder.
    id: "0003_short_quick_start",
    statements: [
      `ALTER TABLE users ADD COLUMN has_term_cover TINYINT(1) NULL, ADD COLUMN has_health_cover TINYINT(1) NULL, ADD COLUMN profile_steps VARCHAR(255) NULL, ADD COLUMN last_reminder_at DATETIME NULL`,
    ],
  },
  {
    // Whether a will exists was never captured, so the tax-and-hygiene dimension
    // relied on the age-and-dependants exemption alone. NULL = not answered.
    id: "0004_has_will",
    statements: [`ALTER TABLE users ADD COLUMN has_will TINYINT(1) NULL`],
  },
];
