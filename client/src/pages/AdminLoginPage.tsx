import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';
import BrandMark from '../components/BrandMark';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, senha);
    setLoading(false);

    if (result.success) navigate('/admin/dashboard');
    else setError(result.error || 'Credenciais invalidas');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">
            <BrandMark className="brand-mark brand-mark-login" />
          </div>
          <h1>Administracao</h1>
          <p>Acesso restrito do IBVN - Instituto Biblico Vinha Nova</p>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">E-mail administrativo</label>
            <input type="email" className="form-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Insira seu e-mail" required />
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <input type="password" className="form-input" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Digite sua senha" required />
          </div>
          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
            {loading ? 'Verificando...' : 'Acessar painel'}
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
