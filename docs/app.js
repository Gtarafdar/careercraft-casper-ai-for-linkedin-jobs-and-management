(function () {
  "use strict";

  var REPO = "Gtarafdar/careercraft-casper-ai-for-linkedin-jobs-and-management";
  var FALLBACK = "https://github.com/" + REPO + "/releases/latest";

  var menuBtn = document.getElementById("menuBtn");
  var side = document.getElementById("sideNav");
  var backdrop = document.getElementById("navBackdrop");

  function setNavOpen(open) {
    document.body.classList.toggle("nav-open", open);
    if (menuBtn) menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (backdrop) backdrop.hidden = !open;
  }

  if (menuBtn && side) {
    menuBtn.addEventListener("click", function () {
      setNavOpen(!document.body.classList.contains("nav-open"));
    });
    side.querySelectorAll("a.nav-link").forEach(function (a) {
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

  var links = Array.prototype.slice.call(
    document.querySelectorAll(".side a.nav-link")
  );
  var sections = links
    .map(function (a) {
      var id = (a.getAttribute("href") || "").replace(/^#/, "");
      return document.getElementById(id);
    })
    .filter(Boolean);

  function setActive() {
    var y = window.scrollY + 120;
    var current = sections[0];
    sections.forEach(function (sec) {
      if (sec.offsetTop <= y) current = sec;
    });
    links.forEach(function (a) {
      var match = current && a.getAttribute("href") === "#" + current.id;
      a.classList.toggle("active", !!match);
    });
  }
  window.addEventListener("scroll", setActive, { passive: true });
  setActive();

  var lb = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbClose = document.getElementById("lbClose");

  function openLb(src, alt) {
    if (!lb || !lbImg) return;
    lbImg.src = src;
    lbImg.alt = alt || "";
    lb.hidden = false;
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeLb() {
    if (!lb || !lbImg) return;
    lb.classList.remove("open");
    lb.hidden = true;
    lbImg.src = "";
    document.body.style.overflow = "";
  }
  document.querySelectorAll(".shot").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var img = btn.querySelector("img");
      openLb(btn.getAttribute("data-full"), img ? img.alt : "");
    });
  });
  if (lbClose) lbClose.addEventListener("click", closeLb);
  if (lb) {
    lb.addEventListener("click", function (e) {
      if (e.target === lb) closeLb();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLb();
  });

  function setDownload(url) {
    ["dlSide", "dlHero", "dlCta"].forEach(function (id) {
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
