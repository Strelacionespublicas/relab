// Política de privacidad de Relab. Google la exige para publicar el login.
import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import { Logo } from './ds/components.jsx';
import { Footer } from './Footer.jsx';

const CONTACT_EMAIL = 'strelacionespublicas@gmail.com';
const UPDATED = '23 de octubre de 2026';

const SECTIONS = [
  ['Quiénes somos', <>Relab es un conjunto de recursos de <strong>ST Relaciones Públicas SAS</strong> (Argentina), responsable de los datos que se describen acá.</>],
  ['Qué datos guardamos', <>Los recursos de Relab se pueden usar sin cuenta. Si elegís ingresar con Google, guardamos solo:
    <ul>
      <li>tu nombre, tu email y la imagen de perfil que te asigna Google;</li>
      <li>lo que decidas guardar en cada recurso: el texto en curso, tus borradores, tus grupos de hashtags y tu avance en los checklists.</li>
    </ul>
    No accedemos a tus contactos, tus archivos, tu correo ni a ninguna otra información de tu cuenta de Google, y no publicamos nada en tu nombre.</>],
  ['Tus textos son tuyos', <>Lo que escribís y guardás (el texto en curso, tus borradores, tus grupos de hashtags y tu avance en los checklists) se guarda <strong>cifrado</strong>: en nuestra base de datos es ilegible. No leemos, no revisamos y no analizamos tus textos, y no los usamos para nada más que mostrártelos a vos cuando volvés.</>],
  ['Para qué los usamos', <>Para identificarte cuando volvés y mostrarte lo que guardaste. Podemos usar tu email para avisarte novedades importantes de Relab. No vendemos ni compartimos tus datos con terceros para publicidad.</>],
  ['Sin cuenta', <>Si usás los recursos sin ingresar, lo que escribís queda solo en tu navegador y no se envía a nuestros servidores.</>],
  ['Dónde se guardan', <>En los servidores de Cloudflare, que usamos para alojar Relab. Usamos una cookie de sesión para mantenerte conectado durante 30 días. No usamos cookies publicitarias.</>],
  ['Tus derechos', <>Podés borrar tu cuenta y todos tus datos en cualquier momento, sin escribirnos, desde <strong>Historial → Borrar mi cuenta y mis datos</strong>. También podés pedir ver, corregir o borrar tus datos escribiendo a <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Respondemos dentro de los 10 días hábiles, como indica la Ley 25.326 de Protección de Datos Personales. Si considerás que no respondimos como corresponde, podés presentar un reclamo ante la Agencia de Acceso a la Información Pública (AAIP).</>],
  ['Cambios', <>Si cambiamos esta política, actualizamos la fecha de esta página. Si el cambio es importante, te avisamos por email.</>],
];

function Privacidad() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--st-petroleo)', color: 'var(--st-white)', padding: '14px clamp(16px, 4vw, 40px)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Logo height={30} />
        <div style={{ width: 1, height: 28, background: 'var(--border-inverse)' }} />
        <a href="/" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.035em', lineHeight: 1, color: 'var(--st-white)', textDecoration: 'none' }}>relab</a>
      </header>
      <main style={{ flex: 1, padding: 'clamp(28px, 5vw, 56px) clamp(16px, 4vw, 40px) 48px', maxWidth: 760, width: '100%', margin: '0 auto' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(28px, 4vw, 40px)', lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--st-petroleo)' }}>Política de privacidad</h1>
        <p style={{ margin: '8px 0 32px', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Última actualización: {UPDATED}</p>
        {SECTIONS.map(([title, body]) => (
          <section key={title} style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-lg)', color: 'var(--st-petroleo)' }}>{title}</h2>
            <div style={{ fontSize: 'var(--fs-md)', lineHeight: 1.6, color: 'var(--text-body)' }}>{body}</div>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Privacidad />);
