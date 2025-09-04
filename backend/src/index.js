import express from 'express';

const app = express();

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        ok: true
    });
});

// Gallery route (static JSON for now)
app.get('/api/gallery', (req, res) => {
  const sample = {
    items: [
      {
        id: '1',
        src: '/Users/jamesyim/Desktop/TheRepository/TylerLawPortfolio/data/Tlawpfp.jpg',
        alt: 'Placeholder image',
        caption: 'Example caption'
      },
      {
        id: '2',
        src: '/Users/jamesyim/Desktop/TheRepository/TylerLawPortfolio/data/Tlawpfp_2.jpg',
        alt: 'Another placeholder',
        caption: 'Second example'
      }
    ]
  };
  res.json(sample);
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
