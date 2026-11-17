import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section>
      <h1>Halaman tidak ditemukan</h1>
      <Link to="/dashboard">Kembali ke dashboard</Link>
    </section>
  )
}
