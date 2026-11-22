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
  var surveyTiers = document.getElementById("survey-tiers");
  var tierSurveyVal = document.getElementById("tier-survey-val");
  var tierSurveyDesc = document.getElementById("tier-survey-desc");
  var tierDefaultVal = document.getElementById("tier-default-val");
  var tierDefaultDesc = document.getElementById("tier-default-desc");
  var edgeProgressFill = document.getElementById("ad-edge-progress-fill");
  var muteBtn = document.getElementById("ad-mute-btn");
  var muteLabel = document.getElementById("ad-mute-label");
  var openVoucherBtn = document.getElementById("open-voucher-btn");
  var voucherModal = document.getElementById("voucher-modal");
  var voucherBackdrop = document.getElementById("voucher-modal-backdrop");
  var closeVoucherBtn = document.getElementById("close-voucher-btn");
  var voucherCodeInput = document.getElementById("voucher-code");
  var voucherPassInput = document.getElementById("voucher-password");
  var voucherSubmitBtn = document.getElementById("voucher-submit-btn");
  var voucherStatus = document.getElementById("voucher-status");
  var livePanel = document.getElementById("live-session-panel");
  var liveStatus = document.getElementById("live-status");
  var refreshSessionBtn = document.getElementById("refresh-session-btn");
  var disconnectSessionBtn = document.getElementById("disconnect-session-btn");
  var redirectHintWrap = document.getElementById("redirect-hint-wrap");
  var form = document.getElementById("hotspot-form");
  var videoStallTimer = null;
  var videoCnaFallbackTimer = null;
  var videoWatchedSeconds = 0;

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

  function getJSON(url) {
    return fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" }
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
  function paintProgressRatio(ratio, displaySeconds) {
    var clamped = Math.min(1, Math.max(0, ratio));
    countdownEls.forEach(function (el) { el.textContent = String(displaySeconds); });
    countdownInlineEls.forEach(function (el) { el.textContent = String(displaySeconds); });
    rings.forEach(function (r) {
      r.style.strokeDashoffset = String(RING_LEN * clamped);
    });
    if (edgeProgressFill) {
      edgeProgressFill.style.width = String(Math.round(clamped * 100)) + "%";
    }
  }

  function paintCountdown() {
    var ratio = adDuration > 0 ? (adDuration - secondsLeft) / adDuration : 1;
    paintProgressRatio(ratio, secondsLeft);
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
    var playOverlay = document.getElementById("ad-play-overlay");
    var started = false;
    var finished = false;
    videoWatchedSeconds = 0;
    window.clearTimeout(videoStallTimer);
    window.clearTimeout(videoCnaFallbackTimer);
    if (edgeProgressFill) edgeProgressFill.style.width = "0%";
    function clearVideoTimers() {
      window.clearTimeout(videoStallTimer);
      window.clearTimeout(videoCnaFallbackTimer);
    }
    function setTimerLabelCountdown(rem) {
      if (labelEl) {
        labelEl.innerHTML = 'Sisa <strong id="countdown">' + rem + '</strong> dtk';
        countdownEls = [
          document.getElementById("countdown"),
          document.getElementById("countdown-portrait")
        ].filter(Boolean);
      }
    }
    function beginTimerOnce() {
      if (started || finished) return;
      started = true;
      clearVideoTimers();
      setTimerLabelCountdown(adDuration);
      applyAdLayout();
      startCountdown();
    }
    if (vid) {
      var lastTime = Number(vid.currentTime || 0);
      var hasPlayedFrame = false;

      function setBufferingLabel() {
        if (finished) return;
        if (labelEl) {
          labelEl.textContent = hasPlayedFrame ? "Buffering..." : "Memuat video...";
        }
      }

      function completeVideoAd() {
        if (finished) return;
        finished = true;
        clearVideoTimers();
        if (playOverlay) playOverlay.hidden = true;
        secondsLeft = 0;
        videoWatchedSeconds = Math.max(videoWatchedSeconds, adDuration);
        paintProgressRatio(1, 0);
        finishCountdown();
      }

      function resetNoProgressGuard() {
        window.clearTimeout(videoCnaFallbackTimer);
        if (finished) return;
        // Safety net only if video makes zero playback progress for 20s (broken CNA/network).
        videoCnaFallbackTimer = window.setTimeout(function () {
          if (finished) return;
          setNotice(statusEl, "Koneksi video lambat. Anda tetap dapat melanjutkan setelah hitung mundur.", "");
          beginTimerOnce();
        }, 20000);
      }

      function onVideoTimeUpdate() {
        if (finished || started) return;
        if (vid.paused || vid.ended) return;
        var curr = Number(vid.currentTime || 0);
        var delta = curr - lastTime;
        lastTime = curr;
        // Count only genuine forward playback (ignore seeks or loop resets).
        if (delta > 0 && delta < 1.5) {
          if (!hasPlayedFrame) {
            hasPlayedFrame = true;
            if (playOverlay) playOverlay.hidden = true;
            setTimerLabelCountdown(Math.max(1, Math.ceil(adDuration - videoWatchedSeconds)));
            applyAdLayout();
          }
          videoWatchedSeconds += delta;
          resetNoProgressGuard();
          var remaining = Math.max(0, Math.ceil(adDuration - videoWatchedSeconds));
          secondsLeft = remaining;
          paintProgressRatio(adDuration > 0 ? videoWatchedSeconds / adDuration : 1, remaining);
          if (videoWatchedSeconds >= adDuration) {
            completeVideoAd();
          }
        }
      }

      function onVideoEnded() {
        if (finished || started) return;
        var dur = Number(vid.duration || 0);
        // Complete if watched enough or the clip itself played through its full duration (>= adDuration - 0.6s).
        if (videoWatchedSeconds >= adDuration - 0.6 || (hasPlayedFrame && dur > 0 && dur >= adDuration - 0.6)) {
          completeVideoAd();
          return;
        }
        // Short clip vs longer adDuration: seamlessly replay until adDuration is satisfied.
        lastTime = 0;
        try {
          vid.currentTime = 0;
          var rp = vid.play();
          if (rp && typeof rp.catch === "function") rp.catch(function () {});
        } catch (e) { /* ignore */ }
      }

      function tryStartPlay() {
        if (finished) return;
        var p = vid.play();
        if (p && typeof p.then === "function") {
          p.then(function () {
            if (playOverlay) playOverlay.hidden = true;
          }).catch(function () {
            // Autoplay blocked on mobile webview: reveal tap-to-play CTA.
            if (playOverlay && !finished) playOverlay.hidden = false;
            if (labelEl && !hasPlayedFrame) labelEl.textContent = "Ketuk untuk putar";
          });
        }
      }

      if (playOverlay) {
        playOverlay.hidden = true;
        playOverlay.onclick = function () {
          playOverlay.hidden = true;
          setBufferingLabel();
          tryStartPlay();
        };
      }

      setBufferingLabel();
      paintProgressRatio(0, adDuration);
      resetNoProgressGuard();

      vid.addEventListener("timeupdate", onVideoTimeUpdate);
      vid.addEventListener("ended", onVideoEnded);
      vid.addEventListener("waiting", setBufferingLabel);
      vid.addEventListener("stalled", setBufferingLabel);
      vid.addEventListener("playing", function () {
        if (finished || started) return;
        if (playOverlay) playOverlay.hidden = true;
        lastTime = Number(vid.currentTime || 0);
        var rem = Math.max(1, Math.ceil(adDuration - videoWatchedSeconds));
        setTimerLabelCountdown(rem);
        resetNoProgressGuard();
      });
      vid.addEventListener("error", function () {
        if (finished) return;
        if (playOverlay) playOverlay.hidden = true;
        setNotice(statusEl, "Video gagal dimuat di perangkat ini.", "");
        beginTimerOnce();
      }, { once: true });

      tryStartPlay();
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

  var settings = (cfg && cfg.settings) || {};
  var adMetricsSent = false;
  function sendAdMetrics(completed, watchSec) {
    if (adMetricsSent || !sessionToken || sessionToken === "auto-resume") return;
    adMetricsSent = true;
    try {
      postJSON("/api/v1/portal-sessions/" + encodeURIComponent(sessionToken) + "/ad-metrics", {
        completed: !!completed,
        watch_seconds: Math.max(0, Math.round(Number(watchSec || 0)))
      }).catch(function () { /* fire-and-forget telemetry */ });
    } catch (e) { /* ignore */ }
  }

  // ---------- Redirect countdown (connected -> Promo or Google) ----------
  function redirectTarget() {
    if (lastPromoUrl) {
      try {
        return new URL(lastPromoUrl, window.location.origin).toString();
      } catch (e) { /* fallback */ }
    }
    var target = (cfg.linkOrig || "").trim ? (cfg.linkOrig || "").trim() : (cfg.linkOrig || "");
    if (target) {
      try {
        var parsed = new URL(target, window.location.href);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
      } catch (e) { /* abaikan, pakai fallback */ }
    }
    var defaultUrl = settings["portal.default_redirect_url"];
    if (defaultUrl && /^https?:\/\//i.test(defaultUrl)) {
      return defaultUrl;
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

  function formatBytes(bytes) {
    bytes = Number(bytes || 0);
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }
  function formatClockDuration(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds || 0)));
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (h > 0) return h + " jam " + m + " mnt";
    if (m > 0) return m + " mnt " + s + " dtk";
    return s + " dtk";
  }
  function paintSurveyTiers(data) {
    if (!surveyTiers || !data) return;
    var defP = data.default_profile;
    var survP = data.survey_profile;
    if (!defP && !survP) {
      surveyTiers.hidden = true;
      return;
    }
    if (survP && tierSurveyVal && tierSurveyDesc) {
      tierSurveyVal.textContent = formatSpeed(survP.bandwidth_down_kbps);
      tierSurveyDesc.textContent = formatDuration(survP.session_timeout_seconds) + " · " + (survP.display_name || "Akses Cepat");
    }
    if (defP && tierDefaultVal && tierDefaultDesc) {
      tierDefaultVal.textContent = formatSpeed(defP.bandwidth_down_kbps);
      tierDefaultDesc.textContent = formatDuration(defP.session_timeout_seconds) + " · " + (defP.display_name || "Standar");
    }
    surveyTiers.hidden = false;
  }
  function showLiveActiveSession(info) {
    showScreen("connected");
    stopRedirectCountdown();
    if (livePanel) livePanel.hidden = false;
    if (redirectHintWrap) redirectHintWrap.hidden = true;
    var link = document.getElementById("redirect-now");
    if (link) {
      link.textContent = "Mulai Browsing";
      link.href = redirectTarget();
    }
    var setText = function (id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setText("connected-title", "Wi-Fi Sedang Aktif");
    setText("connected-subtitle", "Perangkat Anda sudah terhubung ke internet.");
    setText("live-profile", info.profile_display || formatSpeed(info.bandwidth_down_kbps));
    setText("live-remaining", info.remaining_seconds > 0 ? formatClockDuration(info.remaining_seconds) : "Aktif");
    setText("live-traffic", formatBytes((info.input_octets || 0) + (info.output_octets || 0)));
    setText("live-uptime", formatClockDuration(info.uptime_seconds || 0));
    setText("live-username", info.username || "—");
    setText("live-router", info.router_name || cfg.nasIdentifier || "Hotspot");
  }
  function showConnected(data) {
    if (livePanel) livePanel.hidden = true;
    if (redirectHintWrap) redirectHintWrap.hidden = false;
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
    var vid = document.getElementById("ad-video");
    if (vid && typeof vid.pause === "function") {
      try { vid.pause(); } catch (e) { /* ignore */ }
    }
    sendAdMetrics(true, Math.max(adDuration, Math.round(videoWatchedSeconds || 0)));
    if (settings["portal.enable_survey"] === "false") {
      submitSurveyAndConnect(true);
      return;
    }
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
    var dynInputs = document.querySelectorAll("[data-qkey]");
    for (var i = 0; i < dynInputs.length; i++) {
      dynInputs[i].disabled = busy;
    }
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
    var answers = {};
    var dynInputs = document.querySelectorAll("[data-qkey]");
    var hasDyn = dynInputs.length > 0;
    var filledCount = 0;

    if (hasDyn && !skipped) {
      for (var i = 0; i < dynInputs.length; i++) {
        var el = dynInputs[i];
        var k = el.getAttribute("data-qkey");
        var v = (el.value || "").trim();
        var req = el.getAttribute("data-qreq") === "1";
        if (req && !v) {
          setNotice(surveyStatus, "Mohon lengkapi semua kolom bertanda (*), atau pilih tombol Lewati.", "error");
          el.focus();
          return;
        }
        if (v) {
          answers[k] = v;
          filledCount++;
        }
      }
      if (filledCount === 0) {
        setNotice(surveyStatus, "Silakan isi minimal satu data di atas, atau pilih tombol Lewati.", "error");
        return;
      }
    } else if (!hasDyn && !skipped && !email && !phone) {
      setNotice(surveyStatus, "Silakan isi Email atau Nomor WhatsApp, atau pilih tombol Lewati di bawah.", "error");
      return;
    }

    setSurveyBusy(true, "Menghubungkan ke internet...");

    postJSON("/api/v1/portal-sessions/" + encodeURIComponent(sessionToken) + "/survey", {
      email: email,
      phone: phone,
      answers: answers,
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
        paintSurveyTiers(data);
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
  if (muteBtn) {
    muteBtn.addEventListener("click", function () {
      var vid = document.getElementById("ad-video");
      if (!vid) return;
      vid.muted = !vid.muted;
      if (muteLabel) muteLabel.textContent = vid.muted ? "Suara Mati" : "Suara Aktif";
      muteBtn.setAttribute("aria-label", vid.muted ? "Nyalakan suara video" : "Matikan suara video");
    });
  }
  function toggleVoucherModal(open) {
    if (!voucherModal) return;
    voucherModal.hidden = !open;
    if (open) {
      setNotice(voucherStatus, "", "");
      if (voucherCodeInput) voucherCodeInput.focus();
    }
  }
  if (openVoucherBtn) {
    openVoucherBtn.addEventListener("click", function () { toggleVoucherModal(true); });
  }
  if (closeVoucherBtn) {
    closeVoucherBtn.addEventListener("click", function () { toggleVoucherModal(false); });
  }
  if (voucherBackdrop) {
    voucherBackdrop.addEventListener("click", function () { toggleVoucherModal(false); });
  }
  if (voucherSubmitBtn) {
    voucherSubmitBtn.addEventListener("click", function () {
      if (!sessionToken) {
        setNotice(voucherStatus, "Sesi portal sedang disiapkan, tunggu sebentar lalu coba lagi.", "error");
        return;
      }
      var code = voucherCodeInput ? voucherCodeInput.value.trim() : "";
      var pass = voucherPassInput ? voucherPassInput.value.trim() : "";
      if (!code) {
        setNotice(voucherStatus, "Masukkan kode atau username voucher terlebih dahulu.", "error");
        return;
      }
      voucherSubmitBtn.disabled = true;
      voucherSubmitBtn.textContent = "Memeriksa voucher...";
      setNotice(voucherStatus, "", "");
      postJSON("/api/v1/portal-sessions/" + encodeURIComponent(sessionToken) + "/redeem", {
        code: code,
        username: code,
        password: pass
      })
        .then(function (data) {
          toggleVoucherModal(false);
          lastConnectHadHotspot = !!(data && data.link_login_only);
          showConnected(data);
          if (data && data.link_login_only) {
            window.setTimeout(function () { submitToHotspot(data); }, 800);
          }
        })
        .catch(function (err) {
          setNotice(voucherStatus, err.message || "Voucher tidak valid.", "error");
        })
        .finally(function () {
          voucherSubmitBtn.disabled = false;
          voucherSubmitBtn.textContent = "Gunakan Voucher";
        });
    });
  }
  function fetchActiveSession(onNotActive) {
    if (!cfg.mac) {
      if (onNotActive) onNotActive();
      return;
    }
    var qs = "?mac=" + encodeURIComponent(cfg.mac);
    if (cfg.nasIdentifier) qs += "&nasid=" + encodeURIComponent(cfg.nasIdentifier);
    getJSON("/api/v1/portal-sessions/active" + qs)
      .then(function (data) {
        if (data && data.active) {
          showLiveActiveSession(data);
          setNotice(liveStatus, "", "");
        } else if (onNotActive) {
          onNotActive();
        }
      })
      .catch(function () {
        if (onNotActive) onNotActive();
      });
  }
  if (refreshSessionBtn) {
    refreshSessionBtn.addEventListener("click", function () {
      refreshSessionBtn.disabled = true;
      refreshSessionBtn.textContent = "Memuat...";
      fetchActiveSession(function () {
        showScreen("welcome");
        createSession();
      });
      window.setTimeout(function () {
        refreshSessionBtn.disabled = false;
        refreshSessionBtn.textContent = "Segarkan Status";
      }, 600);
    });
  }
  if (disconnectSessionBtn) {
    disconnectSessionBtn.addEventListener("click", function () {
      disconnectSessionBtn.disabled = true;
      disconnectSessionBtn.textContent = "Memutus...";
      postJSON("/api/v1/portal-sessions/disconnect", {
        mac: cfg.mac || "",
        nas_identifier: cfg.nasIdentifier || "",
        link_logout: cfg.linkLogout || ""
      })
        .then(function (res) {
          if (res && !res.coa_sent && res.logout_url) {
            window.location.href = res.logout_url;
            return;
          }
          setNotice(liveStatus, (res && res.message) || "Koneksi berhasil diputuskan.", "");
          window.setTimeout(function () {
            showScreen("welcome");
            createSession();
          }, 1200);
        })
        .catch(function (err) {
          setNotice(liveStatus, err.message || "Gagal memutus koneksi.", "error");
        })
        .finally(function () {
          disconnectSessionBtn.disabled = false;
          disconnectSessionBtn.textContent = "Putuskan Koneksi";
        });
    });
  }
  applyAdLayout();
  watchAdImage();
  // Auto-detect active RADIUS session first; if none (or fails), fall back to normal welcome flow.
  fetchActiveSession(function () {
    createSession();
  });
})();
