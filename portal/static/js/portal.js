(function () {
  "use strict";

  var cfg = (function () {
    var el = document.getElementById("portal-config");
    if (!el) return {};
    try {
      return JSON.parse(el.textContent) || {};
    } catch (e) {
      return {};
    }
  })();
  var adDuration = Number(cfg.adDuration || 5);

  var screens = {
    welcome: document.querySelector('[data-screen="welcome"]'),
    ad: document.querySelector('[data-screen="ad"]'),
    survey: document.querySelector('[data-screen="survey"]'),
    connected: document.querySelector('[data-screen="connected"]')
  };
  var brandbar = document.querySelector(".brandbar");
  var appFooter = document.querySelector(".app-footer");
  var startButton = document.getElementById("start-button");
  var connectButtonLandscape = document.getElementById("connect-button");
  var connectButtonPortrait = document.getElementById("connect-button-portrait");
  var statusEl = document.getElementById("status");
  var welcomeStatus = document.getElementById("welcome-status");
  var surveyEmail = document.getElementById("survey-email");
  var surveyPhone = document.getElementById("survey-phone");
  var surveySubmitBtn = document.getElementById("survey-submit-button");
  var surveySkipBtn = document.getElementById("survey-skip-button");
  var surveyStatus = document.getElementById("survey-status");
  var form = document.getElementById("hotspot-form");

  var sessionToken = null;
  var sessionReady = false;
  var sessionFailed = false;
  var startRequested = false;
  var secondsLeft = adDuration;
  var countdownTimer = null;
  var redirectTimer = null;
  var redirectLeft = 10;
  // r=20 => 2*pi*20 ≈ 125.6
  var REDIRECT_LEN = 2 * Math.PI * 20;

  // Ring circumference for r=52 => 2*pi*52 ≈ 326.7
  var RING_LEN = 2 * Math.PI * 52;
  var rings = [
    document.getElementById("ring-progress"),
    document.getElementById("ring-progress-portrait")
  ].filter(Boolean);
  rings.forEach(function (r) {
    r.style.strokeDasharray = RING_LEN;
    r.style.strokeDashoffset = 0;
  });

  var countdownEls = [
    document.getElementById("countdown"),
    document.getElementById("countdown-portrait")
  ].filter(Boolean);

  var countdownInlineEls = [
    document.getElementById("countdown-inline"),
    document.getElementById("countdown-inline-portrait")
  ].filter(Boolean);

  var connectButtons = [connectButtonLandscape, connectButtonPortrait].filter(Boolean);

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      var el = screens[key];
      if (!el) return;
      el.classList.toggle("is-active", key === name);
    });
    // Halaman ad dan connected itu full takeover: brandbar + footer disembunyikan
    // agar fokus penuh ke materi iklan dan status koneksi tanpa gangguan header.
    var isConnected = name === "connected";
    var isAd = name === "ad";
    var isSurvey = name === "survey";
    document.body.classList.toggle("is-connected", isConnected);
    document.body.classList.toggle("is-ad", isAd);
    document.body.classList.toggle("is-survey", isSurvey);
    if (brandbar) brandbar.hidden = isConnected || isAd;
    if (appFooter) appFooter.hidden = isConnected || isAd;
    if (!isConnected) stopRedirectCountdown();
  }

  function setNotice(el, message, kind) {
    if (!el) return;
    el.textContent = message || "";
    el.className = "notice" + (kind ? " " + kind : "");
    el.hidden = !message;
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) {
          var message = (payload && payload.message) || "Request gagal";
          throw new Error(message);
        }
        return payload.data;
      });
    });
  }

  // ---------- Countdown ring ----------
  function paintCountdown() {
    countdownEls.forEach(function (el) { el.textContent = String(secondsLeft); });
    countdownInlineEls.forEach(function (el) { el.textContent = String(secondsLeft); });
    if (adDuration > 0) {
      var elapsed = adDuration - secondsLeft;
      var ratio = elapsed / adDuration;
      rings.forEach(function (r) {
        r.style.strokeDashoffset = String(RING_LEN * ratio);
      });
    }
  }

  function startCountdown() {
    secondsLeft = adDuration;
    paintCountdown();
    connectButtons.forEach(function (btn) {
      btn.disabled = true;
    });
    if (screens.ad) screens.ad.classList.remove("is-ready");
    window.clearTimeout(countdownTimer);

    function tick() {
      if (secondsLeft > 0) {
        secondsLeft -= 1;
        paintCountdown();
        if (secondsLeft > 0) {
          countdownTimer = window.setTimeout(tick, 1000);
        } else {
          finishCountdown();
        }
      }
    }
    countdownTimer = window.setTimeout(tick, 1000);
  }

  function finishCountdown() {
    paintCountdown();
    if (screens.ad) screens.ad.classList.add("is-ready");
    connectButtons.forEach(function (btn) {
      btn.disabled = false;
    });
  }

  // ---------- Hotspot credential submit ----------
  function md5Hex(input) {
    return window.md5 ? window.md5(input) : "";
  }

  // RouterOS 5.x kirim chap-id dan chap-challenge sebagai octal escape string.
  // Contoh: "\144" = satu byte desimal 100. "\056\237" = dua byte [46, 159].
  // Fungsi ini parse string tersebut jadi array of byte numbers.
  function parseOctetString(str) {
    var bytes = [];
    var i = 0;
    while (i < str.length) {
      if (str[i] === "\\" && i + 1 < str.length) {
        // octal escape: \NNN
        var octalStr = "";
        var j = i + 1;
        while (j < str.length && j < i + 4 && str[j] >= "0" && str[j] <= "7") {
          octalStr += str[j];
          j++;
        }
        if (octalStr.length > 0) {
          bytes.push(parseInt(octalStr, 8));
          i = j;
        } else {
          bytes.push(str.charCodeAt(i));
          i++;
        }
      } else {
        bytes.push(str.charCodeAt(i));
        i++;
      }
    }
    return bytes;
  }

  // Only ever submit credentials back to the same origin that served this
  // portal unless the backend explicitly points at the Hotspot. This is a
  // defence-in-depth check: the backend already allowlists link-login-only.
  function isSafeAction(url) {
    try {
      var target = new URL(url, window.location.href);
      return target.protocol === "http:" || target.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function submitToHotspot(data) {
    if (!data.link_login_only || !isSafeAction(data.link_login_only)) {
      setNotice(statusEl, "Alamat login Hotspot tidak valid.", "error");
      return;
    }
    form.action = data.link_login_only;
    form.querySelector("[name=username]").value = data.username;

    var passwordField = form.querySelector("[name=password]");
    if (data.auth_mode === "CHAP" && data.chap_id && data.chap_challenge) {
      // RouterOS kirim chap-id dan chap-challenge sebagai octal escape string.
      // CHAP hash = MD5(chapId_byte || password_bytes || challenge_bytes).
      // WAJIB menggunakan raw byte MD5 (bukan string MD5) karena challenge
      // sering mengandung byte > 127 yang akan salah di-encode UTF-8 oleh md5().
      var chapId = parseOctetString(data.chap_id)[0] || 0;
      var challengeBytes = parseOctetString(data.chap_challenge);

      // Encode password sebagai raw latin-1 bytes (password voucher adalah ASCII)
      var passBytes = [];
      for (var pi = 0; pi < data.password.length; pi++) {
        passBytes.push(data.password.charCodeAt(pi) & 0xFF);
      }

      // Susun input: [chapId] + passwordBytes + challengeBytes
      var chapInput = [chapId].concat(passBytes).concat(challengeBytes);
      passwordField.value = window.md5Raw ? window.md5Raw(chapInput) : "";

      var dst = form.querySelector("[name=dst]");
      var finalDst = data.promo_url ? new URL(data.promo_url, window.location.origin).toString() : data.link_orig;
      if (dst && finalDst) dst.value = finalDst;
    } else {
      passwordField.value = data.password;
      var dstPap = form.querySelector("[name=dst]");
      var finalDstPap = data.promo_url ? new URL(data.promo_url, window.location.origin).toString() : data.link_orig;
      if (dstPap && finalDstPap) dstPap.value = finalDstPap;
    }
    form.submit();
  }

  function enterAdScreen() {
    showScreen("ad");
    setNotice(statusEl, "", "");
    connectButtons.forEach(function (btn) {
      btn.disabled = true;
    });
    if (screens.ad) screens.ad.classList.remove("is-ready");
    applyAdLayout();

    var vid = document.getElementById("ad-video");
    var img = document.getElementById("ad-image");
    var labelEl = document.getElementById("ad-timer-label-text");
    var started = false;

    function beginTimerOnce() {
      if (started) return;
      started = true;
      if (labelEl) {
        labelEl.innerHTML = 'Sisa <strong id="countdown">' + adDuration + '</strong> dtk';
        countdownEls = [
          document.getElementById("countdown"),
          document.getElementById("countdown-portrait")
        ].filter(Boolean);
      }
      applyAdLayout();
      startCountdown();
    }

    if (vid) {
      if (labelEl) labelEl.textContent = "Memuat iklan...";
      countdownEls.forEach(function (el) { el.textContent = "…"; });

      var onReady = function () {
        vid.removeEventListener("playing", onReady);
        vid.removeEventListener("canplay", onReady);
        beginTimerOnce();
      };

      if (vid.readyState >= 3) {
        var p = vid.play();
        if (p && typeof p.then === "function") {
          p.then(beginTimerOnce).catch(beginTimerOnce);
        } else {
          beginTimerOnce();
        }
      } else {
        vid.addEventListener("playing", onReady);
        vid.addEventListener("canplay", onReady);
        vid.addEventListener("error", beginTimerOnce, { once: true });
        var playPromise = vid.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function () {
            // Autoplay fallback
          });
        }
      }
      return;
    }

    if (img) {
      if (img.complete && img.naturalWidth > 0) {
        beginTimerOnce();
      } else {
        if (labelEl) labelEl.textContent = "Memuat iklan...";
        countdownEls.forEach(function (el) { el.textContent = "…"; });
        img.addEventListener("load", beginTimerOnce, { once: true });
        img.addEventListener("error", beginTimerOnce, { once: true });
      }
      return;
    }

    beginTimerOnce();
  }

  // ---------- Ad layout: follows configuration + natural media aspect ratio ----------
  function setAdLayout(mode) {
    var section = screens.ad;
    if (!section) return;
    section.classList.remove("ad-layout--landscape", "ad-layout--portrait");
    section.classList.add(mode === "portrait" ? "ad-layout--portrait" : "ad-layout--landscape");
  }

  function applyAdLayout() {
    var section = screens.ad;
    var img = document.getElementById("ad-image");
    var vid = document.getElementById("ad-video");
    if (section) {
      if (img && img.naturalWidth && img.naturalHeight) {
        section.classList.toggle("is-landscape-media", img.naturalWidth >= img.naturalHeight);
      } else if (vid && vid.videoWidth && vid.videoHeight) {
        section.classList.toggle("is-landscape-media", vid.videoWidth >= vid.videoHeight);
      }
    }
    var mode = (cfg.adLayout || "").toLowerCase();
    if (mode === "portrait" || mode === "landscape") {
      setAdLayout(mode);
      return;
    }
    if (section && section.classList.contains("ad-layout--portrait")) {
      setAdLayout("portrait");
      return;
    }
    setAdLayout("landscape");
  }

  function watchAdImage() {
    var img = document.getElementById("ad-image");
    var vid = document.getElementById("ad-video");
    if (vid) {
      vid.addEventListener("loadedmetadata", applyAdLayout);
    }
    if (!img) {
      applyAdLayout();
      return;
    }
    if (img.complete && img.naturalWidth) {
      applyAdLayout();
      return;
    }
    img.addEventListener("load", applyAdLayout);
    img.addEventListener("error", applyAdLayout);
  }

  // ---------- Connected screen ----------
  // Only renders data returned by /connect: voucher username, session timeout
  // and voucher expiry. No decorative timers or fake stats.
  function formatDuration(seconds) {
    seconds = Number(seconds || 0);
    if (!(seconds > 0)) return "—";
    if (seconds >= 3600) return Math.round(seconds / 3600) + " Jam";
    if (seconds >= 60) return Math.round(seconds / 60) + " Menit";
    return seconds + " dtk";
  }

  function formatExpiry(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  }

  var lastPromoUrl = "";

  // ---------- Redirect countdown (connected -> Promo or Google) ----------
  function redirectTarget() {
    if (lastPromoUrl) {
      try {
        return new URL(lastPromoUrl, window.location.origin).toString();
      } catch (e) { /* fallback */ }
    }
    // MikroTik ngasih link-orig = halaman yang user mau buka sebelum kena portal.
    // Kalau ada, pakai itu; kalau enggak, fallback ke Google.
    var target = (cfg.linkOrig || "").trim ? (cfg.linkOrig || "").trim() : (cfg.linkOrig || "");
    if (target) {
      try {
        var parsed = new URL(target, window.location.href);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
      } catch (e) { /* abaikan, pakai fallback */ }
    }
    return "https://www.google.com";
  }

  function paintRedirect() {
    var countEls = [document.getElementById("conn-redirect-count"), document.getElementById("conn-redirect-inline")];
    countEls.forEach(function (el) {
      if (el) el.textContent = String(redirectLeft);
    });
    var ringEl = document.getElementById("redirect-progress");
    if (ringEl && redirectLeft >= 0) {
      var ratio = redirectLeft / 10;
      ringEl.style.strokeDasharray = REDIRECT_LEN;
      ringEl.style.strokeDashoffset = String(REDIRECT_LEN * (1 - ratio));
    }
    var link = document.getElementById("redirect-now");
    if (link) link.href = redirectTarget();
  }

  function stopRedirectCountdown() {
    window.clearTimeout(redirectTimer);
    redirectTimer = null;
  }

  function startRedirectCountdown() {
    stopRedirectCountdown();
    redirectLeft = 10;
    paintRedirect();
    function tick() {
      redirectLeft -= 1;
      if (redirectLeft <= 0) {
        redirectLeft = 0;
        paintRedirect();
        // Redirect beneran cuma kalau sesi Hotspot-nya nyata (ada link_login_only).
        // Di dev/laptop tanpa MikroTik, user tetap di halaman connected biar bisa dibaca.
        if (lastConnectHadHotspot) window.location.href = redirectTarget();
        return;
      }
      paintRedirect();
      redirectTimer = window.setTimeout(tick, 1000);
    }
    redirectTimer = window.setTimeout(tick, 1000);
  }

  var lastConnectHadHotspot = false;

  function formatSpeed(downKbps) {
    downKbps = Number(downKbps || 0);
    if (!(downKbps > 0)) return "Normal";
    if (downKbps >= 1024) {
      var mb = downKbps / 1024;
      return (mb % 1 === 0 ? mb : mb.toFixed(1)) + " Mbps";
    }
    return downKbps + " Kbps";
  }

  function showConnected(data) {
    lastPromoUrl = (data && data.promo_url) ? data.promo_url : "";
    var link = document.getElementById("redirect-now");
    if (link) {
      link.textContent = lastPromoUrl ? "Buka Halaman Promo" : "Mulai Browsing";
    }
    showScreen("connected");

    var durationLabel = formatDuration(data && data.session_timeout_seconds);
    var durEl = document.getElementById("conn-duration");
    if (durEl) durEl.textContent = durationLabel;

    var durDetail = document.getElementById("conn-duration-detail");
    if (durDetail) durDetail.textContent = durationLabel;

    var userEl = document.getElementById("conn-username");
    if (userEl) userEl.textContent = (data && data.username) ? data.username : "—";

    var speedLabel = formatSpeed(data && data.bandwidth_down_kbps);
    var speedEl = document.getElementById("conn-speed");
    if (speedEl) speedEl.textContent = speedLabel;

    var profileEl = document.getElementById("conn-profile");
    if (profileEl) {
      var isPremium = (data && data.bandwidth_down_kbps) >= 3000;
      profileEl.textContent = isPremium ? "Akses Cepat" : "Standar";
    }

    var expiryEl = document.getElementById("conn-expiry");
    if (expiryEl) expiryEl.textContent = formatExpiry(data && data.voucher_expires_at);

    startRedirectCountdown();
  }

  // ---------- Survey & Connect flow ----------
  function enterSurveyScreen() {
    showScreen("survey");
    setNotice(surveyStatus, "", "");
  }

  function setSurveyBusy(busy, message) {
    if (surveySubmitBtn) {
      surveySubmitBtn.disabled = busy;
      surveySubmitBtn.textContent = busy ? "Menghubungkan..." : "Simpan & Hubungkan";
    }
    if (surveySkipBtn) {
      surveySkipBtn.disabled = busy;
    }
    if (surveyEmail) surveyEmail.disabled = busy;
    if (surveyPhone) surveyPhone.disabled = busy;
    if (message) {
      setNotice(surveyStatus, message, "");
    }
  }

  function submitSurveyAndConnect(skipped) {
    if (!sessionToken) {
      setNotice(surveyStatus, "Sesi belum siap. Muat ulang halaman dan coba lagi.", "error");
      return;
    }
    var email = (surveyEmail && surveyEmail.value ? surveyEmail.value.trim() : "");
    var phone = (surveyPhone && surveyPhone.value ? surveyPhone.value.trim() : "");

    if (!skipped && !email && !phone) {
      setNotice(surveyStatus, "Silakan isi Email atau Nomor WhatsApp, atau pilih tombol Lewati di bawah.", "error");
      return;
    }

    setSurveyBusy(true, "Menghubungkan ke internet...");

    postJSON("/api/v1/portal-sessions/" + encodeURIComponent(sessionToken) + "/survey", {
      email: email,
      phone: phone,
      skipped: !!skipped
    })
      .then(function () {
        connect();
      })
      .catch(function (error) {
        setNotice(surveyStatus, error.message, "error");
        setSurveyBusy(false);
      });
  }

  // ---------- Connect action ----------
  function connect() {
    if (!sessionToken) {
      setNotice(surveyStatus, "Sesi portal belum siap. Muat ulang halaman dan coba lagi.", "error");
      return;
    }
    setSurveyBusy(true, "Menghubungkan ke jaringan...");

    postJSON("/api/v1/portal-sessions/" + encodeURIComponent(sessionToken) + "/connect")
      .then(function (data) {
        lastConnectHadHotspot = !!(data && data.link_login_only);
        if (!data.link_login_only) {
          // Dev/test mode: no MikroTik, show the connected screen directly.
          showConnected(data);
          return;
        }
        showConnected(data);
        // Kasih jeda baca 1.2s biar user sempat lihat status sebelum form
        // Hotspot auto-submit (MikroTik yang nentuin halaman setelah login).
        window.setTimeout(function () { submitToHotspot(data); }, 1200);
      })
      .catch(function (error) {
        setNotice(surveyStatus, error.message, "error");
        setSurveyBusy(false);
      });
  }

  // ---------- Portal session ----------
  function createSession() {
    postJSON("/api/v1/portal-sessions", {
      mac: cfg.mac || "",
      ip: cfg.ip || "",
      link_login_only: cfg.linkLoginOnly || "",
      link_login: cfg.linkLogin || "",
      link_orig: cfg.linkOrig || "",
      chap_id: cfg.chapId || "",
      chap_challenge: cfg.chapChallenge || "",
      nas_identifier: cfg.nasIdentifier || "",
      advertisement_id: cfg.adId || ""
    })
      .then(function (data) {
        if (data && data.auto_connect && data.connect_data) {
          lastConnectHadHotspot = !!(data.connect_data && data.connect_data.link_login_only);
          showConnected(data.connect_data);
          if (data.connect_data.link_login_only) {
            window.setTimeout(function () { submitToHotspot(data.connect_data); }, 600);
          }
          return;
        }
        sessionToken = data.session_token;
        sessionReady = true;
        sessionFailed = false;
        adDuration = Number(data.ad_duration_seconds || adDuration);
        if (startButton && startRequested) {
          startButton.disabled = false;
          startButton.textContent = "Hubungkan Sekarang";
        }
        // If the user already tapped "Mulai Koneksi", advance now.
        if (startRequested) enterAdScreen();
      })
      .catch(function (error) {
        sessionFailed = true;
        if (startButton) {
          startButton.disabled = false;
          startButton.textContent = "Coba Lagi";
        }
        setNotice(welcomeStatus, error.message + " Ketuk tombol untuk mencoba lagi.", "error");
      });
  }

  // ---------- Wire up ----------
  if (startButton) {
    startButton.addEventListener("click", function () {
      if (sessionReady) {
        enterAdScreen();
        return;
      }
      startRequested = true;
      if (sessionFailed) {
        sessionFailed = false;
        setNotice(welcomeStatus, "", "");
        startButton.disabled = true;
        startButton.textContent = "Menyiapkan...";
        createSession();
        return;
      }
      startButton.disabled = true;
      startButton.textContent = "Menyiapkan...";
    });
  }

  connectButtons.forEach(function (btn) {
    btn.addEventListener("click", enterSurveyScreen);
  });

  if (surveySubmitBtn) {
    surveySubmitBtn.addEventListener("click", function () {
      submitSurveyAndConnect(false);
    });
  }

  if (surveySkipBtn) {
    surveySkipBtn.addEventListener("click", function () {
      submitSurveyAndConnect(true);
    });
  }

  applyAdLayout();
  watchAdImage();
  createSession();
})();
