export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="screen-center auth-bg">
      <div className="auth-card">
        <h1 className="auth-card-title">{title}</h1>
        {subtitle && <p className="auth-card-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}
