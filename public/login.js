const form = document.querySelector("#login-form");
const errorMessage = document.querySelector("#login-error");
const nameField = document.querySelector("#name-field");
const modeSwitch = document.querySelector("#mode-switch");
const submitButton = document.querySelector("#login-submit");
let registering = false;

const sessionNotice = sessionStorage.getItem("fraudlensSessionNotice");
if (sessionNotice) {
  sessionStorage.removeItem("fraudlensSessionNotice");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = sessionNotice;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 3500);
}

if (localStorage.getItem("fraudlensToken")) {
  window.location.replace("/");
}

function setMode(isRegistering) {
  registering = isRegistering;
  nameField.hidden = !registering;
  nameField.querySelector("input").required = registering;
  document.querySelector("#login-title").textContent = registering ? "Create your account" : "Sign in";
  document.querySelector("#login-subtitle").textContent = registering
    ? "Register to access the FraudLens dashboard."
    : "Enter your account details to continue.";
  document.querySelector("#switch-copy").textContent = registering
    ? "Already have an account?"
    : "New to FraudLens?";
  modeSwitch.textContent = registering ? "Sign in" : "Create an account";
  document.querySelector("#first-admin-note").hidden = !registering;
  form.elements.password.autocomplete = registering ? "new-password" : "current-password";
  submitButton.querySelector("span").textContent = registering ? "Create account" : "Sign in";
  errorMessage.hidden = true;
}

modeSwitch.addEventListener("click", () => setMode(!registering));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = registering ? "Creating account…" : "Signing in…";

  const formData = new FormData(form);
  const payload = {
    email: formData.get("email").trim(),
    password: formData.get("password")
  };
  if (registering) payload.name = formData.get("name").trim();

  try {
    const response = await fetch(`/api/auth/${registering ? "register" : "login"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      const details = Array.isArray(result.details)
        ? result.details.map((detail) => detail.message).join(" ")
        : "";
      throw new Error(details || result.error || `Request failed (${response.status}).`);
    }
    localStorage.setItem("fraudlensToken", result.token);
    window.location.replace("/");
  } catch (error) {
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = registering ? "Create account" : "Sign in";
  }
});
