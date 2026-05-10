import { useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

export default function QueuePanel() {
  const {
    queue, queueIndex, currentTrack, isPlaying,
    removeFromQueue, moveInQueue, playTrack, togglePlay, toggleQueue, clearQueue
  } = usePlayer();
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const upNext = queue.slice(queueIndex + 1);

  const handleDragStart = (idx) => { dragItem.current = idx; };
  const handleDragEnter = (idx) => { dragOver.current = idx; };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOver.current !== null && dragItem.current !== dragOver.current) {
      moveInQueue(dragItem.current, dragOver.current);
    }
    dragItem.current = null;
    dragOver.current = null;
  };

  return (
    <div className="w-[340px] shrink-0 bg-neutral-900 rounded-lg flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="font-bold text-lg">Queue</h2>
        <div className="flex items-center gap-1">
          {queue.length > 0 && (
            <button onClick={clearQueue} title="Clear queue"
              className="text-xs text-neutral-400 hover:text-red-400 px-2 py-1 rounded transition-colors">
              Clear
            </button>
          )}
          <button onClick={toggleQueue} className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-800">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-2 pb-4 queue-scroll">
        {currentTrack && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-2">Now Playing</p>
            <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-white/10">
              <img src={currentTrack.thumbnail} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded object-cover bg-neutral-800 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-green-500">{currentTrack.title}</div>
                <div className="text-xs text-neutral-400 truncate">{currentTrack.artist}</div>
              </div>
              <div className="flex items-center gap-[3px] h-4 shrink-0">
                {isPlaying && <>
                  <span className="w-[3px] bg-green-500 rounded-sm eq-bar inline-block" />
                  <span className="w-[3px] bg-green-500 rounded-sm eq-bar inline-block" />
                  <span className="w-[3px] bg-green-500 rounded-sm eq-bar inline-block" />
                </>}
              </div>
            </div>
          </div>
        )}

        {upNext.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-2 mb-2">
              Next Up <span className="text-neutral-500 normal-case">· {upNext.length} tracks</span>
            </p>
            {upNext.map((track, i) => {
              const realIdx = queueIndex + 1 + i;
              return (
                <div
                  key={`${track.videoId}-${realIdx}`}
                  draggable
                  onDragStart={() => handleDragStart(realIdx)}
                  onDragEnter={() => handleDragEnter(realIdx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => { playTrack(track, queue); }}
                  className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer group hover:bg-white/[0.06] transition-colors"
                >
                  <div className="w-5 text-center text-xs text-neutral-500 shrink-0 cursor-grab active:cursor-grabbing">
                    <svg className="w-3.5 h-3.5 mx-auto opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z" />
                    </svg>
                    <span className="group-hover:hidden">{i + 1}</span>
                  </div>
                  <img src={track.thumbnail} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded object-cover bg-neutral-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{track.title}</div>
                    <div className="text-xs text-neutral-400 truncate">{track.artist}</div>
                  </div>
                  <span className="text-xs text-neutral-500 shrink-0">{fmt(track.duration)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFromQueue(realIdx); }}
                    className="p-1 rounded-full text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-white transition-all shrink-0"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!currentTrack && upNext.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
            <svg className="w-12 h-12 mb-3 text-neutral-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
            </svg>
            <p className="text-sm">Queue is empty</p>
            <p className="text-xs text-neutral-600 mt-1">Play something to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
