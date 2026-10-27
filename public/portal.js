const portalToken = localStorage.getItem("fraudlensToken");
if (!portalToken) window.location.replace("/login.html");

async function portalFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${localStorage.getItem("fraudlensToken") || ""}`
    }
  });
  if (response.status === 401) {
    localStorage.removeItem("fraudlensToken");
    if (typeof window.fraudLensSessionExpired === "function") {
      window.fraudLensSessionExpired();
    } else {
      window.location.replace("/login.html");
    }
    throw new Error("Your session expired. Please sign in again.");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

function portalEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function portalInit() {
  document.querySelector("#logout-button").addEventListener("click", () => {
    localStorage.removeItem("fraudlensToken");
    window.location.replace("/login.html");
  });
  portalFetch("/api/auth/me")
    .then(({ user }) => {
      document.querySelector("#user-name").textContent = user.name;
      document.querySelector("#user-role").textContent = user.role;
      document.body.dataset.role = user.role;
      window.fraudLensUser = user;
      document.dispatchEvent(new CustomEvent("fraudlens:ready", { detail: user }));
    })
    .catch((error) => {
      if (localStorage.getItem("fraudlensToken")) {
        const errorBox = document.querySelector("#page-error");
        if (errorBox) {
          errorBox.textContent = error.message;
          errorBox.hidden = false;
        }
      }
    });
}

window.portalFetch = portalFetch;
window.portalEscape = portalEscape;
portalInit();
