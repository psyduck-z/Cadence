const {ipcRenderer:updaterIpc}=require("electron");

const updateCard=document.getElementById("updateCard");
const cadenceVersion=document.getElementById("cadenceVersion");
const updateStateIcon=document.getElementById("updateStateIcon");
const updateHeroIcon=document.getElementById("updateHeroIcon");
const updateStateLabel=document.getElementById("updateStateLabel");
const updateLastChecked=document.getElementById("updateLastChecked");
const updateStatus=document.getElementById("updateStatus");
const updateProgress=document.getElementById("updateProgress");
const updateProgressBar=document.getElementById("updateProgressBar");
const updateProgressText=document.getElementById("updateProgressText");
const updateAction=document.getElementById("checkForUpdates");
const updateTabBadge=document.getElementById("updateTabBadge");
const releaseNotesCard=document.getElementById("releaseNotesCard");
const releaseNotesTitle=document.getElementById("releaseNotesTitle");
const releaseNotesContent=document.getElementById("releaseNotesContent");
const latestVersionLabel=document.getElementById("latestVersionLabel");
const updateAvailableModal=document.getElementById("updateAvailableModal");
const updateReadyModal=document.getElementById("updateReadyModal");
const updateDeferralStorageKey="cadence-update-deferrals";
let updateDeferrals={download:"",restart:""};
try{
    updateDeferrals={...updateDeferrals,...JSON.parse(localStorage.getItem(updateDeferralStorageKey) || "{}")};
}catch(error){}
let currentState={status:"idle"};

function saveUpdateDeferrals(){
    localStorage.setItem(updateDeferralStorageKey,JSON.stringify(updateDeferrals));
}

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
    return checked.toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"});
}

function normaliseReleaseNotes(notes){
    let combined="";
    if(typeof notes==="string") combined=notes;
    if(Array.isArray(notes)){
        combined=notes.map(note=>{
            if(typeof note==="string") return note;
            return note?.note || note?.version || "";
        }).filter(Boolean).join("\n\n");
    }
    if(!combined) return "";
    if(!/<\/?[a-z][\s\S]*>/i.test(combined)) return combined.trim();

    const documentFragment=new DOMParser().parseFromString(combined,"text/html");
    documentFragment.querySelectorAll("script,style,template").forEach(element=>element.remove());
    documentFragment.querySelectorAll("br").forEach(element=>element.replaceWith("\n"));
    documentFragment.querySelectorAll("li").forEach(element=>{
        element.prepend("• ");
        element.append("\n");
    });
    documentFragment.querySelectorAll("p,h1,h2,h3,h4,h5,h6,div,ul,ol").forEach(element=>element.append("\n"));
    return documentFragment.body.textContent
        .replace(/\u00a0/g," ")
        .replace(/[ \t]+\n/g,"\n")
        .replace(/\n{3,}/g,"\n\n")
        .trim();
}

function renderReleaseNotes(state){
    if(!["available","downloading","downloaded"].includes(state.status)){
        releaseNotesCard.classList.add("hidden");
        return;
    }
    const notes=normaliseReleaseNotes(state.releaseNotes);
    if(!notes && !state.releaseName){
        releaseNotesCard.classList.add("hidden");
        return;
    }
    releaseNotesTitle.textContent=state.releaseName || "What’s new";
    latestVersionLabel.textContent=state.availableVersion ? `v${state.availableVersion}` : "";
    releaseNotesContent.textContent=notes || "A new Cadence release is ready.";
    releaseNotesCard.classList.remove("hidden");
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

function setAction(state){
    updateAction.disabled=state.status==="checking" || state.status==="downloading";
    if(state.status==="checking") updateAction.innerHTML='<span class="update-spin" aria-hidden="true">↻</span> Checking…';
    else if(state.status==="available") updateAction.innerHTML=`<span aria-hidden="true">↓</span> Download${state.availableVersion ? ` v${state.availableVersion}` : " update"}`;
    else if(state.status==="downloading") updateAction.innerHTML='<span aria-hidden="true">↓</span> Downloading…';
    else if(state.status==="downloaded") updateAction.innerHTML='<span aria-hidden="true">↻</span> Restart and install';
    else updateAction.innerHTML='<span aria-hidden="true">↻</span> Check for updates';
}

function renderState(state){
    currentState=state;
    const presentation=statePresentation[state.status] || statePresentation.idle;
    updateCard.dataset.updateState=state.status;
    cadenceVersion.textContent=`v${state.version}`;
    updateStateIcon.textContent=presentation.icon;
    updateHeroIcon.textContent=presentation.icon;
    updateStateLabel.textContent=presentation.label;
    updateLastChecked.textContent=formatCheckedAt(state.checkedAt);
    setAction(state);

    if(state.status==="idle") updateStatus.textContent="Check for the newest features and gentle improvements.";
    if(state.status==="development") updateStatus.textContent=state.message;
    if(state.status==="checking") updateStatus.textContent="Looking for a newer version of Cadence…";
    if(state.status==="current") updateStatus.textContent=state.message || "You have the newest version of Cadence.";
    if(state.status==="available") updateStatus.textContent=updateDeferrals.download===state.availableVersion
        ? "Saved for later — download whenever you’re ready."
        : `Cadence ${state.availableVersion} is ready when you are.`;
    if(state.status==="downloading") updateStatus.textContent="Downloading safely in the background…";
    if(state.status==="downloaded") updateStatus.textContent=updateDeferrals.restart===state.availableVersion
        ? "Ready when you are — restart and install from this tab."
        : "The update is downloaded and ready to install.";
    if(state.status==="error") updateStatus.textContent=state.message || "Cadence couldn't check for updates.";

    if(state.status==="downloading") showProgress(state.percent);
    else if(state.status==="downloaded") showProgress(100);
    else hideProgress();

    const needsAttention=["available","downloading","downloaded"].includes(state.status);
    updateTabBadge.classList.toggle("hidden",!needsAttention);
    renderReleaseNotes(state);
}

updaterIpc.on("updater-status",(event,state)=>{
    renderState(state);
    if(state.status==="available"){
        if(updateDeferrals.download && updateDeferrals.download!==state.availableVersion){
            updateDeferrals.download="";
            saveUpdateDeferrals();
        }
        document.getElementById("updateAvailableMessage").textContent=
            `Cadence ${state.availableVersion} is available. Would you like to download it?`;
        document.getElementById("updateCurrentVersion").textContent=`v${state.version}`;
        document.getElementById("updateNewVersion").textContent=`v${state.availableVersion}`;
        if(updateDeferrals.download!==state.availableVersion) updateAvailableModal.classList.remove("hidden");
    }
    if(state.status==="downloaded"){
        updateDeferrals.download="";
        if(updateDeferrals.restart && updateDeferrals.restart!==state.availableVersion) updateDeferrals.restart="";
        saveUpdateDeferrals();
        if(updateDeferrals.restart!==state.availableVersion) updateReadyModal.classList.remove("hidden");
    }
});

updateAction.addEventListener("click",()=>{
    if(currentState.status==="available"){
        updateAvailableModal.classList.remove("hidden");
        return;
    }
    if(currentState.status==="downloaded"){
        updateReadyModal.classList.remove("hidden");
        return;
    }
    updateDeferrals.download="";
    saveUpdateDeferrals();
    updaterIpc.send("check-for-updates");
});

document.getElementById("laterUpdate").addEventListener("click",()=>{
    updateDeferrals.download=currentState.availableVersion || document.getElementById("updateNewVersion").textContent.replace(/^v/,"");
    saveUpdateDeferrals();
    closeUpdateModal(updateAvailableModal);
    updateStatus.textContent="Saved for later — download whenever you’re ready.";
});
document.getElementById("downloadUpdate").addEventListener("click",()=>{
    updateDeferrals.download="";
    saveUpdateDeferrals();
    closeUpdateModal(updateAvailableModal);
    updaterIpc.send("download-update");
});
document.getElementById("laterRestart").addEventListener("click",()=>{
    updateDeferrals.restart=currentState.availableVersion || "downloaded";
    saveUpdateDeferrals();
    closeUpdateModal(updateReadyModal);
    updateStatus.textContent="Ready when you are — restart and install from this tab.";
});
document.getElementById("installUpdate").addEventListener("click",()=>{
    updateDeferrals.restart="";
    saveUpdateDeferrals();
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
