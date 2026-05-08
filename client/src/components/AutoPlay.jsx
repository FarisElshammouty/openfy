import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { usePlayer } from '../context/PlayerContext';

export default function AutoPlay() {
  const { videoId } = useParams();
  const { playTrack } = usePlayer();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoId) return;
    api.suggestions(videoId)
      .then(tracks => {
        const track = tracks.find(t => t.videoId === videoId) || tracks[0];
        if (track) {
          playTrack({ ...track, videoId }, tracks);
        } else {
          playTrack({ videoId, title: '', artist: '', thumbnail: '', duration: 0 });
        }
        navigate('/', { replace: true });
      })
      .catch(() => {
        playTrack({ videoId, title: '', artist: '', thumbnail: '', duration: 0 });
        navigate('/', { replace: true });
      });
  }, [videoId]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-neutral-400">{error || 'Loading track...'}</div>
    </div>
  );
}
