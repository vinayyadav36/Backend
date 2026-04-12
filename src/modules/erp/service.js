'use strict';
const { InventoryItem } = require('./model');

const checkReorderAlerts = async () => {
  const items = await InventoryItem.find({}).lean();
  return items.filter(i => i.quantity <= i.reorderLevel);
};

const calculateDepreciation = (asset) => {
  if (!asset || !asset.value || !asset.purchaseDate) return 0;
  const years = (Date.now() - new Date(asset.purchaseDate)) / (1000 * 60 * 60 * 24 * 365);
  const usefulLife = 5;
  return Math.min(asset.value, (asset.value / usefulLife) * years);
};

const generatePONumber = () => `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

module.exports = { checkReorderAlerts, calculateDepreciation, generatePONumber };
