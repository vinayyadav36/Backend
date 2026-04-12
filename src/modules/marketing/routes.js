'use strict';
const router = require('express').Router();
const { protect } = require('../../middlewares/authMiddleware');
const c = require('./controller');

router.use(protect);
router.get('/clients', c.getClients);
router.get('/clients/:id', c.getClient);
router.post('/clients', c.createClient);
router.put('/clients/:id', c.updateClient);
router.get('/campaigns', c.getCampaigns);
router.get('/campaigns/:id', c.getCampaign);
router.post('/campaigns', c.createCampaign);
router.put('/campaigns/:id', c.updateCampaign);
router.get('/campaigns/:id/performance', c.getCampaignPerformance);
router.get('/content', c.getContent);
router.post('/content', c.createContent);
router.put('/content/:id', c.updateContent);
router.post('/content/:id/publish', c.publishContent);
router.get('/social-posts', c.getSocialPosts);
router.post('/social-posts', c.createSocialPost);
router.put('/social-posts/:id/schedule', c.schedulePost);
router.post('/social-posts/:id/publish', c.publishPost);
router.get('/seo', c.getSEOReports);

module.exports = router;
