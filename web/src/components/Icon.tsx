const P: Record<string, string> = {
  makan: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8.5 7.5c0-1.6 1-1.6 1-3.2M12 7.5c0-1.6 1-1.6 1-3.2M15.5 7.5c0-1.6 1-1.6 1-3.2"/>',
  dapur: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  jalan: '<path d="M5 12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12"/><rect x="3" y="12" width="18" height="5.5" rx="1.6"/><path d="M6.5 17.5V20M17.5 17.5V20"/>',
  bil: '<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/>',
  diri: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  lain: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  tugas: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.4 1.4L7.5 5M3.5 12l1.4 1.4L7.5 11M3.5 18l1.4 1.4L7.5 17"/>',
  belanja: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M16 13h2"/><path d="M6 6V5.5A2.5 2.5 0 0 1 8.5 3H17"/>',
  cukai: '<path d="M6 3h9l4 4v14H6Z"/><path d="M15 3v4h4"/><path d="M9 12h6M9 16h4"/>',
  akaun: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>',
  users: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.5a3 3 0 0 1 0 5.5M17.5 19a5.5 5.5 0 0 0-2-4.2"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
};

export function Icon({ name, size = 18, stroke = 1.9, className }: { name: string; size?: number; stroke?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[name] ?? '' }} />
  );
}
