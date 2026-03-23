import { describe, it, expect } from 'vitest';
import {
  extractYouTubeVideoId,
  getYouTubeEmbedUrl,
  getLessonVideoKind,
  normalizeLessonVideoUrl,
} from '../video-source.js';

const VALID_ID = 'dQw4w9WgXcQ';

describe('extractYouTubeVideoId', () => {
  it('retorna null para valor null', () => {
    expect(extractYouTubeVideoId(null)).toBeNull();
  });

  it('retorna null para undefined', () => {
    expect(extractYouTubeVideoId(undefined)).toBeNull();
  });

  it('retorna null para string vazia', () => {
    expect(extractYouTubeVideoId('')).toBeNull();
  });

  it('extrai ID de URL watch padrão', () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${VALID_ID}`)).toBe(VALID_ID);
  });

  it('extrai ID de URL watch com parâmetros extras', () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${VALID_ID}&t=42&list=PLx`)).toBe(VALID_ID);
  });

  it('extrai ID de URL youtu.be curta', () => {
    expect(extractYouTubeVideoId(`https://youtu.be/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('extrai ID de URL youtu.be com query string', () => {
    expect(extractYouTubeVideoId(`https://youtu.be/${VALID_ID}?t=10`)).toBe(VALID_ID);
  });

  it('extrai ID de URL embed', () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/embed/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('extrai ID de URL shorts', () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/shorts/${VALID_ID}`)).toBe(VALID_ID);
  });

  it('retorna null para URL de outro domínio', () => {
    expect(extractYouTubeVideoId('https://vimeo.com/12345')).toBeNull();
  });

  it('retorna null para URL malformada', () => {
    expect(extractYouTubeVideoId('nao-e-uma-url')).toBeNull();
  });

  it('retorna null para URL do YouTube sem ID válido', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=curto')).toBeNull();
  });
});

describe('normalizeLessonVideoUrl', () => {
  it('retorna null para null', () => {
    expect(normalizeLessonVideoUrl(null)).toBeNull();
  });

  it('normaliza URL youtu.be para formato watch padrão', () => {
    const result = normalizeLessonVideoUrl(`https://youtu.be/${VALID_ID}`);
    expect(result).toBe(`https://www.youtube.com/watch?v=${VALID_ID}`);
  });

  it('normaliza URL embed para formato watch padrão', () => {
    const result = normalizeLessonVideoUrl(`https://www.youtube.com/embed/${VALID_ID}`);
    expect(result).toBe(`https://www.youtube.com/watch?v=${VALID_ID}`);
  });

  it('retorna URL não-YouTube sem alteração', () => {
    const url = 'https://cdn.example.com/video.mp4';
    expect(normalizeLessonVideoUrl(url)).toBe(url);
  });
});

describe('getLessonVideoKind', () => {
  it('retorna "none" para null', () => {
    expect(getLessonVideoKind(null)).toBe('none');
  });

  it('retorna "none" para string vazia', () => {
    expect(getLessonVideoKind('')).toBe('none');
  });

  it('retorna "youtube" para URL do YouTube', () => {
    expect(getLessonVideoKind(`https://youtu.be/${VALID_ID}`)).toBe('youtube');
  });

  it('retorna "upload" para URL não-YouTube', () => {
    expect(getLessonVideoKind('/uploads/videos/aula.mp4')).toBe('upload');
  });
});

describe('getYouTubeEmbedUrl', () => {
  it('retorna null para URL inválida', () => {
    expect(getYouTubeEmbedUrl(null)).toBeNull();
  });

  it('gera URL embed nocookie com parâmetros corretos', () => {
    const result = getYouTubeEmbedUrl(`https://youtu.be/${VALID_ID}`);
    expect(result).toBe(
      `https://www.youtube-nocookie.com/embed/${VALID_ID}?rel=0&modestbranding=1&playsinline=1`
    );
  });

  it('retorna null para URL não-YouTube', () => {
    expect(getYouTubeEmbedUrl('https://vimeo.com/12345')).toBeNull();
  });
});
