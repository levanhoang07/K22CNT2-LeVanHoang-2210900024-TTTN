document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://127.0.0.1:5000";
  const socket = io(API_BASE);

  socket.on("staff_call", data => {
    alert(`⚠️ Bàn ${data.table} vừa gọi nhân viên!`);
  });

  // ===== Spinner =====
  const spinner = document.getElementById("loading-spinner");
  const showSpinner = () => spinner && (spinner.style.display = "flex");
  const hideSpinner = () => spinner && (spinner.style.display = "none");

  // ===== Notification =====
  const showNotification = (msg, type = "info") => {
    const n = document.createElement("div");
    n.className = `notification notification-${type}`;
    n.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':type==='warning'?'exclamation-triangle':'info-circle'}"></i> <span>${msg}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add("show"), 10);
    setTimeout(() => { n.classList.remove("show"); setTimeout(() => n.remove(), 300); }, 3000);
  };

  // ===== Escape HTML =====
  const escapeHtml = text => { const div=document.createElement('div'); div.textContent=text; return div.innerHTML.replace(/'/g, "\\'"); }

  // ===== Tab Navigation =====
  const tabs = document.querySelectorAll("nav button");
  const sections = document.querySelectorAll("main .tab");

  const getActiveTab = () => document.querySelector("nav button.active")?.dataset.target || "menu-section";

  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      sections.forEach(sec => sec.classList.remove("active"));
      const target = document.getElementById(btn.dataset.target);
      if(target) target.classList.add("active");

      // load dữ liệu riêng theo tab
      if(target.id === "menu-section") loadMenu();
      else if(target.id === "table-section") loadTables();
      else if(target.id === "report-section") loadReport(document.getElementById("report-period")?.value || "day");
    });
  });

  // ===== QUẢN LÝ MENU =====
  const menuTableBody = document.querySelector("#menu-table tbody");
  const statMenu = document.getElementById("stat-menu");
  let editingMenuId = null;

  async function loadMenu() {
    if(getActiveTab() !== "menu-section") return; // chỉ load khi tab active
    showSpinner();
    try {
      const res = await fetch(`${API_BASE}/api/admin/menu`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      menuTableBody.innerHTML = data.length ? "" : '<tr><td colspan="5" style="text-align:center; color:#64748b;">Chưa có món ăn nào</td></tr>';
      data.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><div class="food-name">${item.HinhAnh?`<img src="${API_BASE}/static/images/${item.HinhAnh}" class="food-thumb">`:''}<span>${item.TenMon}</span></div></td>
          <td><strong>${item.Gia.toLocaleString()} ₫</strong></td>
          <td><span class="badge badge-category">${item.DanhMuc}</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn-edit" onclick="openMenuModal(${item.IDMon}, '${escapeHtml(item.TenMon)}', ${item.Gia}, '${escapeHtml(item.DanhMuc)}', '${item.HinhAnh || ''}')"><i class="fas fa-edit"></i> Sửa</button>
              <button class="btn-delete" onclick="deleteMenu(${item.IDMon})"><i class="fas fa-trash"></i> Xóa</button>
            </div>
          </td>
        `;
        menuTableBody.appendChild(tr);
      });
      if(statMenu) statMenu.textContent = data.length;
    } catch(e) {
      menuTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">Lỗi tải dữ liệu</td></tr>';
      showNotification("Lỗi tải menu: "+e.message, "error");
    } finally { hideSpinner(); }
  }

  window.deleteMenu = async id => {
    if(!confirm("Bạn có chắc muốn xóa món này?")) return;
    showSpinner();
    try {
      const res = await fetch(`${API_BASE}/api/admin/menu/${id}`, { method: "DELETE" });
      if(!res.ok) throw new Error("Không thể xóa món");
      showNotification("Xóa món thành công!", "success");
      await loadMenu();
    } catch(e){ showNotification("Lỗi xóa món", "error"); }
    finally{ hideSpinner(); }
  }

  window.openMenuModal = (id=null, ten="", gia=0, dm="", ha="") => {
    editingMenuId = id;
    document.getElementById("menu-ten").value = ten;
    document.getElementById("menu-gia").value = gia;
    document.getElementById("menu-danhmuc").value = dm;
    document.getElementById("menu-hinhanh").value = ha;
    document.getElementById("menu-modal-title").textContent = id?"Sửa món ăn":"Thêm món mới";
    document.getElementById("menu-modal").classList.add("show");
  }

  function closeMenuModal(){ document.getElementById("menu-modal").classList.remove("show"); editingMenuId=null; }

  document.getElementById("menu-save-btn")?.addEventListener("click", async () => {
    const tenMon=document.getElementById("menu-ten").value.trim();
    const gia=parseFloat(document.getElementById("menu-gia").value);
    const danhMuc=document.getElementById("menu-danhmuc").value.trim();
    const hinhAnh=document.getElementById("menu-hinhanh").value.trim();
    if(!tenMon) return showNotification("Vui lòng nhập tên món","warning");
    if(!gia || gia<=0) return showNotification("Giá phải lớn hơn 0","warning");
    if(!danhMuc) return showNotification("Vui lòng chọn danh mục","warning");
    const data={TenMon:tenMon,Gia:gia,DanhMuc:danhMuc,HinhAnh:hinhAnh};
    showSpinner();
    try {
      let res;
      if(editingMenuId){
        res = await fetch(`${API_BASE}/api/admin/menu/${editingMenuId}`, {method:"PUT", headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
      } else {
        res = await fetch(`${API_BASE}/api/admin/menu`, {method:"POST", headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
      }
      if(!res.ok) throw new Error("Không thể lưu món");
      showNotification(editingMenuId?"Cập nhật thành công!":"Thêm thành công!","success");
      closeMenuModal();
      await loadMenu();
    } catch(e){ showNotification("Lỗi khi lưu món","error"); }
    finally{ hideSpinner(); }
  });

  document.getElementById("add-food")?.addEventListener("click", ()=>openMenuModal());
  document.querySelectorAll(".modal-close, .btn-cancel").forEach(btn=>btn.addEventListener("click",()=>btn.closest(".modal").classList.remove("show")));
  document.querySelectorAll(".modal").forEach(modal=>modal.addEventListener("click",e=>{if(e.target===modal) modal.classList.remove("show");}));

  // ===== QUẢN LÝ BÀN =====
  const tableBody = document.querySelector("#table-list tbody");
  const statTable = document.getElementById("stat-table");
  const qrResult = document.getElementById("qr-result");
  const qrLink = document.getElementById("qr-link");

  async function loadTables() {
    if(getActiveTab() !== "table-section") return;
    showSpinner();
    try {
      const res = await fetch(`${API_BASE}/api/admin/table`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      tableBody.innerHTML = data.length ? "" : '<tr><td colspan="4" style="text-align:center; color:#64748b;">Chưa có bàn nào</td></tr>';
      data.forEach(table=>{
        const tr=document.createElement("tr");
        tr.innerHTML = `
          <td><strong>Bàn ${table.IDBan}</strong></td>
          <td>${table.TenBan}</td>
          <td>${table.QRPath?`<img src="${API_BASE}/static/images/${table.QRPath}" class="qr-thumb">`:'<span style="color:#94a3b8;">Chưam có QR</span>'}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-view" onclick="showQR('${table.QRPath}',${table.IDBan},'${escapeHtml(table.TenBan)}')"><i class="fas fa-qrcode"></i> QR</button>
              <button class="btn-delete" onclick="deleteTable(${table.IDBan})"><i class="fas fa-trash"></i> Xóa</button>
            </div>
          </td>
        `;
        tableBody.appendChild(tr);
      });
      if(statTable) statTable.textContent = data.length;
    } catch(e){ showNotification("Lỗi tải bàn","error"); }
    finally{ hideSpinner(); }
  }

  window.deleteTable = async id => {
    if(!confirm(`Bạn có chắc muốn xóa bàn ${id}?`)) return;
    showSpinner();
    try{
      const res = await fetch(`${API_BASE}/api/admin/table/${id}`,{method:"DELETE"});
      if(!res.ok) throw new Error("Không thể xóa bàn");
      showNotification("Xóa bàn thành công!","success");
      await loadTables();
    }catch(e){ showNotification("Lỗi xóa bàn","error"); }
    finally{ hideSpinner(); }
  }

window.showQR = (path, id, tenBan) => {
  qrResult.innerHTML = "";

  if(path && typeof QRCode !== 'undefined'){
    new QRCode(qrResult, {
      text: `index.html?ban=${id}`,
      width: 256,
      height: 256
    });
  } else if(path) {
    const img = document.createElement("img");
    img.src = `static/images/${path}`;
    img.alt = `QR ${tenBan}`;
    img.style.maxWidth = '256px';
    qrResult.appendChild(img);
  } else {
    qrResult.innerHTML = '<p style="color:#94a3b8;">Chưa có QR</p>';
  }

  qrLink.innerHTML = `<strong>${tenBan || `Bàn ${id}`}</strong><br>Link: <a href="index.html?ban=${id}" target="_blank">index.html?ban=${id}</a>`;

  document.getElementById("qr-modal").classList.add("show");
}


  document.getElementById("add-table")?.addEventListener("click",()=>document.getElementById("table-modal").classList.add("show"));
  document.getElementById("table-save-btn")?.addEventListener("click", async ()=>{
    const tenBan=document.getElementById("table-ten").value.trim();
    const baseUrl=document.getElementById("table-base-url").value.trim()||API_BASE;
    if(!tenBan) return showNotification("Vui lòng nhập tên bàn","warning");
    const data={TenBan:tenBan,base_url:baseUrl};
    showSpinner();
    try{
      const res=await fetch(`${API_BASE}/api/admin/table`,{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      if(!res.ok) throw new Error("Không thể tạo bàn");
      const newTable=await res.json();
      showNotification("Thêm bàn thành công!","success");
      document.getElementById("table-modal").classList.remove("show");
      document.getElementById("table-ten").value="";
      document.getElementById("table-base-url").value="";
      await loadTables();
      if(newTable.QRPath) showQR(newTable.QRPath,newTable.IDBan,newTable.TenBan);
    }catch(e){ showNotification("Lỗi tạo bàn","error"); }
    finally{ hideSpinner(); }
  });

  document.getElementById("qr-modal-close")?.addEventListener("click",()=>document.getElementById("qr-modal").classList.remove("show"));

  // ===== BÁO CÁO =====
  async function loadReport(period="day"){
    if(getActiveTab() !== "report-section") return;
    showSpinner();
    try{
      const res=await fetch(`${API_BASE}/api/report?period=${period}`);
      if(!res.ok) throw new Error("Không thể tải báo cáo");
      const data=await res.json();
      document.getElementById("stat-orders").textContent=data.totalOrders||0;
      document.getElementById("stat-revenue").textContent=(data.totalRevenue||0).toLocaleString()+" ₫";
    }catch(e){ showNotification("Lỗi khi tải báo cáo","error"); }
    finally{ hideSpinner(); }
  }

  document.getElementById("report-period")?.addEventListener("change", e=>loadReport(e.target.value));

  // ===== KHỞI TẠO =====
  loadMenu();
  loadTables();
  loadReport();
  setInterval(()=>{
    const target=getActiveTab();
    if(target==="menu-section") loadMenu();
    else if(target==="table-section") loadTables();
    else if(target==="report-section") loadReport(document.getElementById("report-period")?.value || "day");
  },30000);

  console.log("✅ Admin đang chạy ngon em nhé, ngon lành!");
});
