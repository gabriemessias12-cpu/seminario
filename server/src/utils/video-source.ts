export type LessonVideoKind = 'none' | 'upload' | 'youtube';

export function extractYouTubeVideoId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const directMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  if (directMatch?.[1]) {
    return directMatch[1];
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && id.length === 11 ? id : null;
    }

    if (url.hostname.includes('youtube.com')) {
      const watchId = url.searchParams.get('v');
      if (watchId && watchId.length === 11) {
        return watchId;
      }

      const pathParts = url.pathname.split('/').filter(Boolean);
      const embedIndex = pathParts.findIndex((part) => part === 'embed' || part === 'shorts');
      if (embedIndex >= 0) {
        const id = pathParts[embedIndex + 1];
        return id && id.length === 11 ? id : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeLessonVideoUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const youtubeId = extractYouTubeVideoId(trimmed);
  if (youtubeId) {
    return `https://www.youtube.com/watch?v=${youtubeId}`;
  }

  return trimmed;
}

export function getLessonVideoKind(value: string | null | undefined): LessonVideoKind {
  if (!value) {
    return 'none';
  }

  return extractYouTubeVideoId(value) ? 'youtube' : 'upload';
}

export function getYouTubeEmbedUrl(value: string | null | undefined): string | null {
  const youtubeId = extractYouTubeVideoId(value);
  if (!youtubeId) {
    return null;
  }

  return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`;
}
