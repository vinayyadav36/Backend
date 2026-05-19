const db = require('../config/jsonDb');
const logger = require('../config/logger');

const MASTER_ADMIN_ID = 'master_admin_001';
const MASTER_ADMIN_COLLECTION = 'master_admins';

function ensureMasterAdmin() {
  const existing = db.findById(MASTER_ADMIN_COLLECTION, MASTER_ADMIN_ID);
  if (existing) return existing;

  const admin = {
    _id: MASTER_ADMIN_ID,
    type: 'master_admin',
    status: 'active',
    linked_apps: ['agency', 'portfolio', 'ecommerce', 'saas', 'billing', 'gst', 'accounting', 'erp', 'crm', 'pos', 'hotel', 'university', 'hr', 'trading', 'exam', 'marketing', 'dashboard'],
    permissions: {
      scope: 'global',
      mode: 'policy_driven',
      allow_impersonation: false,
    },
    auth: {
      method: 'local_json_auth',
      mfa_enabled: true,
    },
    timestamps: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null,
    },
  };

  db.insert(MASTER_ADMIN_COLLECTION, admin);
  logger.info('Master Admin identity created');
  return admin;
}

function isMasterAdmin(user) {
  return user && (user.id === MASTER_ADMIN_ID || user._id === MASTER_ADMIN_ID || user.type === 'master_admin');
}

function canAccessApp(user, appName) {
  if (!isMasterAdmin(user)) return false;
  const admin = db.findById(MASTER_ADMIN_COLLECTION, MASTER_ADMIN_ID);
  if (!admin) return false;
  return admin.linked_apps.includes(appName);
}

function canAccessTenant(user, tenantId) {
  if (!isMasterAdmin(user)) return false;
  if (user.impersonatingTenant) return user.impersonatingTenant === tenantId;
  return true;
}

function getMasterAdmin() {
  return db.findById(MASTER_ADMIN_COLLECTION, MASTER_ADMIN_ID);
}

function logMasterAdminAction(action, details = {}) {
  const audit = {
    _id: db.generateId(),
    type: 'master_admin_audit',
    actor_id: MASTER_ADMIN_ID,
    action,
    details,
    timestamp: new Date().toISOString(),
  };
  const logs = db.loadCollection('master_audit_logs');
  logs.push(audit);
  db.saveCollection('master_audit_logs', logs);
  return audit;
}

module.exports = {
  ensureMasterAdmin,
  isMasterAdmin,
  canAccessApp,
  canAccessTenant,
  getMasterAdmin,
  logMasterAdminAction,
  MASTER_ADMIN_ID,
};
