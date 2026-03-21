import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Home, Info, MessageSquare, Radio } from 'lucide-react';
import AppIcon from '../components/AppIcon';
import BrandMark from '../components/BrandMark';
import { NavBar } from '../components/ui/tubelight-navbar';

const leadershipSlides = [
  {
    src: '/brand/1.jpg',
    title: 'Pr. Marcondes'
  },
  {
    src: '/brand/2.jpg',
    title: 'Pra. Allana'
  },
  {
    src: '/brand/3.jpg',
    title: 'Ralfer'
  }
];

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

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    setActiveSlide(0);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % leadershipSlides.length);
    }, 20000);

    return () => window.clearInterval(interval);
  }, []);

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
      description: 'Cultos, mensagens e aulas em video para acompanhamento.',
      href: 'https://www.youtube.com/@igrejavinhanova'
    },
    {
      icon: 'spotify' as const,
      label: 'Spotify',
      value: 'Podcast oficial',
      description: 'Mensagens em audio para escutar ao longo da semana.',
      href: 'https://open.spotify.com/show/3eZVoELHjFGm0OG6lVjWSu'
    }
  ];

  const modules = [
    {
      icon: 'book' as const,
      title: 'Fundamentos da fe',
      description: 'Panorama biblico, doutrinas centrais e base segura para amadurecimento ministerial.'
    },
    {
      icon: 'search' as const,
      title: 'Hermeneutica biblica',
      description: 'Leitura fiel das Escrituras com contexto, interpretacao e aplicacao responsavel.'
    },
    {
      icon: 'shield' as const,
      title: 'Teologia pastoral',
      description: 'Cuidado, lideranca servidora e pratica ministerial para a igreja local.'
    }
  ];

  const platformHighlights = [
    {
      icon: 'play' as const,
      title: 'Aulas por arquivo ou YouTube',
      description: 'O admin pode trabalhar com video local protegido ou com link nao listado do YouTube.'
    },
    {
      icon: 'materials' as const,
      title: 'Materiais e revisao em um lugar',
      description: 'PDFs, resumos, notas, quiz e trilhas organizadas por aula e por modulo.'
    },
    {
      icon: 'target' as const,
      title: 'Acompanhamento pastoral',
      description: 'Presenca, progresso e rotina de estudo organizados com mais clareza para o aluno.'
    }
  ];

  const navItems = [
    { name: 'Inicio', url: '#inicio', icon: Home },
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
          <button className="btn btn-primary btn-sm whitespace-nowrap" onClick={() => navigate('/login')} type="button">
            Area do Aluno
          </button>
        )}
        brand={(
          <div className="nav-brand-link flex min-w-0 items-center gap-3 text-white">
            <BrandMark className="nav-brand-mark h-11 w-11 rounded-xl bg-white p-1 object-contain shadow-[0_12px_24px_rgba(255,255,255,0.12)]" />
            <div className="nav-brand-copy min-w-0">
              <strong className="nav-brand-title block truncate text-lg font-semibold leading-none text-white">IBVN</strong>
              <span className="nav-brand-subtitle block truncate pt-1 text-[11px] uppercase tracking-[0.22em] text-white/55">
                Instituto Biblico Vinha Nova
              </span>
            </div>
          </div>
        )}
        items={navItems}
      />

      <section className="landing-showcase" id="inicio">
        <div className="landing-shell landing-hero-grid landing-hero-grid-phase-one">
          <div className="landing-hero-copy">
            <div className="landing-hero-copy-top">
              <span className="section-kicker">Curso livre e confessional</span>
              <h1>Seminario Teologico do IBVN para formar coracoes, mente biblica e servos fieis.</h1>
              <p className="landing-lead">
                O IBVN, Instituto Biblico Vinha Nova, oferece o Seminario Teologico como um curso livre em teologia,
                confessional, proprio da Vinha e aberto a todos que desejam crescimento biblico serio.
              </p>

              <div className="landing-hero-badges">
                <span className="landing-inline-pill">Nova Friburgo, RJ</span>
                <span className="landing-inline-pill">Seminario da Vinha aberto a todos</span>
                <span className="landing-inline-pill">Aulas online com materiais e progresso salvo</span>
              </div>

              <div className="landing-hero-actions">
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')} type="button">
                  Entrar no seminario
                </button>
                <a className="btn btn-outline btn-lg" href="#trilhas">
                  Ver trilhas
                </a>
              </div>
            </div>

            <div className="landing-hero-quote-card">
              <blockquote>"Teologia de verdade Incendeia o coracao"</blockquote>
              <p>Pr. Ralfer Fernandes</p>
            </div>

            <div className="landing-hero-channel-panel">
              <div className="landing-panel-head landing-panel-head-compact">
                <div>
                  <span className="section-kicker">Canais oficiais</span>
                  <h3>Presenca digital da igreja</h3>
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
              <div className="landing-carousel-visual">
                <img alt={currentSlide.title} className="landing-carousel-image" src={currentSlide.src} />
              </div>

              <div className="landing-carousel-controls">
                <button
                  aria-label="Foto anterior da lideranca"
                  className="player-circle-button"
                  onClick={() => setActiveSlide((current) => (current - 1 + leadershipSlides.length) % leadershipSlides.length)}
                  type="button"
                >
                  <AppIcon name="chevron-left" size={16} />
                </button>

                <div className="landing-carousel-dots">
                  {leadershipSlides.map((slide, index) => (
                    <button
                      aria-label={`Ir para ${slide.title}`}
                      className={`landing-carousel-dot ${index === activeSlide ? 'active' : ''}`}
                      key={slide.title}
                      onClick={() => setActiveSlide(index)}
                      type="button"
                    />
                  ))}
                </div>

                <button
                  aria-label="Proxima foto da lideranca"
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
                  <span>Instituto Biblico Vinha Nova</span>
                </div>
                <div className="landing-mini-stat">
                  <strong>Seminario</strong>
                  <span>Curso oferecido pela Vinha</span>
                </div>
                <div className="landing-mini-stat">
                  <strong>Formato</strong>
                  <span>Online, organizado e pastoral</span>
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
              <span className="section-kicker">Comunicacao oficial</span>
              <h2>Programacao, cartazes e rotina ministerial</h2>
            </div>
            <p>
              Materiais visuais da igreja reunidos na landing para preencher o primeiro contato com mais identidade e movimento.
            </p>
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
            <h2>Um seminario proprio da Vinha, com linguagem pastoral e base biblica</h2>
          </div>
          <p>
            O IBVN apresenta o Seminario Teologico como formacao livre, confessional e aberta a todos, preservando identidade
            ministerial e clareza doutrinaria.
          </p>
        </div>

        <div className="landing-info-grid">
          <div className="landing-info-card">
            <span className="landing-info-icon">
              <AppIcon name="target" size={22} />
            </span>
            <h3>Formacao com identidade</h3>
            <p>Estrutura pensada para membros, obreiros e lideres que desejam crescer em servico e entendimento biblico.</p>
          </div>

          <div className="landing-info-card">
            <span className="landing-info-icon">
              <AppIcon name="shield" size={22} />
            </span>
            <h3>Confessional e pastoral</h3>
            <p>O curso nasce da propria Vinha, com curadoria ministerial e acompanhamento proximo da lideranca local.</p>
          </div>

          <div className="landing-info-card">
            <span className="landing-info-icon">
              <AppIcon name="library" size={22} />
            </span>
            <h3>Organizado para aprender</h3>
            <p>Conteudos, materiais, resumos, notas e acompanhamento de progresso dentro de uma plataforma so.</p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-shell" id="trilhas">
        <div className="landing-section-heading">
          <div>
            <span className="section-kicker">Trilhas do curso</span>
            <h2>Formacao teologica com progressao objetiva</h2>
          </div>
          <p>O percurso do aluno parte dos fundamentos e avanca para leitura biblica fiel e pratica pastoral.</p>
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
              <span className="landing-track-foot">Trilha central do seminario</span>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-shell">
        <div className="landing-feature-band">
          <div className="landing-feature-copy">
            <span className="section-kicker">Experiencia da plataforma</span>
            <h2>Estrutura profissional para estudo, acompanhamento e rotina ministerial</h2>
            <p>
              A primeira fase da plataforma agora valoriza identidade institucional, navegação clara e adaptacao para telas
              pequenas e grandes sem perder leitura nem proporcao.
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
        </div>
      </section>

      <footer className="landing-footer" id="contato">
        <div className="landing-shell footer-content">
          <div className="footer-col">
            <h4>IBVN</h4>
            <p>
              Instituto Biblico Vinha Nova. O Seminario Teologico e o curso oferecido pela igreja com base biblica e
              acompanhamento pastoral.
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
            <h4>Localizacao</h4>
            <p>Igreja Vinha Nova</p>
            <p>Av. Conselheiro Julius Arp, 14</p>
            <p>Olaria, Nova Friburgo - RJ</p>
            <p><a href={mapHref} rel="noreferrer" target="_blank">Abrir no Google Maps</a></p>
          </div>

          <div className="footer-col">
            <h4>Acesso rapido</h4>
            <p>
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/login');
                }}
              >
                Area do aluno
              </a>
            </p>
            <p><a href="#sobre">Sobre o IBVN</a></p>
            <p><a href="#trilhas">Trilhas do curso</a></p>
            <p><a href="#canais">Canais e programacao</a></p>
          </div>
        </div>
        <div className="footer-bottom">© 2026 IBVN - Instituto Biblico Vinha Nova. Todos os direitos reservados.</div>
      </footer>
    </div>
  );
}
