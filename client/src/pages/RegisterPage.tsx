import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AppIcon from '../components/AppIcon';
import BrandMark from '../components/BrandMark';
import { apiPost } from '../lib/apiClient';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [membroVinha, setMembroVinha] = useState(false);
  const [batizado, setBatizado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const data = await apiPost<{ message?: string }>('/api/auth/cadastro', {
        nome,
        email,
        senha,
        dataNascimento,
        membroVinha,
        batizado
      });

      setSuccess(data.message || 'Cadastro enviado com sucesso. Aguarde aprovacao do administrador.');
      setNome('');
      setEmail('');
      setSenha('');
      setDataNascimento('');
      setMembroVinha(false);
      setBatizado(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel enviar seu cadastro agora.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <div className="login-logo">
          <div className="logo-circle">
            <BrandMark className="brand-mark brand-mark-login" />
          </div>
          <h1>Cadastro de Aluno</h1>
          <p>Crie sua conta e aguarde aprovacao da administracao do seminario.</p>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}
        {success && <div className="inline-feedback success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nome completo</label>
            <input className="form-input" value={nome} onChange={(event) => setNome(event.target.value)} required minLength={3} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Data de nascimento</label>
              <input className="form-input" type="date" value={dataNascimento} onChange={(event) => setDataNascimento(event.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input className="form-input" type="password" value={senha} onChange={(event) => setSenha(event.target.value)} required minLength={6} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Membro da Vinha Nova?</label>
              <select className="form-input" value={membroVinha ? 'sim' : 'nao'} onChange={(event) => setMembroVinha(event.target.value === 'sim')}>
                <option value="nao">Nao</option>
                <option value="sim">Sim</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Batizado?</label>
              <select className="form-input" value={batizado ? 'sim' : 'nao'} onChange={(event) => setBatizado(event.target.value === 'sim')}>
                <option value="nao">Nao</option>
                <option value="sim">Sim</option>
              </select>
            </div>
          </div>

          <button className="btn btn-accent w-full btn-lg" type="submit" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar cadastro'}
          </button>
        </form>

        <div className="print-hide" style={{ textAlign: 'center', marginTop: '1.25rem', display: 'grid', gap: '0.5rem' }}>
          <button className="text-link-button" type="button" onClick={() => navigate('/login')}>
            <AppIcon name="arrow-left" size={14} />
            <span>Voltar para o login</span>
          </button>
          <button className="text-link-button" type="button" onClick={() => navigate('/')}>
            <span>Voltar ao site</span>
          </button>
        </div>
      </div>
    </div>
  );
}
