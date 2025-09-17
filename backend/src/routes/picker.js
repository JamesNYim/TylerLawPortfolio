// picker.js

const express = require('express');
const axios = require('axios');

const ensureAuth = require('../middleware/ensureAuth');
const oauth2Client = require('../oauth/google');

const router = express.Router();

router.post('/picker/sessions', ensureAuth, async (req, res) => {
    try {
        // FIX: always fetch a fresh access token right before the API call
        const { token } = await oauth2Client.getAccessToken();
        const { data } = await axios.post(
            'https://photospicker.googleapis.com/v1/sessions',
            {}, // No body unless we restrict to an album
            { headers: { Authorization: `Bearer ${token}`} }
        );

        return res.json({
            sessionId: data.id, 
            pickerUri: data.pickerUri, 
            raw: data
        });
    }
    catch (error) {
        console.error('sessions.create failed: ', error.response?.data);
        return res.status(500).json({error: 'Could not create Picker session' });
    }
});

router.get('/picker/sessions/:sessionId', ensureAuth, async (req, res) => {
    const sessionId = req.params.sessionId;
    // FIX: just logging — add missing slash for readability
    console.log(`=> GET /picker/sessions/${sessionId}`);

    try {
        // FIX: consistently use getAccessToken() to ensure freshness
        const { token } = await oauth2Client.getAccessToken();
        console.log('=> Using access token (truncated): ', token?.slice(0,12), '...');

        if (!token) {
            console.log('X No token Available');
            return res.status(401).json({ error: 'No access token available' });
        }
        const url = `https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`; // FIX: encode id
        const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}`}});
        console.log('=> sessions.get succeeded: ', data);
        return res.json(data);
    }
    catch (error) {
        console.error('X sessions.get failed: body = ', error.response?.data);
        console.error('X sessions.get failed: status = ', error.response?.status);
        return res
            .status(error.response?.status || 500)
            .json(error.response?.data || { error: error.message });
    }
});

router.get('/picker/mediaItems', ensureAuth, async (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  try {
    const { token } = await oauth2Client.getAccessToken();

    // paginate until all items are returned
    let items = [];
    let pageToken = null;
    do {
      const { data } = await axios.get(
        'https://photospicker.googleapis.com/v1/mediaItems',
        { 
          headers: { Authorization: `Bearer ${token}` },
          params: { sessionId, pageToken }
        }
      );
      items = items.concat(data.mediaItems || []);
      pageToken = data.nextPageToken;
    } while (pageToken);

    return res.json(items);
  } catch (err) {
    console.error('mediaItems.list failed:', err.response?.data);
    return res.status(500).json({ error: 'Could not list media items' });
  }
});

module.exports = router;
