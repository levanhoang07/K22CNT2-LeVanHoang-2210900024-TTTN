document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        alert("Vui lòng nhập đầy đủ tài khoản và mật khẩu!");
        return;
    }

    try {
        const res = await fetch("http://127.0.0.1:5000/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
            alert("Lỗi kết nối đến server!");
            return;
        }

        const data = await res.json();

        // Nếu login thất bại
        if (!data.success) {
            alert(data.message || "Sai tài khoản hoặc mật khẩu!");
            return;
        }

        // ✅ Lưu token + role vào localStorage
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);

        alert("Đăng nhập thành công!");

        // ✅ CHUYỂN TRANG THEO ROLE
        switch (data.role) {
            case "admin":
                window.location.href = "admin.html";
                break;
            case "bep":
                window.location.href = "bep.html";
                break;
            case "thungan":
                window.location.href = "thungan.html";
                break;
            default:
                alert("Role không hợp lệ!");
        }

    } catch (err) {
        console.error("Lỗi:", err);
        alert("Không thể kết nối server!");
    }
});
