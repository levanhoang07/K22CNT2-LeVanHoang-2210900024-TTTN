document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value;

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role })
    });

    const data = await res.json();

    if (res.ok && data.status === "ok") {
      // Redirect theo role trả về từ backend
      let redirectUrl = "/";
      if (role === "Admin") redirectUrl = "/admin";
      else if (role === "Bep") redirectUrl = "/bep";
      else if (role === "ThuNgan") redirectUrl = "/thungan";
      window.location.href = redirectUrl;
    } else {
      document.getElementById("login-error").textContent = data.message || "Đăng nhập thất bại";
    }
  } catch (err) {
    document.getElementById("login-error").textContent = "Lỗi kết nối server";
  }
});
