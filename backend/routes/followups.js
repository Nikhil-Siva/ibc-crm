const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getAllFollowups,
  getTodayFollowups,
  getFollowupById,
  createFollowup,
  updateFollowup,
  markDone,
  deleteFollowup,
} = require('../controllers/followupsController');

// All routes are auth protected
router.use(auth);

router.get('/', getAllFollowups);
router.get('/today', getTodayFollowups);
router.get('/:id', getFollowupById);
router.post('/', createFollowup);
router.put('/:id', updateFollowup);
router.put('/:id/done', markDone);
router.delete('/:id', authorize('admin', 'manager'), deleteFollowup);

module.exports = router;
