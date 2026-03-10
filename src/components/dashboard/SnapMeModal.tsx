import { useState, useRef, useCallback } from "react";
import { X, Upload, Camera, MapPin, Loader2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

interface SnapLocation {
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  confidence: number;
  reasoning: string;
}

interface SnapMeModalProps {
  onClose: () => void;
  onPinLocation: (lat: number, lng: number, name: string, reasoning: string) => void;
}

export const SnapMeModal = ({ onClose, onPinLocation }: SnapMeModalProps) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<SnapLocation[]>([]);
  const [overallAnalysis, setOverallAnalysis] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setError(null);
    setLocations([]);
    setOverallAnalysis("");
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const analyze = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("snap-locate", {
        body: { image_base64: imageBase64, mime_type: mimeType },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      setLocations(data.locations || []);
      setOverallAnalysis(data.overall_analysis || "");
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.8) return "text-green-400";
    if (c >= 0.5) return "text-amber-400";
    return "text-red-400";
  };

  const confidenceBarColor = (c: number) => {
    if (c >= 0.8) return "bg-green-500";
    if (c >= 0.5) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-card border border-border rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ boxShadow: "0 0 40px hsl(190 100% 50% / 0.1)" }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/95">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            <span className="font-mono text-sm font-bold text-foreground tracking-wider">SNAP ME — AI GEOLOCATION</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Left — Upload */}
            <div className="space-y-3">
              <div
                ref={dropRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all min-h-[280px] ${
                  imagePreview
                    ? "border-primary/30 bg-secondary/20"
                    : "border-border hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                />
                {imagePreview ? (
                  <img src={imagePreview} alt="Uploaded" className="max-h-[300px] rounded object-contain" />
                ) : (
                  <div className="text-center space-y-2 p-6">
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto" />
                    <p className="text-sm font-mono text-muted-foreground">Drop image or click to upload</p>
                    <p className="text-[10px] text-muted-foreground/60">JPG, PNG, WEBP</p>
                  </div>
                )}
              </div>

              {imagePreview && !loading && locations.length === 0 && (
                <Button onClick={analyze} className="w-full gap-2 font-mono text-xs">
                  <Target className="h-3.5 w-3.5" />
                  ANALYZE LOCATION
                </Button>
              )}

              {imagePreview && (
                <button
                  onClick={() => { setImagePreview(null); setImageBase64(null); setLocations([]); setOverallAnalysis(""); setError(null); }}
                  className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  ✕ Clear image
                </button>
              )}

              {loading && (
                <div className="flex items-center gap-2 text-sm text-primary font-mono">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing visual cues…
                </div>
              )}

              {error && (
                <div className="text-xs font-mono text-destructive bg-destructive/10 border border-destructive/30 rounded p-2">
                  {error}
                </div>
              )}
            </div>

            {/* Right — Results */}
            <div className="space-y-3">
              {overallAnalysis && (
                <div className="rounded border border-border/50 bg-secondary/30 p-3">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">AI Analysis</p>
                  <p className="text-xs text-foreground leading-relaxed">{overallAnalysis}</p>
                </div>
              )}

              {locations.map((loc, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-2 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-mono font-bold text-foreground">{loc.name}</p>
                        <p className="text-[10px] text-muted-foreground">{loc.city}, {loc.country}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-mono font-bold ${confidenceColor(loc.confidence)}`}>
                      {Math.round(loc.confidence * 100)}%
                    </span>
                  </div>

                  {/* Confidence bar */}
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${confidenceBarColor(loc.confidence)}`}
                      style={{ width: `${loc.confidence * 100}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-muted-foreground leading-relaxed">{loc.reasoning}</p>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] font-mono gap-1"
                    onClick={() => {
                      onPinLocation(loc.lat, loc.lng, loc.name, loc.reasoning);
                      onClose();
                    }}
                  >
                    <MapPin className="h-2.5 w-2.5" /> PIN ON MAP
                  </Button>
                </div>
              ))}

              {!loading && locations.length === 0 && !error && (
                <div className="flex items-center justify-center h-full min-h-[200px] text-muted-foreground">
                  <p className="text-xs font-mono text-center">Upload a photo to identify<br />possible locations</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
