import { useEffect, useRef, useState } from 'react';

import AvatarCropModal from '../../components/AvatarCropModal';
import { apiGet, apiFetch } from '../../lib/apiClient';

interface LeadershipSlide {
  slot: number;
  name: string;
  url: string;
  objectPosition: string;
}

export default function AdminConfiguracoes() {
  const [slides, setSlides] = useState<LeadershipSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'warning'>('warning');
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropSlot, setCropSlot] = useState<number>(1);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<Record<number, string>>({});
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    apiGet<LeadershipSlide[]>('/api/admin/brand/lideranca')
      .then((data) => { if (Array.isArray(data)) setSlides(data); })
      .catch(() => setFeedback('Não foi possível carregar as configurações.'))
      .finally(() => setLoading(false));
  }, []);

  const handleFileSelect = (slot: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const ref = fileRefs.current[slot];
    if (ref) ref.value = '';
    setCropSlot(slot);
    setCropFile(file);
  };

  const handleCropConfirm = async (blob: Blob) => {
    const slot = cropSlot;
    setCropFile(null);
    setUploadingSlot(slot);
    try {
      const fd = new FormData();
      fd.append('foto', blob, 'foto.jpg');
      const name = editingName[slot] ?? slides.find(s => s.slot === slot)?.name ?? '';
      if (name) fd.append('name', name);
      const response = await apiFetch(`/api/admin/brand/lideranca/${slot}`, { method: 'PUT', body: fd });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao salvar foto.');
      setSlides(prev => prev.map(s => s.slot === slot ? { ...s, ...data, url: data.url + '?t=' + Date.now() } : s));
      setFeedbackTone('success');
      setFeedback(`Foto do slot ${slot} atualizada com sucesso.`);
    } catch (error) {
      setFeedbackTone('warning');
      setFeedback(error instanceof Error ? error.message : 'Erro ao salvar foto.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleSaveName = async (slot: number) => {
    const name = editingName[slot];
    if (!name) return;
    try {
      const fd = new FormData();
      fd.append('name', name);
      const response = await apiFetch(`/api/admin/brand/lideranca/${slot}`, { method: 'PUT', body: fd });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao salvar nome.');
      setSlides(prev => prev.map(s => s.slot === slot ? { ...s, name: data.name } : s));
      setEditingName(prev => { const next = { ...prev }; delete next[slot]; return next; });
      setFeedbackTone('success');
      setFeedback('Nome atualizado.');
    } catch (error) {
      setFeedbackTone('warning');
      setFeedback(error instanceof Error ? error.message : 'Erro ao salvar nome.');
    }
  };

  return (
    <>
      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          shape="rect"
          aspectRatio={3 / 4}
          outputSize={600}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}

      <div className="page-header page-header-split">
        <div>
          <h1>Configurações</h1>
          <p>Gerencie as fotos e nomes da liderança exibidos na página inicial.</p>
        </div>
      </div>

      {feedback && <div className={`inline-feedback ${feedbackTone}`}>{feedback}</div>}

      <div className="panel-card page-surface-narrow">
        <h3 className="section-title">Fotos da Liderança</h3>
        <p className="text-muted" style={{ marginBottom: '1.25rem' }}>
          Estas fotos aparecem no carrossel da página inicial. Cada imagem será recortada em proporção 3:4.
        </p>

        {loading ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {slides.map((slide) => (
              <div key={slide.slot} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    alt={slide.name}
                    src={slide.url}
                    style={{ width: 90, height: 120, objectFit: 'cover', objectPosition: slide.objectPosition, borderRadius: 8, display: 'block' }}
                  />
                  <span style={{
                    position: 'absolute', bottom: 4, left: 4, right: 4,
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    fontSize: '0.65rem', textAlign: 'center', borderRadius: 4, padding: '2px 4px'
                  }}>
                    Slot {slide.slot}
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Nome</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        className="form-input"
                        value={editingName[slide.slot] ?? slide.name}
                        onChange={(e) => setEditingName(prev => ({ ...prev, [slide.slot]: e.target.value }))}
                      />
                      {editingName[slide.slot] !== undefined && editingName[slide.slot] !== slide.name && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveName(slide.slot)} type="button">
                          Salvar
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <input
                      accept="image/*"
                      ref={(el) => { fileRefs.current[slide.slot] = el; }}
                      style={{ display: 'none' }}
                      type="file"
                      onChange={(e) => handleFileSelect(slide.slot, e)}
                    />
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={uploadingSlot === slide.slot}
                      onClick={() => fileRefs.current[slide.slot]?.click()}
                      type="button"
                    >
                      {uploadingSlot === slide.slot ? 'Enviando...' : 'Trocar foto'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
