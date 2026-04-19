'use strict';
const { createJsonModel } = require('../../models/JsonModel');

const DashboardConfig = createJsonModel('dashboard_configs', 'DashboardConfig', {
  name: { type: 'string', required: true },
  type: { type: 'string', required: true },
  modules: { type: 'array', default: [] },
  filters: { type: 'array', default: [] },
  refreshInterval: { type: 'number', default: 300 },
  isPublic: { type: 'boolean', default: false },
  createdBy: { type: 'string' },
  createdAt: { type: 'date' },
});

const DashboardWidget = createJsonModel('dashboard_widgets', 'DashboardWidget', {
  configId: { type: 'string', required: true },
  title: { type: 'string', required: true },
  type: { type: 'string', required: true },
  dataSource: { type: 'string' },
  config: { type: 'object', default: {} },
  position: { type: 'object', default: { x: 0, y: 0, w: 4, h: 3 } },
  createdAt: { type: 'date' },
});

const DashboardData = createJsonModel('dashboard_data', 'DashboardData', {
  dashboardId: { type: 'string', required: true },
  moduleName: { type: 'string', required: true },
  data: { type: 'object', default: {} },
  cachedAt: { type: 'date' },
});

module.exports = {
  DashboardConfig,
  DashboardWidget,
  DashboardData,
};