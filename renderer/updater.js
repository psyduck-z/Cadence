const {ipcRenderer:updaterIpc}=require("electron");

const cadenceVersion=document.getElementById("cadenceVersion");
const updateStatus=document.getElementById("updateStatus");
const updateProgress=document.getElementById("updateProgress");
const updateProgressBar=document.getElementById("updateProgressBar");
const checkForUpdates=document.getElementById("checkForUpdates");
const updateAvailableModal=document.getElementById("updateAvailableModal");
const updateReadyModal=document.getElementById("updateReadyModal");

function closeUpdateModal(modal){
    modal.classList.add("hidden");
}

function setUpdateStatus(text,busy=false){
    updateStatus.textContent=text;
    checkForUpdates.disabled=busy;
    checkForUpdates.textContent=busy ? "Checking…" : "Check for updates";
}

updaterIpc.on("updater-status",(event,state)=>{
    cadenceVersion.textContent=`v${state.version}`;

    if(state.status==="idle"){
        setUpdateStatus("Ready to check for updates.");
    }else if(state.status==="development"){
        setUpdateStatus(state.message);
    }else if(state.status==="checking"){
        setUpdateStatus("Looking for a newer version…",true);
    }else if(state.status==="current"){
        setUpdateStatus(state.message || "Cadence is up to date.");
    }else if(state.status==="available"){
        setUpdateStatus(`Version ${state.availableVersion} is available.`);
        document.getElementById("updateAvailableMessage").textContent=
            `Cadence ${state.availableVersion} is available. Would you like to download it?`;
        updateAvailableModal.classList.remove("hidden");
    }else if(state.status==="downloading"){
        const percent=Math.max(0,Math.min(100,state.percent || 0));
        setUpdateStatus(`Downloading update… ${percent}%`,true);
        updateProgress.classList.remove("hidden");
        updateProgress.setAttribute("aria-hidden","false");
        updateProgressBar.style.width=`${percent}%`;
    }else if(state.status==="downloaded"){
        setUpdateStatus("Update downloaded and ready to install.");
        updateProgressBar.style.width="100%";
        updateReadyModal.classList.remove("hidden");
    }else if(state.status==="error"){
        setUpdateStatus(state.message || "Cadence couldn't check for updates.");
        updateProgress.classList.add("hidden");
        updateProgress.setAttribute("aria-hidden","true");
    }
});

checkForUpdates.addEventListener("click",()=>updaterIpc.send("check-for-updates"));
document.getElementById("laterUpdate").addEventListener("click",()=>closeUpdateModal(updateAvailableModal));
document.getElementById("downloadUpdate").addEventListener("click",()=>{
    closeUpdateModal(updateAvailableModal);
    updaterIpc.send("download-update");
});
document.getElementById("laterRestart").addEventListener("click",()=>closeUpdateModal(updateReadyModal));
document.getElementById("installUpdate").addEventListener("click",()=>{
    document.getElementById("installUpdate").disabled=true;
    updaterIpc.send("install-update");
});

[updateAvailableModal,updateReadyModal].forEach(modal=>{
    modal.addEventListener("click",event=>{
        if(event.target===modal) closeUpdateModal(modal);
    });
});

document.addEventListener("keydown",event=>{
    if(event.key!=="Escape") return;
    closeUpdateModal(updateAvailableModal);
    closeUpdateModal(updateReadyModal);
});

updaterIpc.send("get-updater-status");
