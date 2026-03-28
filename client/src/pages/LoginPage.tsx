import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import BrandMark from '../components/BrandMark';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, senha);
    setLoading(false);

    if (result.success) {
      const papel = result.user?.papel;
      if (papel === 'admin' || papel === 'pastor') navigate('/admin/dashboard');
      else navigate('/dashboard');
    } else {
      setError(result.error || 'Erro ao fazer login');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">
            <BrandMark className="brand-mark brand-mark-login" />
          </div>
          <h1>IBVN</h1>
          <p>Acesse sua area de estudos do Seminario Teologico</p>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(event) => { setEmail(event.target.value); if (emailError) setEmailError(''); }}
              onBlur={(event) => {
                if (event.target.value && !event.target.value.includes('@')) {
                  setEmailError('Digite um e-mail valido.');
                } else {
                  setEmailError('');
                }
              }}
              placeholder="seu@email.com"
              required
            />
            {emailError && <span className="form-helper-text" style={{ color: 'var(--color-error, #ef4444)' }}>{emailError}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <input type="password" className="form-input" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Digite sua senha" required />
          </div>
          <button className="btn btn-accent w-full btn-lg" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="print-hide" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button className="text-link-button" type="button" onClick={() => navigate('/')}>
            <AppIcon name="arrow-left" size={14} />
            <span>Voltar ao site</span>
          </button>
        </div>
      </div>
    </div>
  );
}
