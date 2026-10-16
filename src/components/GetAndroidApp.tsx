import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { isNative } from '@/lib/native';
import { isStandalone } from '@/lib/push';

const APK_URL = '/downloads/edge-blast.apk';

/** "Edge Blast for Android" card for the sign-in page; it appears once the APK is on the site. */
export const GetAndroidApp = () => {
  const [apk, setApk] = useState(false);
  const installed = isStandalone();

  useEffect(() => {
    // the button only appears when the file is really there (a missing file would otherwise download a web page)
    fetch(APK_URL, { method: 'HEAD' })
      .then((r) => setApk(r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')))
      .catch(() => setApk(false));
  }, []);

  if (installed || isNative() || !apk) return null;

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
          <Smartphone className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight">Edge Blast for Android</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Your journal as an app, with trade alerts.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {apk && (
          <a
            href={APK_URL}
            download="EdgeBlast.apk"
            onClick={() => toast('When Android asks, allow installs from this browser.')}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-primary text-[15px] font-semibold text-primary-foreground"
          >
            <Download className="size-4" /> Download the app
          </a>
        )}
      </div>
    </div>
  );
};
