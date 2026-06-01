(function () {
  var THEME_KEY = "verus-docs-theme";
  var root = document.documentElement;
  var toggle = document.getElementById("themeToggle");
  var search = document.getElementById("docSearch");
  var sections = Array.from(document.querySelectorAll(".doc-section"));
  var navLinks = Array.from(document.querySelectorAll(".sidebar a"));

  function preferredTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function sectionText(section) {
    return normalize(
      [section.dataset.title, section.textContent, section.id].join(" "),
    );
  }

  function filterDocs() {
    var query = normalize(search.value);

    sections.forEach(function (section) {
      var visible = !query || sectionText(section).includes(query);
      section.classList.toggle("is-hidden", !visible);
    });

    navLinks.forEach(function (link) {
      var id = link.getAttribute("href").replace("#", "");
      var target = document.getElementById(id);
      link.hidden = Boolean(target && target.classList.contains("is-hidden"));
    });
  }

  function setActiveNav(id) {
    navLinks.forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("href") === "#" + id);
    });
  }

  setTheme(preferredTheme());

  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  if (search) {
    search.addEventListener("input", filterDocs);
  }

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActiveNav(entry.target.id);
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0.01 },
    );

    sections.forEach(function (section) {
      if (section.id) observer.observe(section);
    });
  }
})();
