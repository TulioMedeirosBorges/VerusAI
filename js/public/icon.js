export function Icons(name) {
  const icons = {
    close: `<img src="/assets/icons/close.svg" class="icon-close">`,
    google: `<img src="/assets/icons/google.svg" class="icon-google">`,
  };

  return icons[name];
}
