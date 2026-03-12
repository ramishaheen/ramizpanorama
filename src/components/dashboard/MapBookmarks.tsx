import { useState } from "react";
import { Bookmark, BookmarkPlus, X, MapPin, Trash2 } from "lucide-react";
import { useMapSync, type MapBookmark } from "@/hooks/useMapSync";

interface MapBookmarksProps {
  currentLat: number;
  currentLng: number;
  currentZoom: number;
  currentLayers: Record<string, boolean>;
  onGoTo: (lat: number, lng: number, zoom: number, layers: Record<string, boolean>) => void;
}

export const MapBookmarks = ({ currentLat, currentLng, currentZoom, currentLayers, onGoTo }: MapBookmarksProps) => {
  const { bookmarks, addBookmark, removeBookmark } = useMapSync();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    addBookmark({ name: name.trim(), lat: currentLat, lng: currentLng, zoom: currentZoom, layers: currentLayers });
    setName("");
    setNaming(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-card/90 backdrop-blur-xl shadow-lg hover:bg-secondary/50 transition-all"
        title="Map Bookmarks"
      >
        <Bookmark className="h-3 w-3 text-primary" />
        <span className="text-[9px] font-mono text-foreground/80 uppercase tracking-wider font-semibold">
          Views {bookmarks.length > 0 && `(${bookmarks.length})`}
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 right-0 w-56 rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[1001]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
            <span className="text-[10px] font-mono font-bold text-foreground/80 uppercase tracking-wider">Saved Views</span>
            <button onClick={() => setNaming(true)} className="p-1 rounded hover:bg-secondary/50 transition-colors" title="Save current view">
              <BookmarkPlus className="h-3.5 w-3.5 text-primary" />
            </button>
          </div>

          {naming && (
            <div className="px-3 py-2 border-b border-border/30 flex gap-1.5">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
                placeholder="View name..."
                className="flex-1 bg-secondary/50 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground outline-none"
                autoFocus
              />
              <button onClick={handleSave} className="px-2 py-1 bg-primary/20 border border-primary/30 rounded text-[9px] font-mono text-primary hover:bg-primary/30">Save</button>
              <button onClick={() => setNaming(false)} className="p-1 rounded hover:bg-secondary/50">
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          )}

          <div className="max-h-48 overflow-y-auto">
            {bookmarks.length === 0 && (
              <div className="px-3 py-4 text-center text-[9px] font-mono text-muted-foreground">No saved views yet</div>
            )}
            {bookmarks.map(bm => (
              <div
                key={bm.id}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/30 transition-colors cursor-pointer border-b border-border/20 last:border-0 group"
                onClick={() => { onGoTo(bm.lat, bm.lng, bm.zoom, bm.layers); setOpen(false); }}
              >
                <MapPin className="h-3 w-3 text-primary/60 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono text-foreground/80 truncate">{bm.name}</div>
                  <div className="text-[8px] font-mono text-muted-foreground">{bm.lat.toFixed(2)}°, {bm.lng.toFixed(2)}° · z{bm.zoom}</div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeBookmark(bm.id); }}
                  className="p-1 rounded hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3 text-destructive/60" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
