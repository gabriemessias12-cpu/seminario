import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Home, Info, MessageSquare, Radio } from 'lucide-react';
import AppIcon from '../components/AppIcon';
import BrandMark from '../components/BrandMark';
import { NavBar } from '../components/ui/tubelight-navbar';
import { VINHA_NOVA_HOME_URL } from '../lib/external-links';

interface LeadershipSlide {
  slot: number;
  name: string;
  url: string;
  objectPosition: string;
}

const posterImages = [
  '/brand/639692652_18107974729765512_7043268077148406277_n.jpg',
  '/brand/639796074_18107974741765512_4844716544406061986_n.jpg',
  '/brand/640145129_18107974759765512_5450936480031065170_n.jpg',
  '/brand/640323976_18107974777765512_5946927021711395555_n.jpg',
  '/brand/640538796_18107974795765512_7088107530002232415_n.jpg',
  '/brand/640550217_18107974804765512_5836174570790180136_n.jpg',
  '/brand/641206195_18107976997765512_4690722954572305517_n.jpg',
  '/brand/641464610_18107976949765512_2159498015526745229_n.jpg'
];

const DEFAULT_SLIDES: LeadershipSlide[] = [
  { slot: 1, url: '/brand/1.jpg', name: 'Pr. Marcondes Gomes', objectPosition: 'center center' },
  { slot: 2, url: '/brand/2.jpg', name: 'Pra. Allana Marques', objectPosition: 'center 45%' },
  { slot: 3, url: '/brand/3.jpg', name: 'Pr. Ralfer Fernandes', objectPosition: 'center 40%' }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeSlide, setActiveSlide] = useState(0);
  const [leadershipSlides, setLeadershipSlides] = useState<LeadershipSlide[]>(DEFAULT_SLIDES);

  useEffect(() => {
    fetch('/api/brand/lideranca')
      .then(r => r.json())
      .then((data: LeadershipSlide[]) => { if (Array.isArray(data) && data.length) setLeadershipSlides(data); })
      .catch(() => { /* keep defaults */ });
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % leadershipSlides.length);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [leadershipSlides.length]);

  const mapHref =
    'https://www.google.com/maps/search/?api=1&query=Igreja+Vinha+Nova+Av.+Conselheiro+Julius+Arp+14+Olaria+Nova+Friburgo+RJ';
  const instagramHref = 'https://www.instagram.com/igrejavinhanova/';

  const channels = [
    {
      icon: 'instagram' as const,
      label: 'Instagram',
      value: '@igrejavinhanova',
      description: 'Bastidores, reels e registros da rotina da igreja.',
      href: instagramHref
    },
    {
      icon: 'facebook' as const,
      label: 'Facebook',
      value: 'Igreja Vinha Nova',
      description: 'Avisos, agenda e comunicados para a comunidade.',
      href: 'https://www.facebook.com/igrejavinhanova/?locale=pt_BR'
    },
    {
      icon: 'youtube' as const,
      label: 'YouTube',
      value: '@igrejavinhanova',
      description: 'Cultos, mensagens e aulas em vídeo para acompanhamento.',
      href: 'https://www.youtube.com/@igrejavinhanova'
    },
    {
      icon: 'spotify' as const,
      label: 'Spotify',
      value: 'Podcast oficial',
      description: 'Mensagens em áudio para escutar ao longo da semana.',
      href: 'https://open.spotify.com/show/3eZVoELHjFGm0OG6lVjWSu'
    }
  ];

  const modules = [
    {
      icon: 'book' as const,
      title: 'Fundamentos da fé',
      description: 'Panorama bíblico, doutrinas centrais e base segura para amadurecimento ministerial.'
    },
    {
      icon: 'search' as const,
      title: 'Hermenêutica bíblica',
      description: 'Leitura fiel das Escrituras com contexto, interpretação e aplicação responsável e balizada no que há de melhor em história e teologia.'
    },
    {
      icon: 'shield' as const,
      title: 'Teologia pastoral',
      description: 'Cuidado, liderança servidora e prática ministerial para a igreja local e para todos os âmbitos da sociedade.'
    }
  ];

  const platformHighlights = [
    {
      icon: 'play' as const,
      title: 'Aulas diretamente na plataforma',
      description: 'O curso conta com a comodidade de ter suas aulas diretamente na plataforma, com progresso salvo para continuar de onde parou.'
    },
    {
      icon: 'materials' as const,
      title: 'Materiais e revisão em um só lugar',
      description: 'PDFs, resumos, notas, quiz e trilhas organizadas por aula e por módulo, além de IA generativa de auxílio ao aluno.'
    },
    {
      icon: 'target' as const,
      title: 'Acompanhamento real de aprendizado',
      description: 'O aluno realmente acessa o conteúdo e faz parte de um ecossistema de avaliações e desenvolvimento pessoal.'
    }
  ];

  const navItems = [
    { name: 'Início', url: '#inicio', icon: Home },
    { name: 'Sobre', url: '#sobre', icon: Info },
    { name: 'Canais', url: '#canais', icon: Radio },
    { name: 'Trilhas', url: '#trilhas', icon: BookOpen },
    { name: 'Contato', url: '#contato', icon: MessageSquare }
  ];

  const currentSlide = leadershipSlides[activeSlide];

  return (
    <div className="landing-root">
      <NavBar
        actionsInline
        actions={(
          <div className="flex items-center gap-2">
            <a
              className="btn btn-outline btn-sm whitespace-nowrap"
              href={VINHA_NOVA_HOME_URL}
              rel="noreferrer"
            >
              Vinha Nova
            </a>
            <button
              className="btn btn-primary btn-sm whitespace-nowrap"
              onClick={() => navigate('/login')}
              type="button"
            >
              Área do Aluno
            </button>
            <button
              className="btn btn-outline btn-sm whitespace-nowrap"
              onClick={() => navigate('/admin/login')}
              style={{ fontSize: '0.75rem', opacity: 0.7 }}
              type="button"
            >
              Admin
            </button>
          </div>
        )}
        brand={(
          <div className="nav-brand-link flex min-w-0 items-center gap-3 text-white">
            <BrandMark className="nav-brand-mark h-11 w-11 rounded-xl bg-white p-1 object-contain shadow-[0_12px_24px_rgba(255,255,255,0.12)]" />
            <div className="nav-brand-copy min-w-0">
              <strong className="nav-brand-title block truncate text-lg font-semibold leading-none text-white">IBVN</strong>
              <span className="nav-brand-subtitle block truncate pt-1 text-[11px] uppercase tracking-[0.22em] text-white/55">
                Instituto Bíblico Vinha Nova
              </span>
            </div>
          </div>
        )}
        items={navItems}
      />

      <section className="landing-showcase" id="inicio">
        <div className="landing-shell landing-hero-grid landing-hero-grid-phase-one">
          <div className="landing-hero-copy">
            <div className="landing-hero-copy-head">
              <span className="section-kicker">Curso livre e confessional</span>
              <h1>O Seminário Teológico do IBVN nasceu para formar corações incendiados, mentes bíblicas e servos fiéis ao Senhor.</h1>
            </div>

            <div className="landing-hero-copy-body">
              <p className="landing-lead">
                O IBVN, Instituto Bíblico Vinha Nova, oferece o Seminário Teológico como um curso livre em teologia,
                confessional, próprio da Vinha, mas aberto a todos que desejam crescimento e conhecimento bíblico sério,
                genuíno e fervoroso.
              </p>

              <div className="landing-hero-badges">
                <span className="landing-inline-pill">Nova Friburgo, RJ</span>
                <span className="landing-inline-pill">O Seminário da Vinha é aberto a todos!</span>
                <span className="landing-inline-pill">Aulas presenciais e online com materiais complementares e progresso salvo</span>
              </div>

              <div className="landing-hero-actions">
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')} type="button">
                  Entrar no seminário
                </button>
                <a className="btn btn-outline btn-lg" href="#trilhas">
                  Ver trilhas
                </a>
                <a
                  className="btn btn-outline btn-lg"
                  href="https://wa.me/5522998338425?text=Tenho%20interesse%20em%20me%20inscrever%20%C3%A0%20vaga%20do%20semin%C3%A1rio%20teol%C3%B3gico!"
                  rel="noreferrer"
                  target="_blank"
                >
                  Fale com a Fábia
                </a>
              </div>
            </div>

            <div className="landing-hero-quote-card">
              <blockquote>"Teologia de verdade incendeia o coração"</blockquote>
              <p>Pr. Ralfer Fernandes</p>
            </div>

            <div className="landing-hero-channel-panel">
              <div className="landing-panel-head landing-panel-head-compact">
                <div>
                  <span className="section-kicker">Canais oficiais</span>
                  <h3>Presença digital da igreja</h3>
                </div>
                <a href={instagramHref} rel="noreferrer" target="_blank">
                  <AppIcon name="external" size={16} />
                </a>
              </div>

              <div className="landing-channel-list landing-channel-list-hero">
                {channels.map((channel) => (
                  <a
                    className="landing-channel-card landing-channel-card-hero"
                    href={channel.href}
                    key={channel.label}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="landing-channel-icon">
                      <AppIcon name={channel.icon} size={18} />
                    </span>
                    <div className="landing-channel-copy">
                      <strong>{channel.label}</strong>
                      <span>{channel.value}</span>
                      <p>{channel.description}</p>
                    </div>
                    <AppIcon name="external" size={16} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="landing-carousel-panel">
            <div className="landing-carousel-card">
              <div className="landing-carousel-visual" style={{ position: 'relative', overflow: 'hidden' }}>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentSlide.url}
                    alt={currentSlide.name}
                    animate={{ opacity: 1 }}
                    className="landing-carousel-image"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                    src={currentSlide.url}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: currentSlide.objectPosition }}
                    transition={{ duration: 0.7, ease: 'easeInOut' }}
                  />
                </AnimatePresence>

                {/* Pastor name overlay */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide.name}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    initial={{ opacity: 0, y: 8 }}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '2rem 1.25rem 1rem',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      letterSpacing: '0.01em'
                    }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  >
                    {currentSlide.name}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="landing-carousel-controls">
                <button
                  aria-label="Foto anterior da liderança"
                  className="player-circle-button"
                  onClick={() => setActiveSlide((current) => (current - 1 + leadershipSlides.length) % leadershipSlides.length)}
                  type="button"
                >
                  <AppIcon name="chevron-left" size={16} />
                </button>

                <div className="landing-carousel-dots">
                  {leadershipSlides.map((slide, index) => (
                    <button
                      aria-label={`Ir para ${slide.name}`}
                      className={`landing-carousel-dot ${index === activeSlide ? 'active' : ''}`}
                      key={slide.name}
                      onClick={() => setActiveSlide(index)}
                      type="button"
                    />
                  ))}
                </div>

                <button
                  aria-label="Próxima foto da liderança"
                  className="player-circle-button"
                  onClick={() => setActiveSlide((current) => (current + 1) % leadershipSlides.length)}
                  type="button"
                >
                  <AppIcon name="chevron-right" size={16} />
                </button>
              </div>

              <div className="landing-mini-stats">
                <div className="landing-mini-stat">
                  <strong>IBVN</strong>
                  <span>Instituto Bíblico Vinha Nova</span>
                </div>
                <div className="landing-mini-stat">
                  <strong>Seminário</strong>
                  <span>Curso oferecido pela Vinha</span>
                </div>
                <div className="landing-mini-stat">
                  <strong>Formato</strong>
                  <span>Inovador, Online e presencial</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-marquee" id="canais">
        <div className="landing-shell">
          <div className="landing-section-heading">
            <div>
              <span className="section-kicker">Comunicação oficial</span>
              <h2>Programação, cartazes e rotina ministerial</h2>
            </div>
          </div>
        </div>

        <div className="landing-marquee landing-poster-marquee">
          <div className="landing-marquee-track landing-poster-track">
            {[...posterImages, ...posterImages].map((posterSrc, index) => (
              <a
                className="landing-poster-card"
                href={instagramHref}
                key={`${posterSrc}-${index}`}
                rel="noreferrer"
                target="_blank"
              >
                <img
                  alt={`Poster oficial ${index + 1}`}
                  className="landing-poster-image"
                  loading="lazy"
                  src={posterSrc}
                />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-shell" id="sobre">
        <div className="landing-section-heading">
          <div>
            <span className="section-kicker">Sobre o instituto</span>
            <h2>Instituto Bíblico Vinha Nova: estudos teológicos abrangentes, bíblicos e apaixonantes</h2>
          </div>
          <p>
            Resgatando o fervor espiritual e o amor pelas Escrituras! Acreditamos em uma teologia completa que tem
            caráter devocional, cultual e acadêmico.
          </p>
        </div>

        <div className="landing-info-grid">
          <div className="landing-info-card">
            <span className="landing-info-icon">
              <AppIcon name="target" size={22} />
            </span>
            <h3>Formação com identidade</h3>
            <p>Estrutura pensada para servir a todos: irmãos em Cristo, membros, obreiros e líderes que desejam crescer em serviço e entendimento bíblico, se apaixonando ainda mais pelas Escrituras.</p>
          </div>

          <div className="landing-info-card">
            <span className="landing-info-icon">
              <AppIcon name="shield" size={22} />
            </span>
            <h3>Confessional e pastoral</h3>
            <p>O curso nasce da própria Vinha, com curadoria ministerial e acompanhamento próximo da liderança local. Ambiente acolhedor, solícito e comprometido com o crescimento de cada aluno.</p>
          </div>

          <div className="landing-info-card">
            <span className="landing-info-icon">
              <AppIcon name="library" size={22} />
            </span>
            <h3>Organizado para aprender</h3>
            <p>Conteúdos e materiais abrangentes e profundos, resumos, notas e acompanhamento de progresso dentro de uma plataforma completa para o aluno.</p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-shell" id="trilhas">
        <div className="landing-section-heading">
          <div>
            <span className="section-kicker">Trilhas do curso</span>
            <h2>Formação teológica com progressão clara e objetiva</h2>
          </div>
          <p>O percurso do aluno parte dos fundamentos e avança para a leitura bíblica fiel e a vivência ministerial e pessoal.</p>
        </div>

        <div className="landing-track-grid">
          {modules.map((module, index) => (
            <article className="landing-track-card" key={module.title}>
              <div className="landing-track-head">
                <span className="landing-track-index">0{index + 1}</span>
                <span className="landing-info-icon">
                  <AppIcon name={module.icon} size={20} />
                </span>
              </div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <span className="landing-track-foot">Trilha central do seminário</span>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-shell">
        <div className="landing-section-heading">
          <div>
            <span className="section-kicker">Experiência da plataforma</span>
            <h2>Estrutura profissional para estudo com acompanhamento de progresso</h2>
          </div>
          <p>
            A plataforma tem navegação clara e adaptação para telas pequenas e grandes sem perder leitura nem proporção,
            facilitando o uso em computadores, tablets, celulares e até televisores.
          </p>
        </div>

        <div className="landing-feature-grid">
          {platformHighlights.map((item) => (
            <article className="landing-feature-card" key={item.title}>
              <span className="landing-info-icon">
                <AppIcon name={item.icon} size={20} />
              </span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer" id="contato">
        <div className="landing-shell footer-content">
          <div className="footer-col">
            <h4>IBVN</h4>
            <p>
              Instituto Bíblico Vinha Nova oferece um seminário teológico de formação livre, abrangente, bíblico e
              apaixonante! Resgatando o fervor espiritual e o amor pelas Escrituras.
            </p>
          </div>

          <div className="footer-col">
            <h4>Canais oficiais</h4>
            <p><a href={instagramHref} rel="noreferrer" target="_blank">Instagram</a></p>
            <p><a href="https://www.facebook.com/igrejavinhanova/?locale=pt_BR" rel="noreferrer" target="_blank">Facebook</a></p>
            <p><a href="https://www.youtube.com/@igrejavinhanova" rel="noreferrer" target="_blank">YouTube</a></p>
            <p><a href="https://open.spotify.com/show/3eZVoELHjFGm0OG6lVjWSu" rel="noreferrer" target="_blank">Spotify</a></p>
          </div>

          <div className="footer-col">
            <h4>Localização</h4>
            <p>Igreja Vinha Nova</p>
            <p>Av. Conselheiro Julius Arp, 14</p>
            <p>Olaria, Nova Friburgo - RJ</p>
            <p><a href={mapHref} rel="noreferrer" target="_blank">Abrir no Google Maps</a></p>
          </div>

          <div className="footer-col">
            <h4>Acesso rápido</h4>
            <p>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>
                Área do aluno
              </a>
            </p>
            <p>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/admin/login'); }}>
                Acesso administrativo
              </a>
            </p>
            <p><a href="#sobre">Sobre o IBVN</a></p>
            <p><a href="#trilhas">Trilhas do curso</a></p>
            <p><a href="#canais">Inscrições e programação</a></p>
          </div>
        </div>
        <div className="footer-cta">
          <div>
            <strong>Garanta sua vaga no Seminário</strong>
            <span>Entre em contato com a Fábia para fazer sua inscrição</span>
          </div>
          <a className="btn btn-primary btn-sm" href="https://wa.me/5522998338425?text=Tenho%20interesse%20em%20me%20inscrever%20%C3%A0%20vaga%20do%20semin%C3%A1rio%20teol%C3%B3gico!" rel="noreferrer" target="_blank">
            Fale com a Fábia
          </a>
        </div>
        <div className="footer-bottom">© 2026 IBVN · Instituto Bíblico Vinha Nova. Todos os direitos reservados.</div>
      </footer>
    </div>
  );
}
