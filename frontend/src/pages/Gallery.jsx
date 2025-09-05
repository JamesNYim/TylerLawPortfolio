import { useEffect, useState } from 'react';

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gallery')
      .then(res => res.json())
      .then(data => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Gallery</h2>
      <div style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
      }}>
        {items.map(item => (
          <figure key={item.id}>
            <img src={item.src} alt={item.alt} style={{ width: '100%' }} />
            <figcaption>{item.caption}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

