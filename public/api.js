window.fraudLensApiUrl = (path) => {
  const baseUrl = (window.FRAUDLENS_CONFIG?.apiUrl || "").replace(/\/+$/, "");
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};

window.fraudLensNetworkError = (error) =>
  error instanceof TypeError
    ? new Error("Server unreachable. Check your connection and try again.")
    : error;

window.fraudLensSessionExpired = () => {
  if (sessionStorage.getItem("fraudlensSessionNotice")) return;
  const message = "Your session expired. Please sign in again.";
  sessionStorage.setItem("fraudlensSessionNotice", message);
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => window.location.replace("/login.html"), 700);
};

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
  const requestUrl = typeof input === "string" ? window.fraudLensApiUrl(input) : input;
  try {
    const response = await originalFetch(requestUrl, options);
    const hasBearerToken = options?.headers &&
      Object.entries(options.headers).some(([name]) => name.toLowerCase() === "authorization");
    if (response.status === 401 && (hasBearerToken || String(requestUrl).includes("/api/auth/me"))) {
      localStorage.removeItem("fraudlensToken");
      window.fraudLensSessionExpired();
    }
    return response;
  } catch (error) {
    throw window.fraudLensNetworkError(error);
  }
};

window.addEventListener("error", (event) => {
  const errorBox = document.querySelector("#page-error, #dashboard-error, #login-error");
  if (errorBox) {
    errorBox.textContent = event.message || "An unexpected error occurred. Please refresh the page.";
    errorBox.hidden = false;
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const message = event.reason?.message || "An unexpected error occurred. Please refresh the page.";
  const errorBox = document.querySelector("#page-error, #dashboard-error, #login-error");
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
});
