export function AssessmentAudioPlayer({ src, label }: { src: string; label: string }) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-sm font-medium">{label}</p>
      <audio controls preload="metadata" src={src} className="w-full">
        <track kind="captions" />
      </audio>
    </div>
  );
}
