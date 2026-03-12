import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface MapSyncEvent {
  id: string;
  lat: number;
  lng: number;
  label: string;
  type: string;
  severity?: string;
  source?: string;
  timestamp?: number;
}

export interface MapBookmark {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  layers: Record<string, boolean>;
  createdAt: number;
}

interface MapSyncContextValue {
  selectedEvent: MapSyncEvent | null;
  selectEvent: (event: MapSyncEvent | null) => void;
  bookmarks: MapBookmark[];
  addBookmark: (bookmark: Omit<MapBookmark, "id" | "createdAt">) => void;
  removeBookmark: (id: string) => void;
  highlightedCoords: { lat: number; lng: number } | null;
  setHighlightedCoords: (coords: { lat: number; lng: number } | null) => void;
}

const BOOKMARKS_KEY = "waros-map-bookmarks";

function loadBookmarks(): MapBookmark[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const MapSyncContext = createContext<MapSyncContextValue | null>(null);

export function MapSyncProvider({ children }: { children: ReactNode }) {
  const [selectedEvent, setSelectedEvent] = useState<MapSyncEvent | null>(null);
  const [bookmarks, setBookmarks] = useState<MapBookmark[]>(loadBookmarks);
  const [highlightedCoords, setHighlightedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const selectEvent = useCallback((event: MapSyncEvent | null) => {
    setSelectedEvent(event);
    if (event) {
      setHighlightedCoords({ lat: event.lat, lng: event.lng });
    }
  }, []);

  const addBookmark = useCallback((bm: Omit<MapBookmark, "id" | "createdAt">) => {
    setBookmarks(prev => {
      const next = [...prev, { ...bm, id: `bm-${Date.now()}`, createdAt: Date.now() }];
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const next = prev.filter(b => b.id !== id);
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <MapSyncContext.Provider value={{
      selectedEvent, selectEvent,
      bookmarks, addBookmark, removeBookmark,
      highlightedCoords, setHighlightedCoords,
    }}>
      {children}
    </MapSyncContext.Provider>
  );
}

const NOOP_CONTEXT: MapSyncContextValue = {
  selectedEvent: null,
  selectEvent: () => {},
  bookmarks: [],
  addBookmark: () => {},
  removeBookmark: () => {},
  highlightedCoords: null,
  setHighlightedCoords: () => {},
};

export function useMapSync() {
  const ctx = useContext(MapSyncContext);
  return ctx ?? NOOP_CONTEXT;
}
