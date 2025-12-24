document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const ten_dang_nhap = document.getElementById("username").value.trim();
    const mat_khau = document.getElementById("password").value.trim();

    if (!ten_dang_nhap || !mat_khau) {
        alert("Vui lòng nhập đầy đủ tài khoản và mật khẩu!");
        return;
    }

    try {
        const res = await fetch("http://127.0.0.1:5000/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ten_dang_nhap,
                mat_khau
            })
        });

        const data = await res.json();

        // ❌ Login thất bại
        if (!data.success) {
            alert(data.message || "Sai tài khoản hoặc mật khẩu!");
            return;
        }

        // ✅ Backend trả data.user + data.token
        const token = data.data.token;
        const role = data.data.user.vai_tro;

        // Lưu localStorage
        localStorage.setItem("token", token);
        localStorage.setItem("role", role);

        alert("Đăng nhập thành công!");

        // ✅ CHUYỂN TRANG THEO ROLE (ĐÚNG CHUỖI DB)
        switch (role) {
            case "Admin":
                window.location.href = "/admin";
                break;

            case "Bep":
                window.location.href = "/bep";
                break;

            case "ThuNgan":
                window.location.href = "/thungan";
                break;

            default:
                alert("Vai trò không hợp lệ!");
        }

    } catch (err) {
        console.error("Lỗi:", err);
        alert("Không thể kết nối server!");
    }
});
