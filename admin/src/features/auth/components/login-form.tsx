import { ArrowRight, Lock, Loader2, User } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { queryClient } from '@/app/query-client'
import { ApiError } from '@/lib/api-client'
import { authApi } from '@/features/auth/api/auth.api'
import { authQueryKey } from '@/features/auth/hooks/use-current-user'

const schema = z.object({
  username: z.string().min(3, 'Username minimal 3 karakter'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const nav = useNavigate()
  const location = useLocation()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (result) => {
      queryClient.setQueryData(authQueryKey, result.user)
      const from = (location.state as { from?: string } | null)?.from || '/dashboard'
      nav(from, { replace: true })
    },
  })

  const error = mutation.error instanceof ApiError ? mutation.error.message : ''

  return (
    <form
      onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        marginTop: '2rem',
        width: '100%',
      }}
    >
      {/* Username Field */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <label
          htmlFor="admin-username"
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <User size={15} color="#64748b" />
          Username Akun
        </label>
        <input
          id="admin-username"
          type="text"
          autoFocus
          autoComplete="username"
          placeholder="Masukkan username admin"
          {...form.register('username')}
          style={{
            width: '100%',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            border: form.formState.errors.username ? '1px solid #ef4444' : '1px solid #cbd5e1',
            background: '#ffffff',
            fontSize: '14px',
            color: '#0f172a',
            outline: 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}
        />
        {form.formState.errors.username && (
          <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
            {form.formState.errors.username.message}
          </span>
        )}
      </div>

      {/* Password Field */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <label
          htmlFor="admin-password"
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <Lock size={15} color="#64748b" />
          Kata Sandi
        </label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          {...form.register('password')}
          style={{
            width: '100%',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            border: form.formState.errors.password ? '1px solid #ef4444' : '1px solid #cbd5e1',
            background: '#ffffff',
            fontSize: '14px',
            color: '#0f172a',
            outline: 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}
        />
        {form.formState.errors.password && (
          <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>
            {form.formState.errors.password.message}
          </span>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            color: '#991b1b',
            fontSize: '13px',
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      {/* Submit Action */}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="btn btn-primary"
        style={{
          width: '100%',
          padding: '0.85rem 1.25rem',
          fontSize: '14px',
          fontWeight: 700,
          borderRadius: '10px',
          background: '#0037b0',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          boxShadow: '0 2px 10px rgba(0, 55, 176, 0.25)',
          marginTop: '0.5rem',
          transition: 'all 0.15s ease',
        }}
      >
        {mutation.isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Memverifikasi akun...</span>
          </>
        ) : (
          <>
            <span>Masuk ke Dashboard</span>
            <ArrowRight size={16} />
          </>
        )}
      </button>
    </form>
  )
}
