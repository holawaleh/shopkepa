import { Lock, Sparkles, BarChart2, MessageSquare, TrendingUp } from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'

const FEATURES = [
  { icon: MessageSquare, title: 'Ask your business anything', desc: 'Query your sales, stock, and customer data in plain English.' },
  { icon: BarChart2,     title: 'AI-powered insights',        desc: 'Get automated analysis of trends, slow-moving stock, and top customers.' },
  { icon: TrendingUp,    title: 'Profit forecasting',         desc: 'Predict next week\'s revenue based on historical patterns.' },
]

export default function AIPage() {
  return (
    <AppLayout>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: '0 auto 24px',
          background: 'linear-gradient(135deg, rgba(201,168,76,0.2), rgba(100,120,200,0.15))',
          border: '1px solid rgba(201,168,76,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={32} color="var(--gold)" />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--light)', marginBottom: 8 }}>
          ShopKepa AI Assistant
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 32, lineHeight: 1.6 }}>
          Intelligent business insights powered by AI — ask questions, spot trends,
          and get actionable recommendations from your own data.
        </p>

        {/* Feature cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36, textAlign: 'left' }}>
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} style={{
              background: 'var(--blue)', border: '1px solid var(--mid)', borderRadius: 10,
              padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', opacity: 0.7,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: 'rgba(201,168,76,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={16} color="var(--gold)" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--light)', marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Premium badge */}
        <div style={{
          background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 12, padding: '20px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={16} color="var(--gold)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>
              Available on Premium Services
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
            Upgrade your ShopKepa plan to unlock AI-powered business intelligence.
            Contact us to learn more about Premium.
          </p>
          <a
            href="mailto:support@shopkepa.com"
            style={{
              marginTop: 4, padding: '9px 24px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: 'var(--gold)', color: '#000', textDecoration: 'none', display: 'inline-block',
            }}
          >
            Contact us to upgrade
          </a>
        </div>

      </div>
    </AppLayout>
  )
}
