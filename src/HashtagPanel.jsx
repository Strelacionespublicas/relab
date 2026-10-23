// Panel de hashtags de TextoRedes: grupos guardados con título (con cuenta) y sugeridos.
import { useState } from 'react';
import { Button } from './ds/components.jsx';

const eyebrow = { fontFamily: 'var(--font-data)', fontSize: 'var(--fs-3xs)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: 'var(--text-muted)' };
const linkBtn = { border: 'none', background: 'none', color: 'var(--st-coral)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-xs)', cursor: 'pointer', padding: '4px 0' };
const field = { width: '100%', height: 38, padding: '0 12px', border: '1.5px solid var(--border-default)', borderRadius: 10, background: 'var(--st-white)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--st-gris-oscuro)', outline: 'none' };
const chip = used => ({ padding: '5px 10px', borderRadius: 999, border: `1px solid ${used ? 'var(--st-celeste-300)' : 'var(--border-default)'}`, background: used ? 'var(--st-celeste-100)' : 'var(--st-white)', color: used ? 'var(--st-celeste-700)' : 'var(--st-petroleo)', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-xs)', cursor: used ? 'default' : 'pointer' });
const iconBtn = { border: 'none', background: 'none', color: 'var(--text-subtle)', fontSize: 15, cursor: 'pointer', padding: 4 };

// "turismo, #Catamarca viajes" → ['#turismo', '#Catamarca', '#viajes'], sin repetidos.
export const parseTags = str => {
  const seen = new Set();
  return str.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean)
    .map(t => (t.startsWith('#') ? t : '#' + t))
    .filter(t => /^#[\p{L}\p{N}_]+$/u.test(t))
    .filter(t => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
};

export default function HashtagPanel({ loggedIn, tagSets, onSaveSet, onDeleteSet, tagsInText, usedTags, suggestedTags, onAddTags, onLogin, flash }) {
  const [form, setForm] = useState(null); // { id?, title, tags }

  const addMissing = tags => {
    const missing = tags.filter(t => !usedTags.has(t.toLowerCase()));
    if (!missing.length) { flash('Ya están todos en el texto'); return; }
    onAddTags(missing);
  };

  const submit = () => {
    const tags = parseTags(form.tags);
    if (!tags.length) { flash('Escribí al menos un hashtag', false); return; }
    onSaveSet({ id: form.id, title: form.title.trim().slice(0, 60), text: tags.join(' ') });
    setForm(null);
  };

  const Chips = ({ tags }) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {tags.map(tag => {
        const used = usedTags.has(tag.toLowerCase());
        return <button key={tag} onMouseDown={e => e.preventDefault()} onClick={used ? undefined : () => onAddTags([tag])} style={chip(used)}>{used ? '✓ ' + tag : tag}</button>;
      })}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={eyebrow}>Mis grupos</span>
          {loggedIn && !form && <button onClick={() => setForm({ title: '', tags: '' })} style={linkBtn}>+ Nuevo grupo</button>}
        </div>

        {!loggedIn && <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}><a href="#" onClick={e => { e.preventDefault(); onLogin(); }}>Ingresá</a> para armar grupos de hashtags con nombre y reutilizarlos en cada copy.</p>}

        {form && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--st-white)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Nombre del grupo (ej.: Turismo Catamarca)" maxLength={60} aria-label="Nombre del grupo" style={field} />
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="#turismo #catamarca #escapadas" aria-label="Hashtags del grupo" style={field} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => setForm({ ...form, tags: [...new Set([...parseTags(form.tags), ...tagsInText])].join(' ') })} disabled={!tagsInText.length} style={linkBtn}>Sumar los del texto</button>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="ghost" size="sm" onClick={() => setForm(null)}>Cancelar</Button>
                <Button variant="secondary" size="sm" onClick={submit}>Guardar grupo</Button>
              </div>
            </div>
          </div>
        )}

        {loggedIn && !tagSets.length && !form && <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Armá tu primer grupo, por ejemplo "Turismo" o "Institucional", y agregalo a cualquier copy con un toque.</p>}

        {loggedIn && tagSets.map(s => {
          const tags = parseTags(s.text);
          return (
            <div key={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--st-white)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-sm)', color: s.title ? 'var(--st-petroleo)' : 'var(--text-muted)' }}>{s.title || 'Sin título'}</span>
                <button onMouseDown={e => e.preventDefault()} onClick={() => addMissing(tags)} style={{ border: 'none', background: 'var(--st-coral-100)', color: 'var(--st-coral-700)', borderRadius: 999, padding: '5px 12px', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-2xs)', cursor: 'pointer' }}>Agregar todos</button>
                <button onClick={() => setForm({ id: s.id, title: s.title || '', tags: s.text })} title="Editar grupo" aria-label="Editar grupo" style={iconBtn}>✎</button>
                <button onClick={() => { if (window.confirm(`¿Borrar el grupo "${s.title || 'Sin título'}"?`)) onDeleteSet(s.id); }} title="Borrar grupo" aria-label="Borrar grupo" style={iconBtn}>✕</button>
              </div>
              <Chips tags={tags} />
            </div>
          );
        })}
      </div>

      <div style={{ height: 1, background: 'var(--border-subtle)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={eyebrow}>Sugeridos para tu texto</span>
        <Chips tags={suggestedTags} />
      </div>
    </div>
  );
}
