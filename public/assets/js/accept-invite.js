const form = document.querySelector("#accept-invite-form");
const feedback = document.querySelector("#accept-invite-feedback");
const success = document.querySelector("#accept-invite-success");
const unavailable = document.querySelector("#accept-invite-unavailable");
const pendingInviteKey = "kurostore-pending-invite";

let pendingInvite = null;
try {
  const saved = JSON.parse(sessionStorage.getItem(pendingInviteKey) || "null");
  if (saved && typeof saved.accessToken === "string" && saved.accessToken.length > 0) {
    pendingInvite = saved;
  }
} catch (error) {
  console.error("Unable to read pending seller invitation:", error);
}

if (new URLSearchParams(window.location.search).get("state") === "unavailable" || !pendingInvite) {
  form.hidden = true;
  unavailable.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = form.querySelector("#invite-password");
  const passwordConfirm = form.querySelector("#invite-password-confirm");
  const submitButton = form.querySelector('button[type="submit"]');

  if (!(password instanceof HTMLInputElement)
    || !(passwordConfirm instanceof HTMLInputElement)
    || !(feedback instanceof HTMLElement)
    || !(submitButton instanceof HTMLButtonElement)
    || !pendingInvite) {
    return;
  }

  feedback.textContent = "";
  if (password.value !== passwordConfirm.value) {
    feedback.textContent = "Konfirmasi kata sandi belum sama.";
    passwordConfirm.focus();
    return;
  }

  submitButton.disabled = true;
  try {
    const response = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: pendingInvite.accessToken,
        password: password.value,
      }),
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 409) {
        sessionStorage.removeItem(pendingInviteKey);
        pendingInvite = null;
        form.hidden = true;
        unavailable.hidden = false;
      }
      throw new Error(typeof data?.error === "string" ? data.error : "Undangan tidak dapat diterima saat ini.");
    }

    sessionStorage.removeItem(pendingInviteKey);
    pendingInvite = null;
    password.value = "";
    passwordConfirm.value = "";
    form.hidden = true;
    success.hidden = false;
  } catch (error) {
    feedback.textContent = error instanceof Error ? error.message : "Undangan tidak dapat diterima saat ini.";
  } finally {
    submitButton.disabled = false;
  }
});
