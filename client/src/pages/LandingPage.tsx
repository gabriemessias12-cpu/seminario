import { useNavigate } from 'react-router-dom';
import { Home, Info, Radio, BookOpen, MessageSquare } from 'lucide-react';
import AppIcon from '../components/AppIcon';
import BrandMark from '../components/BrandMark';
import { NavBar } from '../components/ui/tubelight-navbar';

export default function LandingPage() {
  const navigate = useNavigate();

  const mapHref =
    'https://www.google.com/maps/search/?api=1&query=Igreja+Vinha+Nova+Av.+Conselheiro+Julius+Arp+14+Olaria+Nova+Friburgo+RJ';
  const instagramHref = 'https://www.instagram.com/igrejavinhanova/';
  const pastorImage = '/brand/640168775_1325847979577938_8068962447801549365_n.jpg';

  const channels = [
    {
      icon: 'instagram' as const,
      label: 'Instagram',
      value: '@igrejavinhanova',
      description: 'Fotos, bastidores, reels e registros recentes da igreja.',
      href: instagramHref
    },
    {
      icon: 'facebook' as const,
      label: 'Facebook',
      value: 'Igreja Vinha Nova',
      description: 'Agenda, comunicados e publicacoes para a comunidade.',
      href: 'https://www.facebook.com/igrejavinhanova/?locale=pt_BR'
    },
    {
      icon: 'youtube' as const,
      label: 'YouTube',
      value: '@igrejavinhanova',
      description: 'Mensagens, cultos e conteudos em video para acompanhamento.',
      href: 'https://www.youtube.com/@igrejavinhanova'
    },
    {
      icon: 'spotify' as const,
      label: 'Spotify',
      value: 'Podcast oficial',
      description: 'Mensagens em audio para escutar durante a rotina.',
      href: 'https://open.spotify.com/show/3eZVoELHjFGm0OG6lVjWSu'
    },
    {
      icon: 'map-pin' as const,
      label: 'Localizacao',
      value: 'Nova Friburgo, RJ',
      description: 'Av. Conselheiro Julius Arp, 14 - Olaria.',
      href: mapHref
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
    '/brand/641464610_18107976949765512_2159498015526745229_n.jpg',
    '/brand/641764073_18107974786765512_4460209723187305606_n.jpg',
    '/brand/641769987_18107974822765512_8550864090941876820_n.jpg',
    '/brand/641778301_18107974750765512_4574876543691194200_n.jpg',
    '/brand/641779046_18107974813765512_3068626871401409719_n.jpg',
    '/brand/641791246_18107974720765512_2515264276541824227_n.jpg',
    '/brand/641807987_18107976967765512_8298767306800052205_n.jpg',
    '/brand/641849255_18107974831765512_6415746180839918516_n.jpg',
    '/brand/642422112_18107974768765512_653821627177463341_n.jpg'
  ];

  const modules = [
    {
      icon: 'book' as const,
      title: 'Fundamentos da fe',
      description: 'Doutrinas centrais, panorama biblico e base segura para formacao ministerial.'
    },
    {
      icon: 'search' as const,
      title: 'Hermeneutica biblica',
      description: 'Leitura fiel das Escrituras, exegese, contexto e criterios de interpretacao.'
    },
    {
      icon: 'shield' as const,
      title: 'Teologia pastoral',
      description: 'Cuidado ministerial, lideranca servidora e aplicacao pratica na igreja local.'
    }
  ];

  const pillars = [
    {
      icon: 'target' as const,
      title: 'Identidade ministerial',
      description: 'Formacao pensada para obreiros, lideres e membros que desejam servir com clareza biblica.'
    },
    {
      icon: 'shield' as const,
      title: 'Conducao pastoral',
      description: 'Curadoria e acompanhamento do seminario com responsabilidade pastoral sob a lideranca do Pastor Ralf.'
    },
    {
      icon: 'library' as const,
      title: 'Jornada organizada',
      description: 'Aulas, materiais, resumos, perguntas e progresso em uma plataforma unica.'
    }
  ];

  const platformHighlights = [
    {
      icon: 'play' as const,
      title: 'Aulas com progresso salvo',
      description: 'O aluno retoma exatamente de onde parou e acompanha o desbloqueio dos quizzes.'
    },
    {
      icon: 'materials' as const,
      title: 'Materiais centralizados',
      description: 'PDFs, anexos e recursos reunidos por aula para consulta durante o estudo.'
    },
    {
      icon: 'quiz' as const,
      title: 'Revisao guiada',
      description: 'Questionarios e resumo para consolidar o aprendizado com mais profundidade.'
    }
  ];

  const navItems = [
    { name: 'Inicio', url: '#inicio', icon: Home },
    { name: 'Sobre', url: '#sobre', icon: Info },
    { name: 'Canais', url: '#canais', icon: Radio },
    { name: 'Trilhas', url: '#trilhas', icon: BookOpen },
    { name: 'Contato', url: '#contato', icon: MessageSquare }
  ];

  return (
    <div className="landing-root">
      <NavBar
        items={navItems}
        actionsInline
        brand={(
          <div className="flex items-center gap-3 text-white">
            <BrandMark className="h-11 w-11 rounded-xl bg-white p-1 object-contain shadow-[0_12px_24px_rgba(255,255,255,0.12)]" />
            <div className="min-w-0">
              <strong className="block truncate text-lg font-semibold leading-none text-white">Igreja Vinha Nova</strong>
              <span className="block truncate pt-1 text-[11px] uppercase tracking-[0.22em] text-white/55">Seminario Teologico</span>
            </div>
          </div>
        )}
        actions={(
          <button className="btn btn-primary btn-sm whitespace-nowrap" onClick={() => navigate('/login')}>
            Area do Aluno
          </button>
        )}
      />

      <section className="landing-showcase" id="inicio">
        <div className="landing-shell landing-hero-grid">
          <div className="landing-hero-copy">
            <div className="landing-hero-copy-top">
              <span className="section-kicker">
                Igreja Vinha Nova
              </span>
              <h1>Seminario Teologico Vinha Nova com Pr. Ralf.</h1>
              <p className="landing-lead">
                Formacao biblica online da Igreja Vinha Nova, com aulas organizadas, materiais de apoio,
                revisoes e acompanhamento pastoral em um unico ambiente.
              </p>

              <div className="landing-hero-badges">
                <span className="landing-inline-pill">Pastor responsavel: Pr. Ralf</span>
                <span className="landing-inline-pill">Nova Friburgo, RJ</span>
              </div>

              <div className="landing-hero-actions">
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
                  Entrar no seminario
                </button>
                <a className="btn btn-outline btn-lg" href="#canais">
                  Ver programacao
                </a>
              </div>
            </div>

            <div className="landing-hero-channel-panel">
              <div className="landing-panel-head landing-panel-head-compact">
                <div>
                  <span className="section-kicker">Canais oficiais</span>
                  <h3>Presenca digital da igreja</h3>
                </div>
                <a href={instagramHref} target="_blank" rel="noreferrer">
                  <AppIcon name="external" size={16} />
                </a>
              </div>

              <div className="landing-channel-list landing-channel-list-hero">
                {channels.map((channel) => (
                  <a
                    className="landing-channel-card landing-channel-card-hero"
                    key={channel.label}
                    href={channel.href}
                    target="_blank"
                    rel="noreferrer"
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

          <div className="landing-hero-image-panel">
            <img
              className="landing-hero-pastor-image"
              src={pastorImage}
              alt="Foto original do Pastor Ralf"
            />
          </div>

        </div>
      </section>

      <section className="landing-section landing-section-marquee" id="canais">
        <div className="landing-shell">
          <div className="landing-section-heading">
            <div>
              <span className="section-kicker">Posters oficiais da igreja</span>
              <h2>{'Programa\u00E7\u00E3o de Mar\u00E7o'}</h2>
            </div>
            <p>
              Comunicados e agendas da igreja em arquivos originais, preservando a proporcao real de
              cada publicacao.
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
                target="_blank"
                rel="noreferrer"
              >
                <img
                  className="landing-poster-image"
                  src={posterSrc}
                  alt={`Poster oficial da Igreja Vinha Nova ${index + 1}`}
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-shell" id="sobre">
        <div className="landing-section-heading">
          <div>
            <span className="section-kicker">Base institucional</span>
            <h2>Uma apresentacao mais clara, organizada e pastoral</h2>
          </div>
          <p>
            O seminario apresenta igreja local, formacao online e canais oficiais de forma clara e
            organizada para novos alunos e visitantes.
          </p>
        </div>

        <div className="landing-info-grid">
          {pillars.map((item) => (
            <div className="landing-info-card" key={item.title}>
              <span className="landing-info-icon">
                <AppIcon name={item.icon} size={22} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-shell" id="trilhas">
        <div className="landing-section-heading">
          <div>
            <span className="section-kicker">Trilhas do seminario</span>
            <h2>Formacao teologica com progressao objetiva</h2>
          </div>
          <p>
            A grade resume o percurso principal do aluno e reforca a proposta de ensino do
            seminario.
          </p>
        </div>

        <div className="landing-track-grid">
          {modules.map((module, index) => (
            <div className="landing-track-card" key={module.title}>
              <div className="landing-track-head">
                <span className="landing-track-index">0{index + 1}</span>
                <span className="landing-info-icon">
                  <AppIcon name={module.icon} size={20} />
                </span>
              </div>
              <h3>{module.title}</h3>
              <p>{module.description}</p>
              <span className="landing-track-foot">3 aulas centrais</span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-shell">
        <div className="landing-section-heading">
          <div>
            <span className="section-kicker">Experiencia do aluno</span>
            <h2>Estrutura profissional para acompanhar estudo e engajamento</h2>
          </div>
          <p>
            A plataforma do seminario entrega player controlado, biblioteca, perfil, progresso
            por aula para acompanhar o desenvolvimento do aluno com mais clareza.
          </p>
        </div>

        <div className="browser-mockup">
          <div className="browser-header">
            <span className="dot bg-red"></span>
            <span className="dot bg-yellow"></span>
            <span className="dot bg-green"></span>
            <div className="browser-url">app.vinhanova.com.br</div>
          </div>
          <div className="browser-body">
            <div className="landing-feature-grid">
              {platformHighlights.map((item) => (
                <div className="landing-feature-card" key={item.title}>
                  <span className="landing-info-icon">
                    <AppIcon name={item.icon} size={20} />
                  </span>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer" id="contato">
        <div className="landing-shell footer-content">
          <div className="footer-col">
            <h4>Seminario Vinha Nova</h4>
            <p>
              Plataforma online da Igreja Vinha Nova para ensino teologico, revisao de aulas e
              acompanhamento formativo.
            </p>
          </div>

          <div className="footer-col">
            <h4>Canais oficiais</h4>
            <p>
              <a href={instagramHref} target="_blank" rel="noreferrer">
                Instagram
              </a>
            </p>
            <p>
              <a href="https://www.facebook.com/igrejavinhanova/?locale=pt_BR" target="_blank" rel="noreferrer">
                Facebook
              </a>
            </p>
            <p>
              <a href="https://www.youtube.com/@igrejavinhanova" target="_blank" rel="noreferrer">
                YouTube
              </a>
            </p>
            <p>
              <a href="https://open.spotify.com/show/3eZVoELHjFGm0OG6lVjWSu" target="_blank" rel="noreferrer">
                Spotify
              </a>
            </p>
          </div>

          <div className="footer-col">
            <h4>Localizacao</h4>
            <p>Igreja Vinha Nova</p>
            <p>Av. Conselheiro Julius Arp, 14</p>
            <p>Olaria, Nova Friburgo - RJ</p>
            <p>
              <a href={mapHref} target="_blank" rel="noreferrer">
                Abrir no Google Maps
              </a>
            </p>
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
            <p>
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('/admin');
                }}
              >
                Administracao
              </a>
            </p>
            <p>
              <a href="#sobre">Sobre o seminario</a>
            </p>
            <p>
              <a href="#canais">{'Programa\u00E7\u00E3o de Mar\u00E7o'}</a>
            </p>
          </div>
        </div>
        <div className="footer-bottom">© 2026 Seminario Vinha Nova. Todos os direitos reservados.</div>
      </footer>
    </div>
  );
}
