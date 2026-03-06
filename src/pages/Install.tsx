import { useState, useEffect } from "react";
import { Download, Smartphone, Monitor, Check, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <Link to="/" className="inline-flex items-center gap-2 text-primary text-sm font-mono hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <div className="space-y-2">
          <img src="/pwa-icon-192.png" alt="WAR OS" className="h-20 w-20 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            Install <span className="text-primary">WAR OS</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Get instant access to the intelligence dashboard from your home screen
          </p>
        </div>

        {isStandalone || installed ? (
          <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-success/10 border border-success/30">
            <Check className="h-5 w-5 text-success" />
            <span className="text-success font-semibold">App is installed!</span>
          </div>
        ) : deferredPrompt ? (
          <button
            onClick={handleInstall}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            <Download className="h-5 w-5" />
            Install WAR OS
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Use your browser's install option to add WAR OS to your home screen:
            </p>
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                <Smartphone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">iPhone / iPad</p>
                  <p className="text-xs text-muted-foreground">
                    Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                <Smartphone className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Android</p>
                  <p className="text-xs text-muted-foreground">
                    Tap <strong>⋮ Menu</strong> → <strong>Add to Home Screen</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                <Monitor className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Desktop</p>
                  <p className="text-xs text-muted-foreground">
                    Click the install icon in the address bar
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 text-xs text-muted-foreground">
          <p>✓ Works offline &nbsp; ✓ Fast loading &nbsp; ✓ Real-time updates</p>
        </div>
      </div>
    </div>
  );
};

export default Install;
