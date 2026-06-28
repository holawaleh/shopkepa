import TopNav from './TopNav'

export default function AppLayout({ children }) {
  return (
    <div className="page">
      <TopNav />
      <main style={{ flex: 1, padding: '20px 0' }}>
        <div className="container">
          {children}
        </div>
      </main>
    </div>
  )
}
