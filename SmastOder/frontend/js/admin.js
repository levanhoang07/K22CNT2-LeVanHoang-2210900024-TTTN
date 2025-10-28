document.addEventListener("DOMContentLoaded",()=>{

  // ==== Spinner ====
  function showSpinner(){ document.getElementById("loading-spinner")?.style.display="flex"; }
  function hideSpinner(){ document.getElementById("loading-spinner")?.style.display="none"; }

  // ==== Tab chuyển đổi ====
  const tabs = document.querySelectorAll("nav button");
  const sections = document.querySelectorAll("main .tab");
  tabs.forEach(btn=>{
    btn.addEventListener("click",()=>{
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      sections.forEach(sec=>sec.classList.remove("active"));
      document.getElementById(btn.dataset.target)?.classList.add("active");
    });
  });

  // ==== MENU CRUD ====
  const menuTableBody = document.querySelector("#menu-table tbody");
  const statMenu = document.getElementById("stat-menu");
  let editingMenuId = null;

  async function loadMenu(){
    showSpinner();
    try{
      const res = await fetch("/api/admin/menu");
      const data = await res.json();
      menuTableBody.innerHTML = "";
      data.forEach(item=>{
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.TenMon}</td>
          <td>${item.Gia.toLocaleString()} ₫</td>
          <td>${item.DanhMuc}</td>
          <td>${item.HinhAnh?`<img src="/static/images/${item.HinhAnh}" width="50">`:''}</td>
          <td>
            <button onclick="openMenuModal(${item.IDMon}, '${item.TenMon.replaceAll("'", "\\'")}', ${item.Gia}, '${item.DanhMuc.replaceAll("'", "\\'")}', '${item.HinhAnh||''}')">Sửa</button>
            <button onclick="deleteMenu(${item.IDMon})">Xóa</button>
          </td>
        `;
        menuTableBody.appendChild(tr);
      });
      statMenu.textContent = data.length;
    }catch(e){
      console.error(e);
      alert("Lỗi khi load menu");
    }finally{
      hideSpinner();
    }
  }

  window.deleteMenu = async function(id){
    if(!confirm("Bạn có chắc muốn xóa món này?")) return;
    showSpinner();
    try{
      await fetch(`/api/admin/menu/${id}`,{method:"DELETE"});
      await loadMenu();
    }catch(e){ console.error(e); alert("Lỗi khi xóa món"); }
    finally{ hideSpinner(); }
  }

  window.openMenuModal = function(id=null, ten="", gia=0, dm="", ha=""){
    editingMenuId=id;
    document.getElementById("menu-ten").value=ten;
    document.getElementById("menu-gia").value=gia;
    document.getElementById("menu-danhmuc").value=dm;
    document.getElementById("menu-hinhanh").value=ha;
    document.getElementById("menu-modal-title").textContent=id?"Sửa món":"Thêm món";
    document.getElementById("menu-modal").style.display="block";
  }

  function closeMenuModal(){ document.getElementById("menu-modal").style.display="none"; }

  document.getElementById("menu-save-btn").addEventListener("click",async()=>{
    const data={
      TenMon:document.getElementById("menu-ten").value,
      Gia:parseFloat(document.getElementById("menu-gia").value),
      DanhMuc:document.getElementById("menu-danhmuc").value,
      HinhAnh:document.getElementById("menu-hinhanh").value
    };
    showSpinner();
    try{
      if(editingMenuId){
        await fetch(`/api/admin/menu/${editingMenuId}`,{
          method:"PUT",
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(data)
        });
      }else{
        await fetch("/api/admin/menu",{
          method:"POST",
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(data)
        });
      }
      closeMenuModal();
      await loadMenu();
    }catch(e){ console.error(e); alert("Lỗi khi lưu món"); }
    finally{ hideSpinner(); }
  });

  document.getElementById("add-food").addEventListener("click",()=>openMenuModal());

  // ==== TABLE CRUD + QR ====
  const tableBody=document.querySelector("#table-list tbody");
  const statTable=document.getElementById("stat-table");
  const qrResult=document.getElementById("qr-result");
  const qrLink=document.getElementById("qr-link");

  async function loadTables(){
    showSpinner();
    try{
      const res=await fetch("/api/admin/table");
      const data=await res.json();
      tableBody.innerHTML="";
      data.forEach(table=>{
        const tr=document.createElement("tr");
        tr.innerHTML=`
          <td>${table.IDBan}</td>
          <td>${table.TenBan}</td>
          <td>${table.QRPath?`<img src="/static/images/${table.QRPath}" width="80">`:''}</td>
          <td>
            <button onclick="deleteTable(${table.IDBan})">Xóa</button>
            <button onclick="showQR('${table.QRPath}', ${table.IDBan})">Xem QR</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
      statTable.textContent=data.length;
    }catch(e){ console.error(e); alert("Lỗi khi load bàn"); }
    finally{ hideSpinner(); }
  }

  window.deleteTable = async function(id){
    if(!confirm("Xóa bàn này?")) return;
    showSpinner();
    try{
      await fetch(`/api/admin/table/${id}`,{method:"DELETE"});
      await loadTables();
    }catch(e){ console.error(e); alert("Lỗi khi xóa bàn"); }
    finally{ hideSpinner(); }
  }

  window.showQR=function(path,id){
    qrResult.innerHTML="";
    if(path) new QRCode(qrResult, `/static/images/${path}`);
    qrLink.textContent=`Bàn ${id} - Link: ${window.location.origin}/khach?table=${id}`;
  }

  document.getElementById("add-table").addEventListener("click",()=>document.getElementById("table-modal").style.display="block");
  document.getElementById("table-save-btn").addEventListener("click",async()=>{
    const data={
      TenBan:document.getElementById("table-ten").value,
      base_url:document.getElementById("table-base-url").value
    };
    showSpinner();
    try{
      await fetch("/api/admin/table",{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      document.getElementById("table-modal").style.display="none";
      await loadTables();
    }catch(e){ console.error(e); alert("Lỗi khi tạo bàn"); }
    finally{ hideSpinner(); }
  });
  function closeTableModal(){ document.getElementById("table-modal").style.display="none"; }

  // ==== REPORT ====
  async function loadReport(period="day"){
    showSpinner();
    try{
      const res=await fetch(`/api/report?period=${period}`);
      const data=await res.json();
      document.getElementById("stat-orders").textContent=data.totalOrders||0;
      document.getElementById("stat-revenue").textContent=(data.totalRevenue||0).toLocaleString()+" ₫";
    }catch(e){ console.error(e); alert("Lỗi khi load báo cáo"); }
    finally{ hideSpinner(); }
  }

  document.getElementById("report-period").addEventListener("change",(e)=>loadReport(e.target.value));

  // ==== LOAD DATA BAN ĐẦU ====
  loadMenu();
  loadTables();
  loadReport();

});
