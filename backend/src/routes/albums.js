// albums.js

const express = require('express');
const axios = require('axios');

const ensureAuth = require('../middleware/ensureAuth');
const oauth2Client = require('../oauth/google');

const router = express.Router();

router.get('/albums', ensureAuth, async (req, res) => {
    // FIX: fetch a fresh token before calling Library API
    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
        return res.redirect('/auth/google');
    }

    try {
        const { data } = await axios.get(
            'https://photoslibrary.googleapis.com/v1/albums',
            { headers: { Authorization: `Bearer ${token}` }}
        );
        const albums = data.albums || [];
        return res.send(`
          <h1>Your Google Photos Albums</h1>
          <ul>
            ${albums
              .map(
                (a) =>
                  `<li>
                     <strong>${a.title}</strong><br/>
                     ID: <code>${a.id}</code><br/>
                     <a href="/api/album/${a.id}">View photos in this album</a>
                   </li>`
              )
              .join('')}
          </ul>
        `);
    }
    catch (error) {
        console.error('Album List Failed', error);
        return res.status(500).send(`<pre>${JSON.stringify(error.response?.data, null, 2)}</pre>`);
    }

});

router.get('/api/album/:albumId', ensureAuth, async (req, res) => {
  const albumId = req.params.albumId;

  try {
    // FIX: fetch a fresh token before calling Library API
    const { token } = await oauth2Client.getAccessToken();
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { data } = await axios.post(
      'https://photoslibrary.googleapis.com/v1/mediaItems:search',
      { albumId, pageSize: 100 },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return res.json(data.mediaItems || []);
  } catch (err) {
    console.error('MediaItems.search failed:', err.response?.status, err.response?.data);
    return res.status(err.response?.status || 500).json({ error: err.response?.data?.error?.message });
  }
});

// (Optional) helper left as-is: fetch albums using a provided token (not used directly now)
async function getAlbums(accessToken) {
    try {
        const response = await axios.get(
            'https://photoslibrary.googleapis.com/v1/albums',
            {
                headers : {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );
        return response.data.albums || [];
    }
    catch (error) {
        console.error('Status: ', error.response?.status);
        console.error('Body: ', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
}

module.exports = router;
