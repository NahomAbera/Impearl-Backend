const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Contract = require('../models/Contract');

router.get('/', auth, async (req, res) => {
  try {
    const { contractId } = req.query;
    const messages = await Message.find({ contract: contractId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Error fetching messages' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { contractId, body, receiverId } = req.body;
    const contract = await Contract.findById(contractId);
    if (!contract) return res.status(404).json({ success: false, message: 'Contract not found' });

    const message = await Message.create({
      contract: contractId,
      sender: req.userId,
      receiver: receiverId,
      body
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ success: false, message: 'Error sending message' });
  }
});

module.exports = router;
