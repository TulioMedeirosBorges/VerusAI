export function Icons(name) {
  const icons = {
    close: `<img src="/assets/icons/close.svg" class="icon-close">`,
    google: `<img src="/assets/icons/google.svg" class="icon-google">`,
    warning: `<img src="/assets/icons/warning.svg" class="icon-warning">`,
    check: `<img src="/assets/icons/check.svg" class="icon-check">`,
  };

  return icons[name];
}
