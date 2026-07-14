const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getNotes, createNote, updateNote, deleteNote } = require('../controllers/notesController');

// All routes are auth protected
router.use(auth);

router.get('/', getNotes);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

module.exports = router;
