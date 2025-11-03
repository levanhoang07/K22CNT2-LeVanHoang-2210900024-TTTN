document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://127.0.0.1:5000";
  const socket = io(API_BASE);
  const FALLBACK_IMG = `${API_BASE}/static/images/no-image.jpg`;

  // ===== Socket notification =====
  socket.on("staff_call", data => alert(`⚠️ Bàn ${data.table} vừa gọi nhân viên!`));

  // ===== Spinner & notification =====
  const spinner = document.getElementById("loading-spinner");
  const showSpinner = () => spinner && (spinner.style.display = "flex");
  const hideSpinner = () => spinner && (spinner.style.display = "none");

  const showNotification = (msg, type="info") => {
    const n = document.createElement("div");
    n.className = `notification notification-${type}`;
    n.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':type==='warning'?'exclamation-triangle':'info-circle'}"></i> <span>${msg}</span>`;
    document.body.appendChild(n);
    setTimeout(()=> n.classList.add("show"), 10);
    setTimeout(()=> { n.classList.remove("show"); setTimeout(()=> n.remove(),300); }, 3000);
  };

  const escapeHtml = text => { const div=document.createElement('div'); div.textContent=text; return div.innerHTML.replace(/'/g,"\\'"); };
  const getImageSrc = path => !path ? FALLBACK_IMG : path.startsWith("http") ? path : `${API_BASE}/static/${path.replace(/^\/+/, "")}`;
  const fixImgError = imgEl => { if(imgEl){ imgEl.onerror=null; imgEl.src=FALLBACK_IMG; } };

  // ===== Tabs =====
  const tabs = document.querySelectorAll("nav button");
  const sections = document.querySelectorAll("main .tab");
  let currentTab = "menu-section";

  const switchTab = targetId => {
    currentTab = targetId;
    tabs.forEach(b => b.classList.toggle("active", b.dataset.target===targetId));
    sections.forEach(sec => sec.classList.toggle("active", sec.id===targetId));
    if(targetId==="menu-section") loadMenu();
    else if(targetId==="table-section") loadTables();
    else if(targetId==="report-section") loadReport(document.getElementById("report-period")?.value||"day");
  };
  tabs.forEach(btn=>btn.addEventListener("click",()=>switchTab(btn.dataset.target)));

  // ===== MENU =====
  const menuTableBody = document.querySelector("#menu-table tbody");
  const statMenu = document.getElementById("stat-menu");
  let editingMenuId = null;

  async function loadMenu(){
    if(currentTab!=="menu-section") return;
    showSpinner();
    try{
      const res = await fetch(`${API_BASE}/api/admin/menu`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      menuTableBody.innerHTML = data.length ? "" : '<tr><td colspan="5" style="text-align:center;color:#64748b;">Chưa có món ăn</td></tr>';
      data.forEach(item=>{
        const imgSrc = getImageSrc(item.HinhAnh);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            <div class="food-name">
              <img src="${imgSrc}" class="food-thumb" onerror="this.onerror=null; this.src='${FALLBACK_IMG}'">
              <span>${item.TenMon}</span>
            </div>
          </td>
          <td><strong>${item.Gia.toLocaleString()} ₫</strong></td>
          <td><span class="badge badge-category">${item.DanhMuc||""}</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn-edit" onclick="openMenuModal(${item.IDMon},'${escapeHtml(item.TenMon)}',${item.Gia},'${escapeHtml(item.DanhMuc)}','${item.HinhAnh||''}')"><i class="fas fa-edit"></i> Sửa</button>
              <button class="btn-delete" onclick="deleteMenu(${item.IDMon})"><i class="fas fa-trash"></i> Xóa</button>
            </div>
          </td>
        `;
        menuTableBody.appendChild(tr);
      });
      statMenu && (statMenu.textContent=data.length);
    }catch(e){
      menuTableBody.innerHTML='<tr><td colspan="5" style="text-align:center;color:#ef4444;">Lỗi tải dữ liệu</td></tr>';
      showNotification("Lỗi tải menu: "+e.message,"error");
    }finally{ hideSpinner(); }
  }

  window.deleteMenu = async id=>{
    if(!confirm("Bạn có chắc muốn xóa món?")) return;
    showSpinner();
    try{
      const res = await fetch(`${API_BASE}/api/admin/menu/${id}`, {method:"DELETE"});
      if(!res.ok) throw new Error("Không thể xóa món");
      showNotification("Xóa món thành công!","success");
      await loadMenu();
    }catch{ showNotification("Lỗi xóa món","error"); }
    finally{ hideSpinner(); }
  };

  window.openMenuModal = (id=null, ten="", gia=0, dm="", ha="")=>{
    editingMenuId = id;
    document.getElementById("menu-ten").value=ten;
    document.getElementById("menu-gia").value=gia;
    document.getElementById("menu-danhmuc").value=dm;
    document.getElementById("menu-hinhanh").value=ha;
    document.getElementById("menu-modal-title").textContent=id?"Sửa món":"Thêm món mới";
    document.getElementById("menu-modal").classList.add("show");
  };

  const closeMenuModal = ()=>{document.getElementById("menu-modal").classList.remove("show"); editingMenuId=null;};
  document.getElementById("menu-save-btn")?.addEventListener("click",async()=>{
    const ten=document.getElementById("menu-ten").value.trim();
    const gia=parseFloat(document.getElementById("menu-gia").value);
    const dm=document.getElementById("menu-danhmuc").value.trim();
    const ha=document.getElementById("menu-hinhanh").value.trim();
    if(!ten) return showNotification("Nhập tên món","warning");
    if(!gia||gia<=0) return showNotification("Giá > 0","warning");
    if(!dm) return showNotification("Chọn danh mục","warning");
    showSpinner();
    try{
      const data={TenMon:ten,Gia:gia,DanhMuc:dm,HinhAnh:ha};
      const res=editingMenuId
        ? await fetch(`${API_BASE}/api/admin/menu/${editingMenuId}`,{method:"PUT",headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
        : await fetch(`${API_BASE}/api/admin/menu`,{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      if(!res.ok) throw new Error("Không thể lưu món");
      showNotification(editingMenuId?"Cập nhật thành công!":"Thêm thành công!","success");
      closeMenuModal();
      await loadMenu();
    }catch{ showNotification("Lỗi lưu món","error"); }finally{ hideSpinner(); }
  });
  document.getElementById("add-food")?.addEventListener("click",()=>openMenuModal());

  // ===== TABLE =====
  const tableBody=document.querySelector("#table-list tbody");
  const statTable=document.getElementById("stat-table");
  const qrResult=document.getElementById("qr-result");
  const qrLink=document.getElementById("qr-link");
  let editingTableId=null;

  async function loadTables(){
    if(currentTab!=="table-section") return;
    showSpinner();
    try{
      const res=await fetch(`${API_BASE}/api/admin/table`);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      tableBody.innerHTML=data.length?"":'<tr><td colspan="4" style="text-align:center;color:#64748b;">Chưa có bàn nào</td></tr>';
      data.forEach(t=>{
        const tr=document.createElement("tr");
        const qrSrc=t.MaQR?getImageSrc(t.MaQR):null;
        tr.innerHTML=`
          <td><strong>Bàn ${t.IDBan}</strong></td>
          <td>${t.TenBan}</td>
          <td>${qrSrc?`<img src="${qrSrc}" class="qr-thumb" onerror="this.onerror=null; this.style.display=\'none\'">`:'<span style="color:#94a3b8;">Chưa có QR</span>'}</td>
          <td>
            <div class="action-buttons">
              <button class="btn-view" onclick="showQR('${t.MaQR}',${t.IDBan},'${escapeHtml(t.TenBan)}')"><i class="fas fa-qrcode"></i> QR</button>
              <button class="btn-edit" onclick="openTableModal(${t.IDBan},'${escapeHtml(t.TenBan)}')"><i class="fas fa-edit"></i> Sửa</button>
              <button class="btn-delete" onclick="deleteTable(${t.IDBan})"><i class="fas fa-trash"></i> Xóa</button>
            </div>
          </td>
        `;
        tableBody.appendChild(tr);
      });
      statTable&&(statTable.textContent=data.length);
    }catch(e){ showNotification("Lỗi tải bàn: "+e.message,"error"); }finally{ hideSpinner(); }
  }

  window.openTableModal=(id=null,ten="")=>{
    editingTableId=id;
    document.getElementById("table-ten").value=ten;
    document.getElementById("table-base-url").value="";
    document.getElementById("table-modal-title").textContent=id?"Sửa bàn":"Thêm bàn mới";
    document.getElementById("table-modal").classList.add("show");
    
  };
  document.getElementById("add-table")?.addEventListener("click", ()=>openTableModal());


  document.getElementById("table-save-btn")?.addEventListener("click",async()=>{
    const ten=document.getElementById("table-ten").value.trim();
    const base=document.getElementById("table-base-url").value.trim()||API_BASE;
    if(!ten) return showNotification("Nhập tên bàn","warning");
    showSpinner();
    try{
      const data={TenBan:ten,base_url:base};
      const res=editingTableId
        ? await fetch(`${API_BASE}/api/admin/table/${editingTableId}`,{method:"PUT",headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
        : await fetch(`${API_BASE}/api/admin/table`,{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      if(!res.ok) throw new Error("Không thể lưu bàn");
      showNotification(editingTableId?"Cập nhật thành công!":"Thêm thành công!","success");
      document.getElementById("table-modal").classList.remove("show");
      document.getElementById("table-ten").value="";
      document.getElementById("table-base-url").value="";
      await loadTables();
    }catch(e){ showNotification("Lỗi lưu bàn: "+e.message,"error");}finally{ hideSpinner(); }
  });

  window.deleteTable=async id=>{
    if(!confirm(`Xóa bàn ${id}?`)) return;
    showSpinner();
    try{
      const res=await fetch(`${API_BASE}/api/admin/table/${id}`,{method:"DELETE"});
      if(!res.ok) throw new Error("Không thể xóa bàn");
      showNotification("Xóa bàn thành công!","success");
      await loadTables();
    }catch(e){ showNotification("Lỗi xóa bàn: "+e.message,"error"); }finally{ hideSpinner(); }
  };

  // ===== QR modal =====
  window.showQR = (path, id, tenBan) => {
    qrResult.innerHTML = "";
    qrLink.innerHTML = "";

    const baseUrl = `${window.location.protocol}//${window.location.host}/frontend`;
    const qrText = `${baseUrl}/index.html?ban=${id}`;

    const qrContainer = document.createElement("div");
    new QRCode(qrContainer, {text:qrText, width:256, height:256, colorDark:"#000000", colorLight:"#ffffff"});
    qrResult.appendChild(qrContainer);

    qrLink.innerHTML = `<strong>${tenBan||`Bàn ${id}`}</strong><br>Link: <a href="${qrText}" target="_blank">${qrText}</a>`;

    document.getElementById("qr-modal").classList.add("show");
  };

  // ===== COMMON modal close =====
  document.querySelectorAll(".modal-close, .btn-cancel").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const modal = btn.closest(".modal");
      if(modal) modal.classList.remove("show");
    });
  });
  // Click ngoài modal để đóng
  document.querySelectorAll(".modal").forEach(modal=>{
    modal.addEventListener("click", e=>{
      if(e.target===modal) modal.classList.remove("show");
    });
  });

 let chartPaidUnpaid = null;
let chartCategory = null;

async function loadReportCharts() {
    const period = document.getElementById("report-period")?.value || "day";

    // Chart 1: Paid / Unpaid
    try {
        const res1 = await fetch(`${API_BASE}/api/report/total-paid-unpaid?period=${period}`);
        if(!res1.ok) throw new Error(`HTTP ${res1.status}`);
        const data1 = await res1.json();

        const paid = parseFloat(data1.Paid || 0);
        const unpaid = parseFloat(data1.Unpaid || 0);

        const ctx1 = document.getElementById("chart-paid-unpaid").getContext("2d");
        if(chartPaidUnpaid) chartPaidUnpaid.destroy();

        chartPaidUnpaid = new Chart(ctx1, {
            type: "doughnut",
            data: {
                labels: ["Đã thanh toán", "Chưa thanh toán"],
                datasets: [{
                    data: [paid, unpaid],
                    backgroundColor: ["#34d399","#f87171"]
                }]
            },
            options: { responsive: true }
        });
    } catch(e){
        console.error("Lỗi chart Paid/Unpaid:", e);
    }

    // Chart 2: Doanh thu theo danh mục
    try {
        const res2 = await fetch(`${API_BASE}/api/report/revenue-by-category?period=${period}`);
        if(!res2.ok) throw new Error(`HTTP ${res2.status}`);
        const data2 = await res2.json();

        // đảm bảo data2 là array
        if(!Array.isArray(data2)) {
            console.warn("Dữ liệu doanh thu không hợp lệ, đặt mặc định rỗng");
            data2 = [];
        }

        const labels = data2.map(d => d.DanhMuc || "Khác");
        const values = data2.map(d => parseFloat(d.DoanhThu || 0));

        const ctx2 = document.getElementById("chart-category").getContext("2d");
        if(chartCategory) chartCategory.destroy();

        chartCategory = new Chart(ctx2, {
            type: "doughnut",
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ["#f87171","#fbbf24","#34d399","#60a5fa","#a78bfa","#f472b6"]
                }]
            },
            options: { responsive: true }
        });
    } catch(e){
        console.error("Lỗi chart Doanh thu danh mục:", e);
    }
}

// Khi thay đổi khoảng thời gian
document.getElementById("report-period")?.addEventListener("change", loadReportCharts);

// Load chart ngay khi mở tab
loadReportCharts();

  // ==== init ====
  switchTab("menu-section");
  setInterval(()=>{
    if(currentTab==="menu-section") loadMenu();
    else if(currentTab==="table-section") loadTables();
    else loadReport(document.getElementById("report-period")?.value||"day");
  },30000);

  console.log("✅ Admin.js chạy ổn, tất cả modal, nút X, hủy, QR đều hoạt động");
});
