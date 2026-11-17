(function () {
  "use strict";

  function setNotice(el, message, kind) {
    if (!el) return;
    el.textContent = message || "";
    el.className = "notice" + (kind ? " " + kind : "");
    el.hidden = !message;
  }

  function api(url, options) {
    return fetch(url, options || {}).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) {
          throw new Error((payload && payload.message) || "Request failed (" + response.status + ")");
        }
        return payload;
      });
    });
  }

  var loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var notice = document.getElementById("login-notice");
      var button = loginForm.querySelector("button");
      button.disabled = true;
      api("/api/v1/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginForm.username.value,
          password: loginForm.password.value
        })
      })
        .then(function () {
          window.location.href = "/admin/overview";
        })
        .catch(function (error) {
          setNotice(notice, error.message, "error");
          button.disabled = false;
        });
    });
  }

  function copyText(text, onSuccess, onFailure) {
    if (!text) {
      if (onFailure) onFailure();
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess, function () {
        fallbackCopy(text, onSuccess, onFailure);
      });
      return;
    }
    fallbackCopy(text, onSuccess, onFailure);
  }

  function fallbackCopy(text, onSuccess, onFailure) {
    try {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(area);
      if (ok && onSuccess) onSuccess();
      else if (!ok && onFailure) onFailure();
    } catch (e) {
      if (onFailure) onFailure();
    }
  }

  var voucherForm = document.getElementById("voucher-form");
  if (voucherForm) {
    voucherForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var notice = document.getElementById("voucher-notice");
      var result = document.getElementById("voucher-result");
      var button = voucherForm.querySelector("button");
      button.disabled = true;
      setNotice(notice, "", "");
      if (result) result.hidden = true;

      var rawTTL = (voucherForm.ttl_seconds.value || "").trim();
      var ttl = rawTTL === "" ? 0 : parseInt(rawTTL, 10);
      if (rawTTL !== "" && (!(ttl > 0) || ttl < 60 || ttl > 86400)) {
        setNotice(notice, "Masa berlaku harus 60-86400 detik atau dikosongkan untuk default.", "error");
        button.disabled = false;
        return;
      }
      var payload = { note: voucherForm.note.value || "" };
      if (ttl > 0) payload.ttl_seconds = ttl;

      api("/api/v1/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (apiResult) {
          var voucher = apiResult.data;
          var usernameEl = document.getElementById("voucher-username");
          var passwordEl = document.getElementById("voucher-password");
          if (usernameEl) usernameEl.textContent = voucher.username || "—";
          if (passwordEl) passwordEl.textContent = voucher.password || "—";
          if (result) result.hidden = false;
          setNotice(notice, "Voucher " + voucher.username + " diterbitkan. Salin kredensial sebelum berpindah halaman.", "ok");
          button.disabled = false;
        })
        .catch(function (error) {
          setNotice(notice, error.message, "error");
          button.disabled = false;
        });
    });
  }

  var copyButton = document.getElementById("voucher-copy");
  if (copyButton) {
    copyButton.addEventListener("click", function () {
      var notice = document.getElementById("voucher-copy-notice");
      var username = (document.getElementById("voucher-username") || {}).textContent || "";
      var password = (document.getElementById("voucher-password") || {}).textContent || "";
      if (!username || !password || username === "—" || password === "—") {
        setNotice(notice, "Belum ada kredensial untuk disalin.", "error");
        return;
      }
      copyText(username + " / " + password, function () {
        setNotice(notice, "Kredensial tersalin ke clipboard.", "ok");
      }, function () {
        setNotice(notice, "Clipboard diblokir browser. Salin manual dari kolom di atas.", "error");
      });
    });
  }

  var logout = document.getElementById("logout-button");
  if (logout) {
    logout.addEventListener("click", function () {
      api("/api/v1/admin/auth/logout", { method: "POST" })
        .catch(function () { return null; })
        .then(function () {
          window.location.href = "/admin/login";
        });
    });
  }
})();
