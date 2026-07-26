(function () {
  "use strict";

  var REPO = "Gtarafdar/careercraft-casper-ai-for-linkedin-jobs-and-management";
  var FALLBACK = "https://github.com/" + REPO + "/releases/latest";

  var menuBtn = document.getElementById("menuBtn");
  var drawer = document.getElementById("drawer");
  var backdrop = document.getElementById("backdrop");
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setNavOpen(open) {
    document.body.classList.toggle("nav-open", open);
    if (menuBtn) menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (drawer) drawer.hidden = !open;
    if (backdrop) backdrop.hidden = !open;
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", function () {
      setNavOpen(!document.body.classList.contains("nav-open"));
    });
  }
  if (drawer) {
    drawer.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        setNavOpen(false);
      });
    });
  }
  if (backdrop) {
    backdrop.addEventListener("click", function () {
      setNavOpen(false);
    });
  }

  /* Lightbox */
  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbClose = document.getElementById("lbClose");
  var lightboxOpen = false;

  function openLb(src, alt) {
    if (!lb || !lbImg || !src) return;
    lbImg.src = src;
    lbImg.alt = alt || "";
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    lightboxOpen = true;
    pauseCarousel();
  }

  function closeLb() {
    if (!lb || !lbImg) return;
    lb.hidden = true;
    lbImg.src = "";
    document.body.style.overflow = "";
    lightboxOpen = false;
    resumeCarousel();
  }

  function bindShots(root) {
    (root || document).querySelectorAll(".shot").forEach(function (btn) {
      if (btn.dataset.lbBound) return;
      btn.dataset.lbBound = "1";
      btn.addEventListener("click", function () {
        var img = btn.querySelector("img");
        var src =
          btn.getAttribute("data-full") || (img && img.getAttribute("src"));
        openLb(src, img ? img.alt : "");
      });
    });
  }
  bindShots(document);

  if (lbClose) lbClose.addEventListener("click", closeLb);
  if (lb) {
    lb.addEventListener("click", function (e) {
      if (e.target === lb) closeLb();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeLb();
      setNavOpen(false);
    }
  });

  /* Carousel */
  var carousel = document.getElementById("carousel");
  var track = document.getElementById("carouselTrack");
  var viewport = document.getElementById("carouselViewport");
  var offset = 0;
  var paused = false;
  var SPEED = 0.35;
  var halfWidth = 0;

  function pauseCarousel() {
    paused = true;
  }
  function resumeCarousel() {
    if (lightboxOpen) return;
    paused = false;
  }

  function measureLoop() {
    if (!track) return;
    halfWidth = track.scrollWidth / 2;
  }

  function setupCarousel() {
    if (!track || !carousel || !viewport) return;
    var originals = Array.prototype.slice.call(track.children);
    if (!originals.length) return;

    originals.forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.tabIndex = -1;
      track.appendChild(clone);
    });
    bindShots(track);
    measureLoop();

    carousel.addEventListener("mouseenter", pauseCarousel);
    carousel.addEventListener("mouseleave", resumeCarousel);
    carousel.addEventListener(
      "touchstart",
      function () {
        pauseCarousel();
      },
      { passive: true }
    );
    carousel.addEventListener(
      "touchend",
      function () {
        setTimeout(resumeCarousel, 1200);
      },
      { passive: true }
    );
    window.addEventListener("resize", measureLoop);

    if (reduceMotion) {
      viewport.style.overflowX = "auto";
      track.style.transform = "none";
      return;
    }

    function tick() {
      if (!paused && halfWidth > 0) {
        offset += SPEED;
        if (offset >= halfWidth) offset -= halfWidth;
        track.style.transform = "translate3d(" + -offset + "px,0,0)";
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* Reveal */
  function setupReveal() {
    var nodes = document.querySelectorAll(
      ".band, .duo, .split, .byok, .feat-grid, .cta, .steps li"
    );
    if (!nodes.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach(function (el) {
        el.classList.add("in");
      });
      return;
    }
    nodes.forEach(function (el) {
      el.classList.add("reveal");
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.1 }
    );
    nodes.forEach(function (el) {
      io.observe(el);
    });
  }

  function boot() {
    setupCarousel();
    setupReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* Downloads */
  function setDownload(url) {
    ["dlTop", "dlHero", "dlCta"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.href = url;
    });
  }

  fetch("https://api.github.com/repos/" + REPO + "/releases/latest")
    .then(function (r) {
      if (!r.ok) throw new Error("no release");
      return r.json();
    })
    .then(function (data) {
      var zip = (data.assets || []).find(function (a) {
        return /\.zip$/i.test(a.name);
      });
      if (zip && zip.browser_download_url) {
        setDownload(zip.browser_download_url);
      } else if (data.html_url) {
        setDownload(data.html_url);
      }
    })
    .catch(function () {
      setDownload(FALLBACK);
    });
})();
