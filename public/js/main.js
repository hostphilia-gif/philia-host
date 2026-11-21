/* Philia Host — site scripts */
(function () {
  "use strict";

  /* ---------- Header scroll state ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 24) header.classList.add("is-scrolled");
    else header.classList.remove("is-scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile nav ---------- */
  var burger = document.querySelector(".burger");
  var mobileNav = document.querySelector(".mobile-nav");
  if (burger && mobileNav) {
    burger.addEventListener("click", function () {
      burger.classList.toggle("is-open");
      mobileNav.classList.toggle("is-open");
      document.body.style.overflow = mobileNav.classList.contains("is-open") ? "hidden" : "";
    });
    mobileNav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        burger.classList.remove("is-open");
        mobileNav.classList.remove("is-open");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Animated counters ---------- */
  var counters = document.querySelectorAll("[data-count-to]");
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute("data-count-to"));
    var decimals = el.getAttribute("data-decimals") ? parseInt(el.getAttribute("data-decimals"), 10) : 0;
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 1600;
    var start = null;

    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = target * eased;
      el.textContent = value.toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window && counters.length) {
    var ioCount = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            ioCount.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach(function (el) { ioCount.observe(el); });
  }

  /* ---------- Active nav link ---------- */
  var path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-desktop a, .mobile-nav a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      a.classList.add("is-active");
    }
  });

  /* ---------- Contact form (posts to backend; falls back to mailto if unreachable) ---------- */
  var contactForm = document.getElementById("contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var data = new FormData(contactForm);
      var payload = {
        name: (data.get("name") || "").toString(),
        email: (data.get("email") || "").toString(),
        phone: (data.get("phone") || "").toString(),
        subject: (data.get("subject") || "").toString(),
        message: (data.get("message") || "").toString(),
      };

      var submitBtn = contactForm.querySelector('button[type="submit"]');
      var success = document.getElementById("contact-success");
      var error = document.getElementById("contact-error");
      if (error) error.classList.remove("is-visible");
      if (submitBtn) submitBtn.disabled = true;

      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("request_failed");
          return res.json();
        })
        .then(function () {
          if (success) success.classList.add("is-visible");
          contactForm.reset();
        })
        .catch(function () {
          // Backend unreachable (e.g. static hosting with no server) — fall back to mailto.
          var subject = encodeURIComponent("Nouvelle demande via philiahost.com — " + payload.name);
          var body = encodeURIComponent(
            "Nom: " + payload.name + "\nEmail: " + payload.email + "\nTéléphone: " + payload.phone +
            "\n\nMessage:\n" + payload.message
          );
          window.location.href = "mailto:contact@philiahost.com?subject=" + subject + "&body=" + body;
          if (error) error.classList.add("is-visible");
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ---------- Revenue estimator ---------- */
  var calcForm = document.getElementById("estimate-form");
  if (calcForm) {
    var amountEl = document.getElementById("calc-amount");
    var rangeEl = document.getElementById("calc-range");
    var occEl = document.getElementById("calc-occ");
    var adrEl = document.getElementById("calc-adr");
    var nightsEl = document.getElementById("calc-nights");

    var zoneFactors = {
      centre: 1.25,
      corniche: 1.35,
      medina: 1.1,
      malabata: 1.3,
      autre: 1.0
    };

    function formatMAD(n) {
      return Math.round(n).toLocaleString("fr-FR") + " MAD";
    }

    function compute() {
      var bedrooms = parseInt(calcForm.bedrooms.value, 10) || 1;
      var zone = calcForm.zone.value;
      var standing = calcForm.standing.value;

      var baseADR = 350 + (bedrooms - 1) * 180; // base nightly rate (MAD)
      var zoneFactor = zoneFactors[zone] || 1;
      var standingFactor = standing === "haut" ? 1.35 : standing === "moyen" ? 1.1 : 0.9;
      var adr = baseADR * zoneFactor * standingFactor;

      var occupancy = 0.68; // target occupancy with professional management
      var nightsPerMonth = occupancy * 30;
      var monthlyLow = adr * nightsPerMonth * 0.82;
      var monthlyHigh = adr * nightsPerMonth * 1.18;
      var monthlyMid = (monthlyLow + monthlyHigh) / 2;

      amountEl.textContent = formatMAD(monthlyMid);
      rangeEl.textContent = formatMAD(monthlyLow) + " — " + formatMAD(monthlyHigh) + " / mois estimé";
      occEl.textContent = Math.round(occupancy * 100) + " %";
      adrEl.textContent = formatMAD(adr);
      nightsEl.textContent = Math.round(nightsPerMonth) + " nuits/mois";
    }

    calcForm.addEventListener("input", compute);
    compute();

    calcForm.addEventListener("submit", function (e) {
      e.preventDefault();
      compute();
      var resultPanel = document.getElementById("calc-result-panel");
      if (resultPanel) resultPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
})();
