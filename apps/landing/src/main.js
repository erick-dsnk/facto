/* global document, window, IntersectionObserver, SpeechSynthesisUtterance */
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-700-italic.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@phosphor-icons/web/regular';
import './style.css';

const menu = document.querySelector('#mobile-menu');
const menuTrigger = document.querySelector('.menu-trigger');
const demo = document.querySelector('.demo-dialog');
const tabs = [...document.querySelectorAll('[data-mode]')];
const result = document.querySelector('.demo-result');
const checkButton = document.querySelector('.demo-check');
const progress = document.querySelector('.demo-progress');
const progressCopy = document.querySelector('.demo-progress-copy');
let activeMode = 'look';
let checkTimer;
let returnFocus;

function updateScrollLock() {
  document.body.classList.toggle('dialog-open', menu.open || demo.open);
}

function closeMenu() {
  menu.close();
  menuTrigger.setAttribute('aria-expanded', 'false');
  updateScrollLock();
}

menuTrigger.addEventListener('click', () => {
  menu.showModal();
  menuTrigger.setAttribute('aria-expanded', 'true');
  updateScrollLock();
});
menu.querySelector('[data-close-menu]').addEventListener('click', closeMenu);
menu.querySelectorAll('nav a').forEach(link => link.addEventListener('click', closeMenu));
menu.addEventListener('close', () => {
  menuTrigger.setAttribute('aria-expanded', 'false');
  updateScrollLock();
});

function setMode(mode, moveFocus = false) {
  activeMode = mode;
  window.clearTimeout(checkTimer);
  tabs.forEach(tab => {
    const selected = tab.dataset.mode === mode;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && moveFocus) tab.focus();
  });
  document.querySelector('#example-panel').setAttribute('aria-labelledby', `${mode}-tab`);
  document.querySelector('.demo-capture-label').textContent = mode === 'look' ? 'FROM A STATEMENT IN PRINT' : 'FROM A CONVERSATION';
  result.hidden = true;
  checkButton.hidden = false;
  checkButton.disabled = false;
  progress.classList.remove('is-checking', 'is-complete');
  progressCopy.textContent = mode === 'look' ? 'A familiar saying. A checkable claim.' : '“I heard that lightning never strikes the same place twice.”';
}

document.querySelectorAll('[data-open-demo]').forEach(button => button.addEventListener('click', () => {
  returnFocus = menu.open ? menuTrigger : button;
  if (menu.open) closeMenu();
  setMode(button.dataset.demoMode || 'look');
  demo.showModal();
  updateScrollLock();
}));

document.querySelector('[data-close-demo]').addEventListener('click', () => demo.close());
demo.addEventListener('close', () => {
  window.clearTimeout(checkTimer);
  updateScrollLock();
  returnFocus?.focus();
});
for (const dialog of [menu, demo]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
  tab.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setMode(event.key === 'Home' ? 'look' : event.key === 'End' ? 'listen' : activeMode === 'look' ? 'listen' : 'look', true);
    }
  });
});

checkButton.addEventListener('click', () => {
  checkButton.disabled = true;
  progress.classList.add('is-checking');
  progressCopy.textContent = 'Following this claim to its source…';
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 850;
  checkTimer = window.setTimeout(() => {
    result.hidden = false;
    checkButton.hidden = true;
    progress.classList.remove('is-checking');
    progress.classList.add('is-complete');
    progressCopy.textContent = 'Evidence found. The familiar saying doesn’t hold up.';
    result.querySelector('a').focus();
  }, duration);
});
document.querySelector('.demo-reset').addEventListener('click', () => setMode(activeMode === 'look' ? 'listen' : 'look', true));

const audioButton = document.querySelector('.hear-result');
const audioStatus = document.querySelector('.audio-status');
if (!('speechSynthesis' in window)) {
  audioButton.hidden = true;
} else {
  const resetAudio = () => {
    audioButton.setAttribute('aria-pressed', 'false');
    audioButton.setAttribute('aria-label', 'Hear the lightning fact-check result');
    audioButton.querySelector('i').className = 'ph ph-speaker-high';
  };
  audioButton.addEventListener('click', () => {
    if (audioButton.getAttribute('aria-pressed') === 'true') {
      window.speechSynthesis.cancel();
      resetAudio();
      audioStatus.textContent = 'Playback stopped.';
      return;
    }
    const speech = new SpeechSynthesisUtterance('Contradicted. According to NOAA, lightning can strike the same place repeatedly, especially tall, isolated objects. Open the source to read more.');
    speech.lang = 'en-US';
    speech.rate = 0.94;
    speech.onend = resetAudio;
    speech.onerror = () => { resetAudio(); audioStatus.textContent = 'Audio is unavailable. Read the NOAA source for the full explanation.'; };
    audioButton.setAttribute('aria-pressed', 'true');
    audioButton.setAttribute('aria-label', 'Stop reading the result');
    audioButton.querySelector('i').className = 'ph ph-stop';
    audioStatus.textContent = 'Reading the fact-check result.';
    window.speechSynthesis.speak(speech);
  });
  window.addEventListener('pagehide', () => window.speechSynthesis.cancel());
}

if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(element => {
    element.classList.add('will-reveal');
    observer.observe(element);
  });
}
