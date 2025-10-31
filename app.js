// --- INICIO DE LA MODIFICACIÓN ---
// Esperar a que TODA la página,
// incluyendo el script incrustado del escáner, esté cargada
// antes de ejecutar cualquier código de la app.
window.onload = function() {

(async function(){
  
  // --- INICIO SETUP DE jspdf ---
  let jsPDF;
  if(window.jspdf) {
    jsPDF = window.jspdf.jsPDF;
  }
  // --- FIN SETUP ---

  await openDB();

  // --- INICIO COMPRESIÓN DE IMAGEN ---
  /**
   * Comprime una imagen antes de guardarla.
   * @param {File} file - El archivo de imagen (de input o cámara).
   * @param {number} quality - Calidad del JPEG (0 a 1).
   * @param {number} maxWidth - Ancho máximo (px).
   * @returns {Promise<string>} - Promesa que resuelve a un Data URL (base64) de la imagen comprimida.
   */
  async function compressImage(file, quality = 0.8, maxWidth = 1280) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          let width = img.width;
          let height = img.height;

          // Redimensionar si es más ancha que maxWidth
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Comprimir a JPEG con la calidad especificada
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  }
  // --- FIN COMPRESIÓN DE IMAGEN ---


  async function hashText(text){
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hex = [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
    return hex;
  }
  
  // --- Modificado para usar la compresión ---
  async function fileToDataURL(file){
    if(!file) return null;
    // Comprimir todas las imágenes que se suban
    return compressImage(file, 0.8, 1280);
  }

  // LOGIN page
  if(document.body.classList.contains('page-login')){
     
    const loggedInUser = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    if(loggedInUser){
      location.href = 'main.html';
      return; 
    }

    const container = document.querySelector('main.container'); 
    const showRegister = document.getElementById('showRegister'); 
    const showLogin = document.getElementById('showLogin');     
    
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (showRegister && showLogin && container) {
      showRegister.onclick = () => { container.classList.add('active'); };
      showLogin.onclick = () => { container.classList.remove('active'); };
    } else {
      console.error('No se encontraron los elementos para la animación de login.');
    }

    const openPrivacyLink = document.getElementById('openPrivacyLink');
    const privacyModal = document.getElementById('privacyModal');
    const closePrivacyBtn = document.getElementById('closePrivacyBtn');

    if (openPrivacyLink && privacyModal && closePrivacyBtn) {
      openPrivacyLink.onclick = (e) => {
        e.preventDefault(); 
        privacyModal.classList.remove('hidden');
      };
      closePrivacyBtn.onclick = () => {
        privacyModal.classList.add('hidden');
      };
      privacyModal.addEventListener('click', (e) => {
        if (e.target === privacyModal) {
          privacyModal.classList.add('hidden');
        }
      });
    }
    
    const regFotoInput = document.getElementById('regFoto');
    const regFotoBtn = document.getElementById('regFotoBtn');
    const regFotoPreview = document.getElementById('regFotoPreview');
    
    regFotoBtn.addEventListener('click', () => {
      regFotoInput.click();
    });
    
    regFotoInput.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if(!f) { regFotoPreview.innerHTML=''; return; }
      // Usar compresión aquí también
      const url = await fileToDataURL(f);
      regFotoPreview.innerHTML = `<img alt="foto perfil" src="${url}">`;
    });

    registerForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      
      const fotoFile = regFotoInput.files[0]; 
      const nombre = document.getElementById('regNombre').value.trim();
      const pass = document.getElementById('regPass').value;
      const pass2 = document.getElementById('regPass2').value;
      const codigo = document.getElementById('regCodigo').value.trim();
      
      if (!fotoFile) {
        alert('Es obligatorio tomar una foto de perfil para el registro.');
        return;
      }
      
      if(pass !== pass2){ alert('Las contraseñas no coinciden'); return; } 
      
      const usuario = nombre.split(' ')[0].toLowerCase();
      const hashed = await hashText(pass);
      const fotoDataURL = await fileToDataURL(fotoFile); // Convertir foto (ya comprime)
      
      const ADMIN_CODE = "ADMIN123"; 
      const userRol = (codigo === ADMIN_CODE) ? 'admin' : 'guardia';

      try{
        const id = await addItem('users', {
          usuario, 
          nombre, 
          password: hashed, 
          rol: userRol, 
          foto: fotoDataURL, 
          created: Date.now()
        });
        
        localStorage.setItem('ctrl_user', JSON.stringify({
          id, 
          usuario, 
          nombre, 
          rol: userRol, 
          fotoGuardia: fotoDataURL 
        }));
        location.href = 'main.html';
      }catch(err){
        alert('Error: probablemente el usuario ya existe.');
        console.error(err);
      }
    });

    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const usuario = document.getElementById('loginUsuario').value.trim();
      const pass = document.getElementById('loginPass').value;
      const hashed = await hashText(pass);
      const users = await getAll('users');
      const user = users.find(u=>u.usuario===usuario || u.nombre===usuario);
      if(!user){ alert('Usuario no encontrado. Regístrate'); return; }
      if(user.password !== hashed){ alert('Contraseña incorrecta'); return; }
      
      const userRol = user.rol || 'guardia'; 
      const fotoGuardia = user.foto || null; 
      
      localStorage.setItem('ctrl_user', JSON.stringify({
        id:user.id, 
        usuario:user.usuario, 
        nombre:user.nombre, 
        rol: userRol, 
        fotoGuardia: fotoGuardia 
      }));
      location.href = 'main.html';
    });

    const existing = await getAll('users');
    if(existing.length===0){
      const demoHash = await hashText('guard123');
      try{ await addItem('users',{usuario:'guardia',nombre:'Guardia Demo',password:demoHash,rol:'guardia', foto: null, created:Date.now()}); }catch(e){}
    }
  }

  // MAIN SPA
  if(document.body.classList.contains('page-main')){
    
    // --- INICIO LÓGICA DE NOTIFICACIÓN POP-UP (TOAST) ---
    const toastEl = document.getElementById('toastNotification');
    const toastIconEl = document.getElementById('toastIcon');
    const toastMsgEl = document.getElementById('toastMessage');
    let toastTimer;

    const icons = {
      success: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m-2 15l-5-5l1.41-1.41L10 14.17l7.59-7.59L19 8z"/></svg>`,
      error: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m1 15h-2v-2h2zm0-4h-2V7h2z"/></svg>`,
      loading: `<svg class="spinner" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8"/></svg>`,
      info: `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2m1 15h-2v-6h2zm0-8h-2V7h2z"/></svg>`
    };

    /**
     * Muestra una notificación pop-up (toast).
     * @param {string} message - El mensaje a mostrar.
     * @param {string} type - 'success', 'error', 'loading', o 'info'.
     * @param {number} [duration=3000] - Duración en ms. 0 para 'loading' o manual.
     */
    function showMessage(message, type = 'info', duration = 3000) {
      if (toastTimer) {
        clearTimeout(toastTimer);
        toastEl.classList.remove('show');
      }
      
      toastMsgEl.textContent = message;
      toastIconEl.innerHTML = icons[type] || icons.info;
      
      // Quitar clases viejas, poner la nueva
      toastEl.className = 'toast-container'; 
      toastEl.classList.add(type);
      
      // Forzar re-render para la animación
      void toastEl.offsetWidth; 

      toastEl.classList.add('show');
      
      if (duration > 0) {
        toastTimer = setTimeout(() => {
          clearMessage();
        }, duration);
      }
    }

    function clearMessage() {
      if (toastTimer) clearTimeout(toastTimer);
      toastEl.classList.remove('show');
      toastEl.classList.add('hiding'); // Inicia animación de salida
      setTimeout(() => {
        toastEl.classList.remove('hiding');
      }, 500); // Duración de la animación de salida
    }
    // --- FIN LÓGICA DE NOTIFICACIÓN ---
    
    
    // --- INICIO LÓGICA DEL ESCÁNER ---
    let html5QrCode = null; // Aquí guardaremos la instancia del escáner
    const scannerBtn = document.getElementById('scannerBtn');
    const scannerModal = document.getElementById('scannerModal');
    const stopScannerBtn = document.getElementById('stopScannerBtn');
    const scannerReader = document.getElementById('scannerReader');
    
    // Esta es la comprobación clave.
    // Ahora solo se ejecuta después de window.onload,
    // por lo que 'Html5Qrcode' DEBERÍA existir.
    if (typeof Html5Qrcode === 'undefined') {
      // Si AÚN falla, es un problema más profundo
      console.error("La librería Html5Qrcode no se cargó.");
      showMessage("Error: La librería del escáner no cargó", "error", 5000);
      if(scannerBtn) scannerBtn.disabled = true;
    } else {
      // ¡Éxito! La librería cargó.
      console.log("Librería Html5Qrcode cargada exitosamente.");
      html5QrCode = new Html5Qrcode("scannerReader");
    }

    const onScanSuccess = (decodedText, decodedResult) => {
      // `decodedText` es el número de la guía
      guiaEl.value = decodedText;
      
      // Detener la cámara y cerrar el modal
      stopScanner();
      showMessage("Código escaneado", "success", 2000);
      
      // Opcional: vibrar para confirmar
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    };

    const onScanFailure = (error) => {
      // Este error se dispara constantemente (buscando código).
      // Solo lo mostramos en la consola para depurar.
      // console.warn(`Error de escaneo = ${error}`);
    };

    function startScanner() {
      if (!html5QrCode) {
        showMessage("Error: El escáner no está inicializado.", "error");
        return;
      }
      scannerModal.classList.remove('hidden');
      
      // Configuración para escanear códigos de barras
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 150 }, // Rectángulo de escaneo
        rememberLastUsedCamera: true,
        formatsToSupport: [
            "QR_CODE", "CODE_128", "EAN_13", "EAN_8", "UPC_A", "UPC_E", "CODE_39", "ITF"
        ]
      };
      
      // Iniciar la cámara trasera (environment)
      html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(err => {
          console.error(`No se pudo iniciar el escáner: ${err}`);
          showMessage(`Error de cámara: ${err}`, 'error', 4000);
          scannerModal.classList.add('hidden');
        });
    }

    function stopScanner() {
      if (!html5QrCode) return;
      try {
        html5QrCode.stop().then(res => {
          scannerModal.classList.add('hidden');
        }).catch(err => {
          console.log("No se pudo detener el escáner (probablemente ya estaba detenido).");
          scannerModal.classList.add('hidden');
        });
      } catch (e) {
        console.error("Error al detener el escáner:", e);
        scannerModal.classList.add('hidden');
      }
    }

    if(scannerBtn) scannerBtn.addEventListener('click', startScanner);
    if(stopScannerBtn) stopScannerBtn.addEventListener('click', stopScanner);
    // --- FIN LÓGICA DEL ESCÁNER ---
    
    

    if (!jsPDF) {
      console.error("jsPDF no se cargó correctamente.");
      const pdfBtn = document.getElementById('downloadPdfBtn');
      if(pdfBtn) pdfBtn.disabled = true;
    }
    
    const user = JSON.parse(localStorage.getItem('ctrl_user') || 'null');
    
    if(!user){ 
      location.href='index.html'; 
      return; 
    }
    
    const userRol = user.rol || 'guardia';
    const userFoto = user.fotoGuardia || null; 

    document.getElementById('saludo').textContent = `Buen turno ${user.nombre}`;
    document.getElementById('logoutBtn').onclick = ()=>{ localStorage.removeItem('ctrl_user'); location.href='index.html'; };

    const navBtnAdmin = document.getElementById('nav-btn-admin');
    if (userRol === 'admin') {
      navBtnAdmin.classList.remove('hidden');
    }

    const mainContainer = document.getElementById('app-main-container'); 
    const navBtns = document.querySelectorAll('.nav-btn');
    
    async function showScreen(id){ 
      mainContainer.classList.remove('show-paqueteria', 'show-directorio', 'show-historial', 'show-admin');
      
      if (id === 'screen-paqueteria') {
        mainContainer.classList.add('show-paqueteria');
      } else if (id === 'screen-directorio') {
        mainContainer.classList.add('show-directorio');
        await refreshDomicilios(); 
      } else if (id === 'screen-historial') {
        mainContainer.classList.add('show-historial');
        await refreshPaquetes(); 
      } else if (id === 'screen-admin') {
        if (userRol !== 'admin') return; 
        mainContainer.classList.add('show-admin');
        await refreshUsuarios(); 
      }
      
      navBtns.forEach(b=>b.classList.remove('active'));
      document.querySelector(`.nav-btn[data-screen="${id}"]`).classList.add('active');
    }
    
    navBtns.forEach(btn=>btn.addEventListener('click', async () => await showScreen(btn.dataset.screen)));

    // elements
    const guiaEl = document.getElementById('guia');
    const guiaSuggestions = document.getElementById('guiaSuggestions');
    const nombreDest = document.getElementById('nombreDest');
    const nombresList = document.getElementById('nombresList');
    const paqueteriaInput = document.getElementById('paqueteriaInput');
    const paqList = document.getElementById('paqList');
    const domicilioInput = document.getElementById('domicilioInput');
    const domList = document.getElementById('domList');
    const fotoInput = document.getElementById('fotoInput');
    const fotoPreview = document.getElementById('fotoPreview');
    const recibirBtn = document.getElementById('recibirBtn');
    const entregarBtn = document.getElementById('entregarBtn');
    
    const comentariosPaquete = document.getElementById('comentariosPaquete'); 
    const notificarSi = document.getElementById('notificarSi'); 

    const fotoBtn = document.getElementById('fotoBtn');
    const idFotoBtn = document.getElementById('idFotoBtn');

    const historialPaquetes = document.getElementById('historialPaquetes'); 
    const tablaDomicilios = document.getElementById('tablaDomicilios');

    const domForm = document.getElementById('domForm');
    const addResident = document.getElementById('addResident');
    const moreResidents = document.getElementById('moreResidents');

    const buscarHist = document.getElementById('buscarHist');
    const filtroEstado = document.getElementById('filtroEstado');
    const fechaDesde = document.getElementById('fechaDesde');
    const fechaHasta = document.getElementById('fechaHasta');
    const fechaDesdeLabel = document.getElementById('fechaDesdeLabel');
    const fechaHastaLabel = document.getElementById('fechaHastaLabel');
    const historialContador = document.getElementById('historialContador'); 

    const firmaModal = document.getElementById('firmaModal');
    const firmaCanvas = document.getElementById('firmaCanvas');
    const limpiarFirma = document.getElementById('limpiarFirma');
    const guardarFirma = document.getElementById('guardarFirma');
    const cerrarFirma = document.getElementById('cerrarFirma');
    const idFotoInput = document.getElementById('idFotoInput');
    const idPreview = document.getElementById('idPreview');
    const notificarEntregaSi = document.getElementById('notificarEntregaSi'); 

    const confirmEntregarModal = document.getElementById('confirmEntregarModal');
    const confirmEntregarMsg = document.getElementById('confirmEntregarMsg');
    const cancelEntregarBtn = document.getElementById('cancelEntregarBtn');
    const confirmEntregarBtn = document.getElementById('confirmEntregarBtn');

    const entregarVariosBtn = document.getElementById('entregarVariosBtn'); 
    const confirmEntregarVariosModal = document.getElementById('confirmEntregarVariosModal');
    const domicilioVariosTxt = document.getElementById('domicilioVariosTxt');
    const listaPaquetesVarios = document.getElementById('listaPaquetesVarios');
    const cancelVariosBtn = document.getElementById('cancelVariosBtn');
    const confirmVariosBtn = document.getElementById('confirmVariosBtn');

    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const deleteConfirmMsg = document.getElementById('deleteConfirmMsg');
    const deleteCancelBtn = document.getElementById('deleteCancelBtn');
    const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const refreshUsersBtn = document.getElementById('refreshUsersBtn');
    const tablaUsuarios = document.getElementById('tablaUsuarios');
    
    // --- INICIO LÓGICA DE RESPALDO ---
    const exportBackupBtn = document.getElementById('exportBackupBtn');
    const restoreBackupBtn = document.getElementById('restoreBackupBtn');
    const restoreBackupInput = document.getElementById('restoreBackupInput');
    
    let itemToDelete = { type: null, id: null }; 

    let currentBatchToDeliver = []; 
    let domicilioDebounceTimer; 

    const imageViewer = document.getElementById('imageViewer');
    const viewerImg = document.getElementById('viewerImg');
    const viewerMeta = document.getElementById('viewerMeta');
    const prevImg = document.getElementById('prevImg');
    const nextImg = document.getElementById('nextImg');
    const closeImageViewer = document.getElementById('closeImageViewer');
    
    // --- INICIO HELPER WEB SHARE API ---
    function dataURLtoFile(dataUrl, filename) {
      if (!dataUrl) return null;
      try {
        const arr = dataUrl.split(',');
        if (arr.length < 2) return null;
        
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch || mimeMatch.length < 2) return null;
        
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        while(n--){
          u8arr[n] = bstr.charCodeAt(n);
        }
        
        return new File([u8arr], filename, {type:mime});
      } catch (e) {
        console.error("Error al convertir Data URL a File:", e);
        return null;
      }
    }
    // --- FIN HELPER WEB SHARE API ---


    // Canvas setup
    const ctx = firmaCanvas.getContext('2d');
    function setupCanvas(){
      const rectMaxWidth = Math.min(window.innerWidth - 80, 520);
      const displayW = rectMaxWidth;
      const displayH = 200;
      const ratio = window.devicePixelRatio || 1;
      firmaCanvas.style.width = displayW + 'px';
      firmaCanvas.style.height = displayH + 'px';
      firmaCanvas.width = Math.floor(displayW * ratio);
      firmaCanvas.height = Math.floor(displayH * ratio);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      clearCanvas();
    }
    
    let hasSigned = false;

    function clearCanvas(){
      ctx.clearRect(0,0,firmaCanvas.width, firmaCanvas.height);
      ctx.save();
      ctx.strokeStyle = '#cfe6ff';
      ctx.setLineDash([6,6]);
      const w = (firmaCanvas.width/(window.devicePixelRatio||1)) -12;
      const h = (firmaCanvas.height/(window.devicePixelRatio||1)) -12;
      ctx.strokeRect(6,6, w, h);
      ctx.restore();
      hasSigned = false; 
    }
    setupCanvas();
    window.addEventListener('resize', ()=>{ setupCanvas(); });

    // drawing
    let drawing=false;
    function getPos(e){
      const r = firmaCanvas.getBoundingClientRect();
      let clientX, clientY;
      if(e.touches && e.touches[0]){ clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else { clientX = e.clientX; clientY = e.clientY; }
      return { x: clientX - r.left, y: clientY - r.top };
    }
    function pointerDown(e){
      e.preventDefault();
      drawing = true;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
    function pointerMove(e){
      if(!drawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = '#05304b';
      ctx.stroke();
      hasSigned = true; 
    }
    function pointerUp(e){
      drawing = false;
    }
    firmaCanvas.addEventListener('touchstart', pointerDown, {passive:false});
    firmaCanvas.addEventListener('touchmove', pointerMove, {passive:false});
    firmaCanvas.addEventListener('touchend', pointerUp);
    firmaCanvas.addEventListener('mousedown', pointerDown);
    window.addEventListener('mousemove', pointerMove);
    window.addEventListener('mouseup', pointerUp);
    limpiarFirma.addEventListener('click', ()=>{ clearCanvas(); });

    fotoBtn.addEventListener('click', () => {
      fotoInput.click();
    });
    idFotoBtn.addEventListener('click', () => {
      idFotoInput.click();
    });

    // preview photos
    fotoInput.addEventListener('change', async (e)=>{
      const f = e.target.files[0];
      if(!f) { fotoPreview.innerHTML=''; return; }
      const url = await fileToDataURL(f); // Usa compresión
      fotoPreview.innerHTML = `<img alt="foto paquete" src="${url}">`;
    });
    idFotoInput.addEventListener('change', async (e)=>{
      const f = e.target.files[0];
      if(!f) { idPreview.innerHTML=''; return; }
      const url = await fileToDataURL(f); // Usa compresión
      idPreview.innerHTML = `<img alt="foto id" src="${url}">`;
    });


    // refresh helpers
    async function rebuildAutocomplete(){
      const paqs = await getAll('paquetes');
      const doms = await getAll('domicilios');
      const nombres = new Set();
      const paqsTxt = new Set();
      
      doms.forEach(d=>{ 
        if(d.residentes) d.residentes.forEach(r=>nombres.add(r)); 
      });

      paqs.forEach(p=>{ 
        if(p.nombre) nombres.add(p.nombre); 
        if(p.paqueteria) paqsTxt.add(p.paqueteria);
      });

      nombresList.innerHTML=''; paqList.innerHTML=''; domList.innerHTML='';
      nombres.forEach(n=>{ const o=document.createElement('option'); o.value=n; nombresList.appendChild(o); });
      paqsTxt.forEach(n=>{ const o=document.createElement('option'); o.value=n; paqList.appendChild(o); });
      doms.forEach(d=>{ const o=document.createElement('option'); o.value=d.calle; domList.appendChild(o); }); 
    }

    async function refreshDomicilios(){
      const doms = await getAll('domicilios');
      tablaDomicilios.innerHTML='';
      doms.forEach(d=>{
        const row = document.createElement('div'); row.className='row';
        row.innerHTML = `<div class="info">
                          <strong>${d.calle}</strong>
                          <div class="muted">${(d.residentes||[]).join(', ')}</div>
                          <div class="telefono"><span class="muted">Tel:</span> ${d.telefono || 'No registrado'}</div>
                         </div>
                         <div><button class="btn ghost" data-id="${d.id}" data-act="edit">Editar</button></div>`;
        tablaDomicilios.appendChild(row);
      });
    }

    async function refreshPaquetes(){
      const paqs = await getAll('paquetes');
      const filter = buscarHist.value.toLowerCase();
      const estadoF = filtroEstado.value;
      
      const desde = fechaDesde.valueAsDate; 
      const hasta = fechaHasta.valueAsDate;

      const rows = paqs.filter(p=>{
        if(filter){
          const found = (p.guia||'').toLowerCase().includes(filter) || 
                        (p.nombre||'').toLowerCase().includes(filter) || 
                        (p.estado||'').toLowerCase().includes(filter) || 
                        (p.domicilio||'').toLowerCase().includes(filter); 
          if(!found) return false;
        }
        if(estadoF && p.estado !== estadoF) return false;
        
        const fechaPaquete = new Date(p.created);
        if(desde && fechaPaquete < desde) return false;
        if(hasta) {
            const hastaMañana = new Date(hasta);
            hastaMañana.setDate(hastaMañana.getDate() + 1);
            if (fechaPaquete >= hastaMañana) return false;
        }
        return true;
      }).sort((a,b)=>b.created - a.created);
      
      historialPaquetes.innerHTML = '';
      
      const fallbackGuardiaImg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTIyIDlpLTJ2MGE1IDUgMCAwIDAtNy4xNi00LjcyTDEyIDEwLjA5TDExLjE2IDQuMjdBNCA0IDAgMCAwIDggNUg1YTMgMyAwIDAgMC0zIDN2MWEzIDMgMCAwIDAgMyAzSDh2N0g2djJoMTJ2LTJoLTJ2LTd6TTkgN2EyIDIgMCAwIDEgMiAyaC43Nkw5LjM4IDdoLjI5em0yIDVWNC4wN2E0IDQgMCAwIDEgMS4zOCAxbDIuMjQgNy45M0gxMWExIDEgMCAwIDAtMS0xVjdoMVoiLz48L3N2Zz4=';

      rows.forEach(p=>{
        const card = document.createElement('div'); 
        card.className = `historial-card estado-${p.estado || 'na'}`;
        
        let thumbsHTML = '';
        if(p.foto){
          thumbsHTML += `<img src="${p.foto}" class="thumb" alt="Foto Paquete" data-paquete-id="${p.id}" data-type="foto">`;
        }
        if(p.idFoto){
          thumbsHTML += `<img src="${p.idFoto}" class="thumb" alt="Foto ID" data-paquete-id="${p.id}" data-type="id">`;
        }
        if(p.firma){
          thumbsHTML += `<img src="${p.firma}" class="thumb thumb-firma" alt="Firma" data-paquete-id="${p.id}" data-type="firma">`;
        }
        
        let actionsHTML = `<button class="btn ghost" data-id="${p.id}" data-act="view">Ver</button>`;
        if (userRol === 'admin') {
          actionsHTML += ` <button class="btn danger-ghost" data-id="${p.id}" data-act="delete">Eliminar</button>`;
        }
        
        const fotoRecibidoSrc = p.fotoRecibidoPor || fallbackGuardiaImg;
        const fotoEntregadoSrc = p.fotoEntregadoPor || fallbackGuardiaImg;

        card.innerHTML = `
          <div class="card-header">
            <strong>${p.domicilio || 'Sin domicilio'}</strong>
            <span class="guia">Guía: ${p.guia || '—'} | Residente: ${p.nombre}</span>
          </div>
          
          <div class="card-body">
            <div class="card-section">
              <span class="label">Estado</span>
              <span class="estado-tag">${p.estado === 'en_caseta' ? 'En Caseta' : 'Entregado'}</span>
            </div>
            
            ${p.comentarios ? `
            <div class="card-section">
              <span class="label">Comentarios</span>
              <p class="comentarios">${p.comentarios}</p>
            </div>
            ` : ''}
            
            <div class="card-section">
              <span class="label">Trazabilidad</span>
              <div class="trazabilidad">
                <div class="guardia-info">
                  <img src="${fotoRecibidoSrc}" alt="Guardia que recibió" class="guardia-thumb">
                  <div class="guardia-info-texto">
                    <strong>Recibió:</strong> ${p.recibidoPor || '-'}
                    <span class="fecha">${formatDate(p.created)}</span>
                  </div>
                </div>
                ${p.entregadoEn ? `
                <div class="guardia-info">
                  <img src="${fotoEntregadoSrc}" alt="Guardia que entregó" class="guardia-thumb">
                  <div class="guardia-info-texto">
                    <strong>Entregó:</strong> ${p.entregadoPor || '-'}
                    <span class="fecha">${formatDate(p.entregadoEn)}</span>
                  </div>
                </div>
                ` : ''}
              </div>
            </div>
            
            ${thumbsHTML ? `
            <div class="card-section">
              <span class="label">Galería</span>
              <div class="galeria-thumbs">
                ${thumbsHTML}
              </div>
            </div>
            ` : ''}
          </div>
          
          <div class="card-footer">
            ${actionsHTML}
          </div>
        `;
        
        card.querySelectorAll('.thumb, [data-act="view"]').forEach(el => {
          el.addEventListener('click', async () => {
            const id = el.dataset.paqueteId || el.dataset.id;
            const type = el.dataset.type || 'foto';
            const paquete = await getByKey('paquetes', Number(id));
            if (paquete) openViewerFor(paquete, type);
          });
        });
        
        card.querySelectorAll('[data-act="delete"]').forEach(el => {
          el.addEventListener('click', async () => {
            if (userRol !== 'admin') return;
            const id = Number(el.dataset.id);
            const p = await getByKey('paquetes', id);
            if (!p) return;
            
            itemToDelete = { type: 'paquete', id: p.id };
            deleteConfirmMsg.textContent = `¿Estás seguro de eliminar el paquete con guía ${p.guia} para ${p.nombre}? Esta acción no se puede deshacer.`;
            deleteConfirmModal.classList.remove('hidden');
          });
        });

        historialPaquetes.appendChild(card);
      });
      
      const totalMostrados = rows.length;
      const enCasetaMostrados = rows.filter(p => p.estado === 'en_caseta').length;
      historialContador.textContent = `Mostrando: ${totalMostrados} paquetes | En Caseta (filtrados): ${enCasetaMostrados}`;
    }


    function formatDate(ts){
      if(!ts) return '-';
      const d = new Date(ts);
      return d.toLocaleString(); 
    }
    
    function formatLabelDate(dateString) {
      if (!dateString) return null;
      try {
        const parts = dateString.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10); 
        const day = parseInt(parts[2], 10); 
        
        const shortYear = year.toString().slice(-2);
        return `${day}/${month}/${shortYear}`;
      } catch (e) {
        return dateString; 
      }
    }


    await rebuildAutocomplete(); await refreshDomicilios(); await refreshPaquetes();

    guiaEl.addEventListener('input', async ()=>{
      clearMessage(); 
      const q = guiaEl.value.trim().toLowerCase();
      guiaSuggestions.innerHTML = '';
      if(!q) return;
      const paqs = await getAll('paquetes');
      
      const matches = paqs.filter(p => 
        p.estado === 'en_caseta' && 
        ((p.guia||'').toLowerCase().includes(q) || (p.nombre||'').toLowerCase().includes(q))
      );

      if(matches.length){
        const ul = document.createElement('ul');
        matches.slice(0,8).forEach(m=>{
          const li = document.createElement('li');
          li.textContent = `${m.guia} · ${m.nombre} · ${m.paqueteria||''}`;
          li.addEventListener('click', async ()=>{
            guiaEl.value = m.guia;
            nombreDest.value = m.nombre || '';
            paqueteriaInput.value = m.paqueteria || '';
            domicilioInput.value = m.domicilio || '';
            comentariosPaquete.value = m.comentarios || ''; 
            guiaSuggestions.innerHTML = '';
            
            if (m.foto) {
              fotoPreview.innerHTML = `<img alt="foto paquete existente" src="${m.foto}">`;
            } else {
              fotoPreview.innerHTML = '';
            }
            fotoInput.value = ''; 
          });
          ul.appendChild(li);
        });
        guiaSuggestions.appendChild(ul);
      }
    });

    domicilioInput.addEventListener('input', async () => {
      clearTimeout(domicilioDebounceTimer); 
      const dom = domicilioInput.value.trim();
      
      if (!dom) {
        return; 
      }

      domicilioDebounceTimer = setTimeout(async () => {
        if (!confirmEntregarModal.classList.contains('hidden') || 
            !confirmEntregarVariosModal.classList.contains('hidden') || 
            !firmaModal.classList.contains('hidden')) {
          return;
        }
        if (guiaEl.value.trim().length > 0) {
            return;
        }

        const paqs = await getAll('paquetes');
        const paquetesParaEntregar = paqs.filter(p => p.domicilio === dom && p.estado === 'en_caseta');

        if (paquetesParaEntregar.length > 0) {
          currentBatchToDeliver = paquetesParaEntregar;
          domicilioVariosTxt.textContent = dom;
          listaPaquetesVarios.innerHTML = '<ul>' + 
            paquetesParaEntregar.map(p => {
              const fotoMiniatura = p.foto ? `<img src="${p.foto}" class="thumb-miniatura" data-paquete-id="${p.id}" data-type="foto" alt="foto paquete">` : '';
              return `
                <li style="display: flex; align-items: center; gap: 8px;">
                  ${fotoMiniatura}
                  <div>
                    <strong>${p.guia}</strong> - ${p.nombre}
                    <div class="info-paquete">
                      ${p.paqueteria || 'Sin paquetería'} | Recibido: ${formatDate(p.created)}
                    </div>
                  </div>
                </li>`;
            }).join('') +
            '</ul>';
          
          confirmEntregarVariosModal.classList.remove('hidden');
        }
      }, 1000); 
    });

    listaPaquetesVarios.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('thumb-miniatura')) {
        const paqueteId = Number(target.dataset.paqueteId);
        const tipoFoto = target.dataset.type;
        const paquete = currentBatchToDeliver.find(p => p.id === paqueteId);
        if (paquete) {
          openViewerFor(paquete, tipoFoto);
        }
      }
    });


    recibirBtn.addEventListener('click', async ()=>{
      showMessage('Registrando...', 'loading', 0); 
      const guia = guiaEl.value.trim();
      const nombre = nombreDest.value.trim();
      const comentarios = comentariosPaquete.value.trim(); 
      const fotoActual = fotoInput.files[0]; 
      const fotoExistente = fotoPreview.querySelector('img') ? fotoPreview.querySelector('img').src : null; 

      if(!guia || !nombre){ 
        showMessage('Guía y nombre son obligatorios', 'error');
        return; 
      }
      
      if (!fotoActual && !fotoExistente) {
          showMessage('Es obligatorio 📸 Tomar foto del paquete', 'error');
          return;
      }

      const paqs = await getAll('paquetes');
      const p = paqs.find(x => x.guia === guia);
      if (p && p.estado === 'entregado') {
        showMessage('Ese paquete ya fue entregado', 'error');
        return;
      }

      // Si hay foto nueva, la comprime. Si es existente, ya está comprimida.
      const fotoDataURL = fotoActual ? await fileToDataURL(fotoActual) : fotoExistente;

      const paquete = {
          guia, 
          nombre, 
          paqueteria: paqueteriaInput.value, 
          domicilio: domicilioInput.value, 
          foto: fotoDataURL, 
          estado: 'en_caseta', 
          created: Date.now(), 
          recibidoPor: user.nombre,
          fotoRecibidoPor: userFoto, 
          comentarios: comentarios, 
          entregadoPor: null,
          fotoEntregadoPor: null,
          entregadoEn: null,
          firma: null,
          idFoto: null
      };
      
      try{
        const id = p ? await putItem('paquetes', {...paquete, id: p.id}) : await addItem('paquetes', paquete);
        if (!p) {
          await addItem('historial',{paqueteId:id,estado:'en_caseta',usuario:user.nombre,fecha:Date.now(),nota:''});
        }
        
        let notified = false;
        
        if (notificarSi.checked) {
          const dom = domicilioInput.value.trim();
          let domInfo = null;
          if (dom) {
            const doms = await getAll('domicilios');
            domInfo = doms.find(d => d.calle === dom);
          }
          
          const nombreRes = nombreDest.value.trim() || `residente del ${dom}`;
          const paqInfo = `Paquete: ${paqueteriaInput.value || 'N/A'}\nGuía: ${guia}`;
          const domInfoMsg = `Domicilio: ${dom || 'No especificado'}`;
          const comentariosMsg = comentarios ? `\nComentarios: ${comentarios}` : '';
          
          const msg = `📦 *PAQUETE EN CASETA* 📦\nHola ${nombreRes}, se ha recibido 1 paquete para su domicilio.\n\n${domInfoMsg}\n${paqInfo}${comentariosMsg}\n\nRecibido por: ${user.nombre}.`;

          const fotoFile = dataURLtoFile(fotoDataURL, `paquete_${guia}.png`);
          const files = fotoFile ? [fotoFile] : [];
          const shareData = {
            title: 'Paquete Recibido',
            text: msg,
            files: files
          };

          if (navigator.canShare && navigator.canShare(shareData)) {
            try {
              // Limpiamos el "Registrando..."
              clearMessage(); 
              await navigator.share(shareData);
              notified = true;
            } catch (err) {
              console.warn("Web Share API (con archivos) falló, volviendo a WA:", err);
              notified = false; 
              if (err.name !== 'AbortError') {
                   if (domInfo && domInfo.telefono) {
                      const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`;
                      window.open(url, '_blank');
                      notified = true; 
                   }
              }
            }
          } 
          else if (domInfo && domInfo.telefono) {
            clearMessage(); 
            console.log("Web Share API no soporta archivos, usando fallback de WA.");
            const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
            notified = true;
          }
        } 
        
        
        if(notified) {
          showMessage(p ? 'Paquete actualizado (Abriendo app...)' : 'Paquete registrado (Abriendo app...)', 'success');
        } else {
          showMessage(p ? 'Paquete actualizado' : 'Paquete registrado', 'success');
        }

        guiaEl.value=''; nombreDest.value=''; paqueteriaInput.value=''; domicilioInput.value=''; fotoInput.value='';
        comentariosPaquete.value = ''; 
        fotoPreview.innerHTML = '';
        notificarSi.checked = true; 
        await refreshPaquetes(); await rebuildAutocomplete();
      }catch(err){
        const errorMsg = (err.name === 'ConstraintError' || (err.message && err.message.includes('key'))) ? 'Error: Guía duplicada.' : 'Error al guardar.';
        showMessage(`${errorMsg}`, 'error');
        console.error(err);
      }
    });


    entregarBtn.addEventListener('click', async ()=>{
      clearMessage();
      currentBatchToDeliver = []; 
      const guia = guiaEl.value.trim();
      if(!guia){ 
        showMessage('Escribe la guía del paquete a entregar', 'error');
        return; 
      }
      const paqs = await getAll('paquetes');
      const p = paqs.find(x=>x.guia===guia);
      
      if(!p){ 
        showMessage('Paquete no encontrado', 'error');
        return; 
      }
      if (p.estado === 'entregado') {
        showMessage('Ese paquete ya fue entregado', 'error');
        return;
      }

      confirmEntregarMsg.textContent = `¿Estás seguro de entregar el paquete ${p.guia} a ${p.nombre}?`;
      confirmEntregarModal.classList.remove('hidden');
    });

    cancelEntregarBtn.addEventListener('click', () => {
      confirmEntregarModal.classList.add('hidden');
    });

    confirmEntregarBtn.addEventListener('click', () => {
      confirmEntregarModal.classList.add('hidden');
      firmaModal.classList.remove('hidden');
      idPreview.innerHTML = '';
      idFotoInput.value = '';
      notificarEntregaSi.checked = true; 
      clearCanvas(); 
    });

    cancelVariosBtn.addEventListener('click', () => {
      confirmEntregarVariosModal.classList.add('hidden');
      currentBatchToDeliver = []; 
    });

    confirmVariosBtn.addEventListener('click', () => {
      confirmEntregarVariosModal.classList.add('hidden');
      firmaModal.classList.remove('hidden');
      idPreview.innerHTML = '';
      idFotoInput.value = '';
      notificarEntregaSi.checked = true; 
      clearCanvas(); 
    });


    cerrarFirma.addEventListener('click', () => {
        firmaModal.classList.add('hidden');
        currentBatchToDeliver = []; 
    });

    guardarFirma.addEventListener('click', async ()=>{
      
      const idFotoFile = idFotoInput.files[0];
      const idFotoPreviewSrc = idPreview.querySelector('img') ? idPreview.querySelector('img').src : null;

      if (!idFotoFile && !idFotoPreviewSrc) { 
        showMessage('Es obligatorio 🆔 Tomar foto de ID', 'error');
        return;
      }

      if (!hasSigned) { 
          showMessage('Es obligatorio ✍️ Firmar en el recuadro.', 'error');
          return;
      }
      
      showMessage('Guardando entrega...', 'loading', 0);

      const firmaDataURL = firmaCanvas.toDataURL('image/png');
      // Si hay foto nueva la comprime, si no, usa la existente
      const idFotoDataURL = idFotoFile ? await fileToDataURL(idFotoFile) : idFotoPreviewSrc;
      const entregadoPor = user.nombre;
      const entregadoEn = Date.now();
      let notified = false; 
      
      let domInfo = null;
      let msg = "";
      let shareTitle = "";
      let comentarios = ""; 
      
      if (currentBatchToDeliver.length > 0) {
        const dom = currentBatchToDeliver[0].domicilio;
        comentarios = currentBatchToDeliver[0].comentarios || ""; 
        
        try {
          for (const p of currentBatchToDeliver) {
            p.estado = 'entregado';
            p.firma = firmaDataURL;
            p.idFoto = idFotoDataURL;
            p.entregadoPor = entregadoPor;
            p.entregadoEn = entregadoEn;
            p.fotoEntregadoPor = userFoto; 
            await putItem('paquetes', p);
            await addItem('historial',{paqueteId:p.id,estado:'entregado',usuario:entregadoPor,fecha:entregadoEn,nota:'Entrega en lote'});
          }
          
          if (dom) {
            const doms = await getAll('domicilios');
            domInfo = doms.find(d => d.calle === dom);
          }
          const comentariosMsg = comentarios ? `\nComentarios: ${comentarios}` : '';
          msg = `✅ *PAQUETES ENTREGADOS* ✅\nHola residente del ${dom}, se han entregado ${currentBatchToDeliver.length} paquetes en su domicilio.${comentariosMsg}\n\nEntregado por: ${user.nombre}.`;
          shareTitle = "Paquetes Entregados";

          showMessage(`Se entregaron ${currentBatchToDeliver.length} paquetes.`, 'success');
          
        } catch (err) {
          showMessage('Error al guardar entrega múltiple.', 'error');
          console.error(err);
        }
        
        currentBatchToDeliver = []; 
      
      } else {
        const guia = guiaEl.value.trim(); 
        const paqs = await getAll('paquetes');
        const p = paqs.find(x=>x.guia===guia);

        if(!p){ 
          firmaModal.classList.add('hidden');
          showMessage('Paquete no encontrado', 'error'); 
          return; 
        }
        if (p.estado === 'entregado') {
          firmaModal.classList.add('hidden');
          showMessage('Ese paquete ya fue entregado', 'error');
          return;
        }

        p.estado = 'entregado';
        p.firma = firmaDataURL;
        p.idFoto = idFotoDataURL;
        p.entregadoPor = entregadoPor;
        p.entregadoEn = entregadoEn;
        p.fotoEntregadoPor = userFoto; 
        
        await putItem('paquetes', p);
        await addItem('historial',{paqueteId:p.id,estado:'entregado',usuario:entregadoPor,fecha:entregadoEn,nota:''});
        
        comentarios = p.comentarios || ""; 
        const dom = p.domicilio;
        if (dom) {
            const doms = await getAll('domicilios');
            domInfo = doms.find(d => d.calle === dom);
        }
        const comentariosMsg = comentarios ? `\nComentarios: ${comentarios}` : '';
        msg = `✅ *PAQUETE ENTREGADO* ✅\nHola ${p.nombre}, se ha entregado su paquete (Guía: ${p.guia}).${comentariosMsg}\n\nEntregado por: ${user.nombre}.`;
        shareTitle = "Paquete Entregado";
        
        // No mostramos "Paquete entregado" aquí, esperamos a la notificación
      }
      
      
      if (notificarEntregaSi.checked) {
        const firmaFile = dataURLtoFile(firmaDataURL, `firma_entrega.png`);
        const idFile = dataURLtoFile(idFotoDataURL, `id_entrega.png`);
        
        const files = [];
        if (firmaFile) files.push(firmaFile);
        if (idFile) files.push(idFile);
        
        const shareData = {
          title: shareTitle,
          text: msg,
          files: files
        };

        if (navigator.canShare && navigator.canShare(shareData)) {
          try {
            clearMessage(); // Limpiar "Guardando..."
            await navigator.share(shareData);
            notified = true;
          } catch (err) {
            if (err.name !== 'AbortError') {
               if (domInfo && domInfo.telefono) {
                  console.warn("Web Share API falló, usando fallback de WA:", err);
                  const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`;
                  window.open(url, '_blank');
                  notified = true;
               }
            }
          }
        } 
        else if (domInfo && domInfo.telefono) {
          clearMessage(); // Limpiar "Guardando..."
          console.log("Web Share API no soporta archivos, usando fallback de WA.");
          const url = `https://wa.me/${domInfo.telefono}?text=${encodeURIComponent(msg)}`;
          window.open(url, '_blank');
          notified = true;
        }
      } 
      
      if (notified) {
         showMessage('Entrega guardada. (Abriendo app...)', 'success');
      } else {
         showMessage('Entrega guardada (Sin notif.)', 'success');
      }

      firmaModal.classList.add('hidden');
      guiaEl.value=''; nombreDest.value=''; paqueteriaInput.value=''; domicilioInput.value=''; fotoInput.value='';
      comentariosPaquete.value = ''; 
      fotoPreview.innerHTML = '';
      idPreview.innerHTML = '';
      idFotoInput.value = '';
      hasSigned = false;
      entregarVariosBtn.disabled = true; 
      entregarVariosBtn.textContent = 'Entregar (Varios)';
      await refreshPaquetes();
    });


    domForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      showMessage('Guardando domicilio...', 'loading', 0); 
      
      const calle = document.getElementById('domCalle').value.trim();
      const res1 = document.getElementById('domResidente1').value.trim();
      const nota = document.getElementById('domNota').value.trim();
      const telefono = document.getElementById('domTelefono').value.trim();

      const cleanPhone = telefono.replace(/[^0-9]/g, ''); 

      if(telefono && (!cleanPhone || cleanPhone.length < 10)) {
         showMessage('Teléfono inválido. Use solo números (ej. 521...).', 'error');
         return;
      }
      
      const otros = Array.from(document.querySelectorAll('.residenteField')).map(i=>i.value.trim()).filter(Boolean);
      const residentes = [res1, ...otros];
      
      try{
        const id = await addItem('domicilios',{calle, residentes, nota, telefono: cleanPhone, created:Date.now()});
        showMessage('Domicilio guardado', 'success');
        domForm.reset(); moreResidents.innerHTML='';
        await refreshDomicilios(); await rebuildAutocomplete();
      }catch(err){ 
        showMessage('Error al guardar domicilio', 'error');
        console.error(err); 
      }
    });


    tablaDomicilios.addEventListener('click', async (e)=>{
      const act = e.target.dataset.act;
      const id = Number(e.target.dataset.id);
      if(act==='edit'){
        const d = await getByKey('domicilios', id);
        if(!d) return;
        document.getElementById('domCalle').value = d.calle;
        document.getElementById('domResidente1').value = (d.residentes && d.residentes[0]) || '';
        document.getElementById('domNota').value = d.nota || '';
        document.getElementById('domTelefono').value = d.telefono || '';
        showMessage('Datos cargados. Guarde una nueva entrada.', 'info');
      }
    });
    
    deleteCancelBtn.addEventListener('click', () => {
      deleteConfirmModal.classList.add('hidden');
      itemToDelete = { type: null, id: null };
    });
    
    deleteConfirmBtn.addEventListener('click', async () => {
      if (userRol !== 'admin' || !itemToDelete.id) return;
      
      showMessage('Eliminando...', 'loading', 0);

      try {
        if (itemToDelete.type === 'paquete') {
          await deleteItem('paquetes', itemToDelete.id);
          showMessage('Paquete eliminado.', 'success');
          await refreshPaquetes();
        } 
        else if (itemToDelete.type === 'usuario') {
          if (itemToDelete.id === user.id) {
            showMessage('No puedes eliminar tu propia cuenta.', 'error');
          } else {
            await deleteItem('users', itemToDelete.id);
            showMessage('Usuario eliminado.', 'success');
            await refreshUsuarios();
          }
        }
      } catch (err) {
        showMessage('Error al eliminar.', 'error');
        console.error(err);
      }
      
      deleteConfirmModal.classList.add('hidden');
      itemToDelete = { type: null, id: null };
    });


    // image viewer logic
    let currentGallery = []; 
    let currentIndex = 0;
    function openViewerFor(p, type){
      currentGallery = [];
      if(p.foto) currentGallery.push({src:p.foto, meta:`Foto paquete — ${p.guia}`});
      if(p.idFoto) currentGallery.push({src:p.idFoto, meta:`ID — ${p.guia}`});
      if(p.firma) currentGallery.push({src:p.firma, meta:`Firma — ${p.guia}`});
      if(currentGallery.length===0) return;
      
      let desiredIndex = 0;
      if (type === 'id' && p.idFoto) {
        desiredIndex = currentGallery.findIndex(x => x.meta.startsWith('ID'));
      } else if (type === 'firma' && p.firma) {
        desiredIndex = currentGallery.findIndex(x => x.meta.startsWith('Firma'));
      }
      currentIndex = desiredIndex >= 0 ? desiredIndex : 0;
      
      showGalleryImage();
      imageViewer.classList.remove('hidden');
    }
    function showGalleryImage(){
      const item = currentGallery[currentIndex];
      if(!item) return;
      viewerImg.src = item.src;
      viewerMeta.textContent = item.meta;
    }
    prevImg.addEventListener('click', ()=>{
      if(currentGallery.length===0) return;
      currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
      showGalleryImage();
    });
    nextImg.addEventListener('click', ()=>{
      if(currentGallery.length===0) return;
      currentIndex = (currentIndex + 1) % currentGallery.length;
      showGalleryImage();
    });
    closeImageViewer.addEventListener('click', ()=>{ imageViewer.classList.add('hidden'); viewerImg.src=''; });

    // filters
    buscarHist.addEventListener('input', refreshPaquetes);
    filtroEstado.addEventListener('change', refreshPaquetes);

    fechaDesde.addEventListener('change', (e) => {
      const formatted = formatLabelDate(e.target.value);
      const labelElement = e.target.parentElement; 
      
      if (formatted) {
        fechaDesdeLabel.textContent = formatted;
        labelElement.classList.add('has-value');
      } else {
        fechaDesdeLabel.textContent = '🗓️ Desde';
        labelElement.classList.remove('has-value');
      }
      refreshPaquetes(); 
    });
    
    fechaHasta.addEventListener('change', (e) => {
      const formatted = formatLabelDate(e.target.value);
      const labelElement = e.target.parentElement; 

      if (formatted) {
        fechaHastaLabel.textContent = formatted;
        labelElement.classList.add('has-value');
      } else {
        fechaHastaLabel.textContent = '🗓️ Hasta';
        labelElement.classList.remove('has-value');
      }
      refreshPaquetes(); 
    });
    
    
    // --- INICIO FUNCIONES ADMIN ---
    
    async function refreshUsuarios() {
      if (userRol !== 'admin') return;
      
      const users = await getAll('users');
      tablaUsuarios.innerHTML = '';
      if (users.length === 0) {
        tablaUsuarios.innerHTML = '<p class="muted">No hay usuarios registrados.</p>';
        return;
      }
      
      users.forEach(u => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<div class="info" style="display: flex; align-items: center; gap: 10px;">
                          <img src="${u.foto || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjQgMjQiPjxwYXRoIGZpbGw9ImN1cnJlbnRDb2xvciIgZD0iTTIyIDlpLTJ2MGE1IDUgMCAwIDAtNy4xNi00LjcyTDEyIDEwLjA5TDExLjE2IDQuMjdBNCA0IDAgMCAwIDggNUg1YTMgMyAwIDAgMC0zIDN2MWEzIDMgMCAwIDAgMyAzSDh2N0g2djJoMTJ2LTJoLTJ2LTd6TTkgN2EyIDIgMCAwIDEgMiAyaC43Nkw5LjM4IDdoLjI5em0yIDVWNC4wN2E0IDQgMCAwIDEgMS4zOCAxbDIuMjQgNy45M0gxMWExIDEgMCAwIDAtMS0xVjdoMVoiLz48L3N2Zz4='}" class="guardia-thumb">
                          <div>
                            <strong>${u.nombre}</strong>
                            <div class="muted">Usuario: ${u.usuario} | Rol: ${u.rol || 'guardia'}</div>
                          </div>
                         </div>
                         <div>
                           ${u.id === user.id ? '<span class="muted">(Tú)</span>' : `<button class="btn danger-ghost" data-id="${u.id}" data-act="delete_user">Eliminar</button>`}
                         </div>`;
        tablaUsuarios.appendChild(row);
      });
    }
    
    tablaUsuarios.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      const id = Number(e.target.dataset.id);
      
      if (act === 'delete_user') {
        if (userRol !== 'admin' || id === user.id) return;
        
        const u = e.target.closest('.row').querySelector('.info strong').textContent;
        itemToDelete = { type: 'usuario', id: id };
        deleteConfirmMsg.textContent = `¿Estás seguro de eliminar al usuario ${u}? Esta acción no se puede deshacer.`;
        deleteConfirmModal.classList.remove('hidden');
      }
    });
    
    refreshUsersBtn.addEventListener('click', refreshUsuarios);
    downloadPdfBtn.addEventListener('click', descargarPDF);

    async function descargarPDF() {
      if (userRol !== 'admin' || !jsPDF) {
        showMessage('Error: La librería PDF no se cargó.', 'error');
        return;
      }
      showMessage('Generando PDF...', 'loading', 0);
      
      try {
        const doc = new jsPDF();
        const allPaquetes = await getAll('paquetes');
        const allDomicilios = await getAll('domicilios');
        
        const fechaHoy = new Date().toLocaleString();
        
        doc.setFontSize(18);
        doc.text('Reporte de Paquetería', 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generado por: ${user.nombre} (${user.rol})`, 14, 28);
        doc.text(`Fecha: ${fechaHoy}`, 14, 34);

        const enCaseta = allPaquetes.filter(p => p.estado === 'en_caseta');
        doc.autoTable({
          startY: 40,
          head: [['Guía', 'Domicilio', 'Residente', 'Recibido (Fecha)', 'Recibido (Guardia)', 'Comentarios']],
          body: enCaseta.map(p => [
            p.guia,
            p.domicilio,
            p.nombre,
            formatDate(p.created),
            p.recibidoPor,
            p.comentarios || '-'
          ]),
          headStyles: { fillColor: [11, 58, 102] }, // Azul
          didDrawPage: (data) => {
             doc.setFontSize(16);
             doc.text('Paquetes Actualmente en Caseta', data.settings.margin.left, data.settings.top - 10);
          }
        });

        const entregados = allPaquetes.filter(p => p.estado === 'entregado').sort((a,b) => b.entregadoEn - a.entregadoEn).slice(0, 50);
        doc.autoTable({
          head: [['Guía', 'Domicilio', 'Residente', 'Entregado (Fecha)', 'Entregado (Guardia)', 'Comentarios']],
          body: entregados.map(p => [
            p.guia,
            p.domicilio,
            p.nombre,
            formatDate(p.entregadoEn),
            p.entregadoPor,
            p.comentarios || '-'
          ]),
          headStyles: { fillColor: [21, 128, 61] }, // Verde
          didDrawPage: (data) => {
             doc.setFontSize(16);
             doc.text('Últimos 50 Paquetes Entregados', data.settings.margin.left, data.settings.top - 10);
          }
        });
        
        doc.autoTable({
          head: [['Domicilio', 'Residentes', 'Teléfono', 'Nota']],
          body: allDomicilios.map(d => [
            d.calle,
            (d.residentes || []).join(', '),
            d.telefono || '-',
            d.nota || '-'
          ]),
          headStyles: { fillColor: [107, 114, 128] }, // Gris
          didDrawPage: (data) => {
             doc.setFontSize(16);
             doc.text('Directorio de Domicilios', data.settings.margin.left, data.settings.top - 10);
          }
        });

        doc.save(`Reporte_CtrlPaqueteria_${new Date().toISOString().split('T')[0]}.pdf`);
        showMessage('PDF generado.', 'success');
      } catch (err) {
        showMessage('Error al generar el PDF.', 'error');
        console.error("Error PDF:", err);
      }
    }
    
    // --- INICIO LÓGICA DE RESPALDO (BACKUP) ---
    
    // 1. Exportar
    exportBackupBtn.addEventListener('click', async () => {
      showMessage('Generando respaldo...', 'loading', 0);
      try {
        const backupData = {
          users: await getAll('users'),
          domicilios: await getAll('domicilios'),
          paquetes: await getAll('paquetes'),
          historial: await getAll('historial'),
          exportedAt: new Date().toISOString()
        };
        
        const jsonString = JSON.stringify(backupData);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ctrl_paqueteria_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showMessage('Respaldo exportado.', 'success');
      } catch (err) {
        showMessage('Error al exportar.', 'error');
        console.error("Error al exportar:", err);
      }
    });

    // 2. Botón de Restaurar (abre el input de archivo)
    restoreBackupBtn.addEventListener('click', () => {
      // Pedir confirmación
      const DANGER_PROMPT = "RESTAURAR";
      const confirmation = prompt(`¡PELIGRO! Esto borrará TODOS los datos actuales y los reemplazará con el archivo de respaldo.\n\nSi estás seguro, escribe "${DANGER_PROMPT}" y presiona Aceptar.`);
      
      if (confirmation === DANGER_PROMPT) {
        restoreBackupInput.click(); // Abre el selector de archivos
      } else {
        showMessage('Restauración cancelada.', 'info');
      }
    });

    // 3. Cuando se selecciona un archivo
    restoreBackupInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) {
        return; 
      }
      
      showMessage('Restaurando respaldo...', 'loading', 0);
      
      try {
        const text = await file.text();
        const backupData = JSON.parse(text);

        if (!backupData.users || !backupData.domicilios || !backupData.paquetes) {
          throw new Error("Archivo de respaldo inválido o corrupto.");
        }
        
        // Limpiar base de datos actual
        await clearStore('users');
        await clearStore('domicilios');
        await clearStore('paquetes');
        await clearStore('historial');
        
        // Cargar nuevos datos (usando las funciones de sql-lite.js)
        await bulkAdd('users', backupData.users);
        await bulkAdd('domicilios', backupData.domicilios);
        await bulkAdd('paquetes', backupData.paquetes);
        // Historial puede no existir en respaldos viejos
        if (backupData.historial) {
          await bulkAdd('historial', backupData.historial);
        }

        showMessage('Restauración completada.', 'success', 5000);
        
        // Forzar recarga de la app para reflejar los nuevos datos
        setTimeout(() => {
          location.reload();
        }, 2000);

      } catch (err) {
        showMessage('Error al restaurar.', 'error', 5000);
        console.error("Error al restaurar:", err);
      } finally {
        // Limpiar el input para poder subir el mismo archivo otra vez
        restoreBackupInput.value = '';
      }
    });
    // --- FIN LÓGICA DE RESPALDO ---
    
  }
})();


// --- INICIO DE LA MODIFICACIÓN ---
// Cierre del 'window.onload'
};
// --- FIN DE LA MODIFICACIÓN ---


