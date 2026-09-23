/** Re-mounts on every navigation, giving the design's short fade between pages. */
export default function StoreTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
