// Internationalization and interactions for welcome.html (Manifest V3 CSP compliant)

interface TranslationStrings {
  title: string;
  subtitle: string;
  pactTitle: string;
  pactDesc: string;
  pactItem1Title: string;
  pactItem1Desc: string;
  pactItem2Title: string;
  pactItem2Desc: string;
  pactItem3Title: string;
  pactItem3Desc: string;
  stepsHeading: string;
  step1Title: string;
  step1Desc: string;
  step1Badge: string;
  step2Title: string;
  step2Desc: string;
  step2Badge: string;
  step3Title: string;
  step3Desc: string;
  step3Badge: string;
  btnMeetText: string;
  btnClose: string;
}

const i18nData: Record<'en' | 'es' | 'pt', TranslationStrings> = {
  en: {
    title: 'Welcome to Meeting Heroes!',
    subtitle: "The supportive extension built to save your team's time and make every meeting count.",
    pactTitle: 'The spirit of Meeting Heroes: help improve, not judge 🤝',
    pactDesc: 'The sole purpose is to <strong>help organizers improve</strong> and make their next meetings twice as valuable through constructive, supportive feedback.',
    pactItem1Title: 'Zero company-wide rankings',
    pactItem1Desc: 'No global stats, no scoreboards, no managerial tracking.',
    pactItem2Title: '100% anonymous',
    pactItem2Desc: 'Zero names, zero emails, zero IPs. Organizers will never know who voted what.',
    pactItem3Title: 'A constructive boost',
    pactItem3Desc: 'Reviews only serve to help fine-tune duration, format, or agenda.',
    stepsHeading: 'How does it work? In 3 simple steps',
    step1Title: 'Pin the icon in Chrome',
    step1Desc: 'Click the puzzle icon <strong>🧩</strong> at the top right of Chrome, then click the pin next to Meeting Heroes.',
    step1Badge: 'Extensions → Pin',
    step2Title: 'Join a Google Meet',
    step2Desc: 'The golden button <strong>⚡ Give my super-review</strong> will automatically appear in your call without needing to refresh.',
    step2Badge: 'Automatic integration',
    step3Title: '10 seconds at call end',
    step3Desc: "Rate in one click and pick criteria (timing, agenda...) to help save the entire team's time.",
    step3Badge: 'Quick & Helpful',
    btnMeetText: 'Go to Google Meet 🚀',
    btnClose: 'Close this tab',
  },
  es: {
    title: '¡Bienvenido a Meeting Heroes!',
    subtitle: 'La extensión diseñada para ahorrar tiempo al equipo y hacer que cada reunión cuente.',
    pactTitle: 'El espíritu de Meeting Heroes: mejorar, no juzgar 🤝',
    pactDesc: 'El único objetivo es <strong>ayudar a cada organizador a progresar</strong> y hacer sus próximas reuniones 2x más eficaces.',
    pactItem1Title: 'Cero estadísticas globales',
    pactItem1Desc: 'Sin clasificaciones de empresa ni informes para directivos.',
    pactItem2Title: 'Anonimato total',
    pactItem2Desc: 'Cero nombres, correos o IPs. Nadie sabrá quién votó qué.',
    pactItem3Title: 'Un impulso constructivo',
    pactItem3Desc: 'Las valoraciones sirven solo para ajustar el tiempo, formato o contenido.',
    stepsHeading: '¿Cómo funciona? En 3 sencillos pasos',
    step1Title: 'Fija el icono en Chrome',
    step1Desc: 'Haz clic en el puzle <strong>🧩</strong> arriba a la derecha de Chrome y luego en la chincheta junto a Meeting Heroes.',
    step1Badge: 'Extensiones → Fijar',
    step2Title: 'Únete a un Google Meet',
    step2Desc: 'El botón dorado <strong>⚡ Dar mi súper-opinión</strong> aparecerá solo en tu llamada sin refrescar la página.',
    step2Badge: 'Integración automática',
    step3Title: '10 secondes al final de la llamada',
    step3Desc: 'Valora con un clic y elige criterios para salvar el tiempo de todo el equipo.',
    step3Badge: 'Rápido y constructivo',
    btnMeetText: 'Ir a Google Meet 🚀',
    btnClose: 'Cerrar esta pestaña',
  },
  pt: {
    title: 'Bem-vindo ao Meeting Heroes!',
    subtitle: 'A extensão concebida para poupar tempo à equipa e tornar cada reunião útil.',
    pactTitle: 'O espírito do Meeting Heroes: melhorar, não julgar 🤝',
    pactDesc: 'O único objetivo é <strong>ajudar cada organizador a melhorar</strong> e tornar as próximas reuniões 2x mais eficazes.',
    pactItem1Title: 'Zero estatísticas globais',
    pactItem1Desc: 'Sem classificações na empresa nem relatórios de controlo.',
    pactItem2Title: 'Anonimato total',
    pactItem2Desc: 'Zero nomes, emails ou IPs. O organizador nunca saberá quem votou o quê.',
    pactItem3Title: 'Uma ajuda construtiva',
    pactItem3Desc: 'Cada avaliação serve apenas para ajustar a duração, o formato ou a pauta.',
    stepsHeading: 'Como funciona? Em 3 passos simples',
    step1Title: 'Fixa o ícone no Chrome',
    step1Desc: 'Clica no puzzle <strong>🧩</strong> no topo direito do Chrome e depois no pino ao lado do Meeting Heroes.',
    step1Badge: 'Extensões → Fixar',
    step2Title: 'Entra num Google Meet',
    step2Desc: 'O botão dourado <strong>⚡ Dar a minha super-avaliação</strong> surge sozinho na reunião.',
    step2Badge: 'Integração automática',
    step3Title: '10 segundos no final da chamada',
    step3Desc: 'Avalia com 1 clique para poupar o tempo de toda a equipa.',
    step3Badge: 'Rápido e benévolo',
    btnMeetText: 'Ir para o Google Meet 🚀',
    btnClose: 'Fechar este separador',
  },
};

function applyTranslations() {
  const browserLang = ((navigator.languages && navigator.languages[0]) || navigator.language || 'fr').toLowerCase();

  let lang: 'en' | 'es' | 'pt' | 'fr' = 'fr';
  if (browserLang.startsWith('en')) lang = 'en';
  else if (browserLang.startsWith('es')) lang = 'es';
  else if (browserLang.startsWith('pt')) lang = 'pt';

  if (lang !== 'fr' && i18nData[lang]) {
    const d = i18nData[lang];
    const setText = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    const setHtml = (id: string, html: string) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };

    setText('ui-title', d.title);
    setText('ui-subtitle', d.subtitle);
    setText('pact-heading', d.pactTitle);
    setHtml('pact-desc', d.pactDesc);
    setText('pact-item1-title', d.pactItem1Title);
    setText('pact-item1-desc', d.pactItem1Desc);
    setText('pact-item2-title', d.pactItem2Title);
    setText('pact-item2-desc', d.pactItem2Desc);
    setText('pact-item3-title', d.pactItem3Title);
    setText('pact-item3-desc', d.pactItem3Desc);
    setText('steps-heading', d.stepsHeading);
    setText('step1-title', d.step1Title);
    setHtml('step1-desc', d.step1Desc);
    setText('step1-badge', d.step1Badge);
    setText('step2-title', d.step2Title);
    setHtml('step2-desc', d.step2Desc);
    setText('step2-badge', d.step2Badge);
    setText('step3-title', d.step3Title);
    setHtml('step3-desc', d.step3Desc);
    setText('step3-badge', d.step3Badge);
    setText('btn-meet-text', d.btnMeetText);
    setText('btn-close', d.btnClose);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();

  const closeBtn = document.getElementById('btn-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.close();
    });
  }
});
