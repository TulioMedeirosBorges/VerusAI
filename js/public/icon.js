export function Icons(name) {
  const icons = {
    close: `<img src="/assets/icons/close.svg" class="icon-close">`,
    google: `<img src="/assets/icons/google.svg" class="icon-google">`,
    warning: `<img src="/assets/icons/warning.svg" class="icon-warning">`,
    check: `<img src="/assets/icons/check.svg" class="icon-check">`,
    logout: `<img src="/assets/icons/logout.svg" class="icon-logout">`,
    Aa: `<img src="/assets/icons/Aa.svg" class="icon-Aa">`,
    less: `<img src="/assets/icons/less.svg" class="icon-less">`,
    pluss: `<img src="/assets/icons/pluss.svg" class="icon-pluss">`,
  };

  return icons[name];
}
