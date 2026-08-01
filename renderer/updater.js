const {ipcRenderer:updaterIpc}=require("electron");

const updateCard=document.getElementById("updateCard");
const cadenceVersion=document.getElementById("cadenceVersion");
const updateStateIcon=document.getElementById("updateStateIcon");
const updateStateLabel=document.getElementById("updateStateLabel");
const updateLastChecked=document.getElementById("updateLastChecked");
const updateStatus=document.getElementById("updateStatus");
const updateProgress=document.getElementById("updateProgress");
const updateProgressBar=document.getElementById("updateProgressBar");
const updateProgressText=document.getElementById("updateProgressText");
const checkForUpdates=document.getElementById("checkForUpdates");
const updateAvailableModal=document.getElementById("updateAvailableModal");
const updateReadyModal=document.getElementById("updateReadyModal");
let dismissedVersion="";

const statePresentation={
    idle:{icon:"✦",label:"Ready when you are"},
    development:{icon:"◇",label:"Installed builds only"},
    checking:{icon:"↻",label:"Checking GitHub"},
    current:{icon:"✓",label:"You’re up to date"},
    available:{icon:"↓",label:"A new version is ready"},
    downloading:{icon:"↓",label:"Bringing it home"},
    downloaded:{icon:"✓",label:"Ready to restart"},
    error:{icon:"!",label:"Couldn’t check just now"}
};

function closeUpdateModal(modal){
    modal.classList.add("hidden");
}

function formatCheckedAt(value){
    if(!value) return "Not checked yet";
    const checked=new Date(value);
    if(Number.isNaN(checked.getTime())) return "Checked recently";
    return `Checked ${checked.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}`;
}

function showProgress(percent){
    const safePercent=Math.max(0,Math.min(100,Number(percent) || 0));
    updateProgress.classList.remove("hidden");
    updateProgressText.classList.remove("hidden");
    updateProgress.setAttribute("aria-hidden","false");
    updateProgressBar.style.width=`${safePercent}%`;
    updateProgressText.textContent=`${safePercent}%`;
}

function hideProgress(){
    updateProgress.classList.add("hidden");
    updateProgressText.classList.add("hidden");
    updateProgress.setAttribute("aria-hidden","true");
}

function renderState(state){
    const presentation=statePresentation[state.status] || statePresentation.idle;
    updateCard.dataset.updateState=state.status;
    cadenceVersion.textContent=`v${state.version}`;
    updateStateIcon.textContent=presentation.icon;
    updateStateLabel.textContent=presentation.label;
    updateLastChecked.textContent=formatCheckedAt(state.checkedAt);
    checkForUpdates.disabled=state.status==="checking" || state.status==="downloading";
    checkForUpdates.innerHTML=state.status==="checking"
        ? '<span class="update-spin" aria-hidden="true">↻</span> Checking…'
        : '<span aria-hidden="true">↻</span> Check for updates';

    if(state.status==="idle") updateStatus.textContent="Check for the newest features and gentle improvements.";
    if(state.status==="development") updateStatus.textContent=state.message;
    if(state.status==="checking") updateStatus.textContent="Looking for a newer version of Cadence…";
    if(state.status==="current") updateStatus.textContent=state.message || "You have the newest version of Cadence.";
    if(state.status==="available") updateStatus.textContent=`Version ${state.availableVersion} is available.`;
    if(state.status==="downloading") updateStatus.textContent="Downloading safely in the background…";
    if(state.status==="downloaded") updateStatus.textContent="The update is downloaded and ready to install.";
    if(state.status==="error") updateStatus.textContent=state.message || "Cadence couldn't check for updates.";

    if(state.status==="downloading") showProgress(state.percent);
    else if(state.status==="downloaded") showProgress(100);
    else hideProgress();
}

updaterIpc.on("updater-status",(event,state)=>{
    renderState(state);

    if(state.status==="available"){
        document.getElementById("updateAvailableMessage").textContent=
            `Cadence ${state.availableVersion} is available. Would you like to download it?`;
        document.getElementById("updateCurrentVersion").textContent=`v${state.version}`;
        document.getElementById("updateNewVersion").textContent=`v${state.availableVersion}`;
        if(dismissedVersion!==state.availableVersion){
            updateAvailableModal.classList.remove("hidden");
        }
    }
    if(state.status==="downloaded") updateReadyModal.classList.remove("hidden");
});

checkForUpdates.addEventListener("click",()=>{
    dismissedVersion="";
    updaterIpc.send("check-for-updates");
});
document.getElementById("laterUpdate").addEventListener("click",()=>{
    dismissedVersion=document.getElementById("updateNewVersion").textContent.replace(/^v/,"");
    closeUpdateModal(updateAvailableModal);
});
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
