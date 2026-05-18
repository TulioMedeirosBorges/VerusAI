/* ================================================
   VerusAI — Loading Screen Orchestration
   ================================================ */
(function () {
  "use strict";

  /* ── Config ──────────────────────────────────── */
  const PAGE_IDS = ["lsp1", "lsp2", "lsp3", "lsp4", "lsp5", "lsp6"];
  const FIRST_FLIP = 260; // ms before first page turns
  const FLIP_INTERVAL = 390; // ms between each flip start
  const FLIP_DURATION = 720; // ms each page takes to turn

  // When the last page finishes: FIRST_FLIP + (N-1)*FLIP_INTERVAL + FLIP_DURATION
  const LAST_PAGE_DONE =
    FIRST_FLIP + (PAGE_IDS.length - 1) * FLIP_INTERVAL + FLIP_DURATION;

  // Progress bar fills over this period, then holds at 100%
  const PROG_DURATION = LAST_PAGE_DONE;

  // Delay after last page before logo shows
  const LOGO_DELAY = 240;
  // Logo stays visible before exit begins
  const LOGO_LINGER = 1250;
  // CSS exit animation duration (must match ls-exit keyframe)
  const EXIT_DURATION = 900;

  const STEPS = [
    { status: "Verificando fontes", label: "Fontes" },
    { status: "Lendo evidencias", label: "Evidencias" },
    { status: "Analisando contexto", label: "Contexto" },
    { status: "Cruzando dados", label: "Dados" },
    { status: "Medindo confianca", label: "Confianca" },
    { status: "Preparando analises", label: "Finalizando" },
  ];

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── State ───────────────────────────────────── */
  let startTime = null;
  let currentPage = 0;
  let nextFlipAt = FIRST_FLIP;
  let logoShown = false;
  let exiting = false;
  let rafId = null;

  /* ── Elements ────────────────────────────────── */
  const lsEl = document.getElementById("ls");
  const stageEl = document.getElementById("lsStage");
  const statusEl = document.getElementById("lsStatus");
  const dotsEl = document.getElementById("lsDots");
  const progFillEl = document.getElementById("lsProgFill");
  const progPctEl = document.getElementById("lsProgPct");
  const progLabelEl = document.getElementById("lsProgLabel");
  const stepCountEl = document.getElementById("lsStepCount");
  const logoEl = document.getElementById("lsLogo");
  const bookEl = document.querySelector(".ls-book");

  /* ── Helpers ─────────────────────────────────── */
  function setStatus(text) {
    if (!statusEl) return;
    statusEl.classList.add("is-changing");
    statusEl.style.opacity = "0";
    statusEl.style.transform = "translateY(6px)";
    setTimeout(function () {
      statusEl.textContent = text;
      statusEl.style.transition = "opacity 0.25s ease, transform 0.25s ease";
      statusEl.style.opacity = "1";
      statusEl.style.transform = "translateY(0)";
      statusEl.classList.remove("is-changing");
    }, 200);
  }

  function setProgress(pct) {
    if (!progFillEl) return;
    pct = Math.min(100, Math.max(0, pct));
    progFillEl.style.width = pct + "%";
    if (progPctEl) progPctEl.textContent = Math.round(pct) + "%";
  }

  function setStep(index) {
    var step = STEPS[index] || STEPS[STEPS.length - 1];
    var current = Math.min(index + 1, PAGE_IDS.length);
    var total = PAGE_IDS.length;

    if (progLabelEl && step) progLabelEl.textContent = step.label;
    if (stepCountEl) {
      stepCountEl.textContent =
        String(current).padStart(2, "0") + " / " + String(total).padStart(2, "0");
    }
  }

  function flipPage(index) {
    var el = document.getElementById(PAGE_IDS[index]);
    if (!el) return;

    // Add wobble to book
    if (bookEl) {
      bookEl.classList.add("wobbling");
      setTimeout(function () {
        bookEl.classList.remove("wobbling");
      }, 580);
    }

    el.classList.add("flipping");

    // Two rAF trick: let the class paint before triggering the transition
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add("flipped");
        if (STEPS[index]) setStatus(STEPS[index].status);
        setStep(index);
      });
    });

    // Remove flipping helper class after transition
    setTimeout(function () {
      el.classList.remove("flipping");
    }, FLIP_DURATION + 60);
  }

  /* ── Main rAF loop ────────────────────────────── */
  function tick(timestamp) {
    if (!startTime) startTime = timestamp;
    var elapsed = timestamp - startTime;

    /* Progress bar */
    var rawPct = Math.min(100, (elapsed / PROG_DURATION) * 100);
    setProgress(rawPct);

    /* Page flips */
    if (currentPage < PAGE_IDS.length && elapsed >= nextFlipAt) {
      flipPage(currentPage);
      currentPage++;
      nextFlipAt += FLIP_INTERVAL;
    }

    /* Logo reveal */
    if (!logoShown && elapsed >= LAST_PAGE_DONE + LOGO_DELAY) {
      logoShown = true;
      showLogo();
    }

    if (!exiting) {
      rafId = requestAnimationFrame(tick);
    }
  }

  /* ── Logo reveal + exit sequence ─────────────── */
  function showLogo() {
    /* Ensure progress hits 100% */
    setProgress(100);
    setStep(PAGE_IDS.length - 1);
    if (progLabelEl) progLabelEl.textContent = "Completo";
    if (lsEl) lsEl.classList.add("ls-logo-phase");

    /* Fade out book stage */
    if (stageEl) stageEl.classList.add("fade-out");

    /* Hide dots */
    if (dotsEl) dotsEl.style.display = "none";

    /* Show logo card */
    setTimeout(function () {
      if (logoEl) logoEl.classList.add("visible");
    }, 380);

    /* Begin exit after logo lingers */
    setTimeout(exitLoading, 380 + LOGO_LINGER);
  }

  function exitLoading() {
    exiting = true;
    if (rafId) cancelAnimationFrame(rafId);

    if (lsEl) lsEl.classList.add("ls-exit");

    /* Re-enable body scroll */
    document.body.style.overflow = "";
    document.body.classList.remove("is-loading");

    /* Remove from DOM after animation */
    setTimeout(function () {
      if (lsEl && lsEl.parentNode) lsEl.parentNode.removeChild(lsEl);
    }, EXIT_DURATION + 100);
  }

  /* ── Boot ────────────────────────────────────── */
  if (!lsEl) return;

  var started = false;

  function start() {
    if (started) return;
    started = true;
    requestAnimationFrame(tick);
  }

  document.body.style.overflow = "hidden";
  document.body.classList.add("is-loading");
  lsEl.classList.add("is-running");

  /* Set initial status */
  setStatus("Carregando analises");
  setStep(0);

  if (prefersReducedMotion) {
    PAGE_IDS.forEach(function (id) {
      var page = document.getElementById(id);
      if (page) page.classList.add("flipped");
    });
    setTimeout(showLogo, 260);
    return;
  }

  /* Start loop after fonts are ready */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      start();
    }).catch(function () {
      start();
    });
    setTimeout(start, 500);
  } else {
    setTimeout(function () {
      start();
    }, 80);
  }
})();
