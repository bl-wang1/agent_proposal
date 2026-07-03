const progressBar = document.getElementById('progressBar');
if (progressBar) {
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    progressBar.style.width = `${pct}%`;
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
}

const topbar = document.querySelector('.topbar');
if (topbar) {
  const updateTopbar = () => {
    topbar.classList.toggle('scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', updateTopbar, { passive: true });
  updateTopbar();
}

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    tabs.forEach((item) => item.classList.toggle('active', item === tab));
    panels.forEach((panel) => panel.classList.toggle('active', panel.id === `panel-${name}`));
  });
});

const flowTabs = document.querySelectorAll('.flow-tab');
const flowPanels = document.querySelectorAll('.flow-panel');
flowTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.flowTab;
    flowTabs.forEach((item) => item.classList.toggle('active', item === tab));
    flowPanels.forEach((panel) => panel.classList.toggle('active', panel.id === `flow-${name}`));
  });
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  document.querySelectorAll('.reveal, .sequence-visual').forEach((item) => observer.observe(item));
} else {
  document.querySelectorAll('.reveal').forEach((item) => item.classList.add('visible'));
  document.querySelectorAll('.sequence-visual').forEach((item) => item.classList.add('is-visible'));
}
