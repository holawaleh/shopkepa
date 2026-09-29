import TopNav, { RAIL_WIDTH, OFFLINE_BANNER_HEIGHT } from './TopNav'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export default function AppLayout({ children }) {
  const isOnline = useOnlineStatus()
  const offlineOffset = isOnline ? 0 : OFFLINE_BANNER_HEIGHT

  return (
    <div className="page">
      <TopNav />
      <main className="app-main" style={{ flex: 1, padding: '20px 0', paddingTop: 20 + offlineOffset }}>
        <div className="container">
          {children}
        </div>
      </main>

      <style>{`
        .app-main { margin-left: ${RAIL_WIDTH}px; }
        @media (max-width: 768px) {
          .app-main { margin-left: 0; padding-top: ${64 + offlineOffset}px !important; }
        }
      `}</style>
    </div>
  )
}
