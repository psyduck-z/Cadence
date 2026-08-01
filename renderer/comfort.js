const appearanceStorageKey="cadence-appearance";
const appearanceThemes=["mint","blue","amber","lilac","rose","metallic"];
const appearanceNames={mint:"Mint",blue:"Blue",amber:"Amber",lilac:"Lilac",rose:"Rose",metallic:"Sleek Metallic"};
let appearance={theme:"mint",followWeather:false,transparency:100,alwaysOnTop:false};

try{
    appearance={...appearance,...JSON.parse(localStorage.getItem(appearanceStorageKey) || "{}")};
}catch(error){}
if(!appearanceThemes.includes(appearance.theme)) appearance.theme="mint";
appearance.transparency=Math.min(100,Math.max(35,Number(appearance.transparency) || 100));
appearance.alwaysOnTop=Boolean(appearance.alwaysOnTop);

function applyAppearance(){
    const widget=document.querySelector(".widget");
    if(!widget) return;
    widget.dataset.theme=appearance.theme;
    widget.classList.toggle("weather-following",appearance.followWeather);
    widget.classList.toggle("always-on-top",appearance.alwaysOnTop);
    document.getElementById("activeThemeName").textContent=appearanceNames[appearance.theme];
    document.getElementById("followWeatherTheme").checked=appearance.followWeather;
    document.getElementById("widgetTransparency").value=String(appearance.transparency);
    document.getElementById("widgetTransparencyValue").textContent=`${appearance.transparency}%`;
    document.getElementById("alwaysOnTopToggle").checked=appearance.alwaysOnTop;
    document.querySelectorAll("[data-theme-choice]").forEach(button=>{
        const active=button.dataset.themeChoice===appearance.theme;
        button.classList.toggle("active",active);
        button.setAttribute("aria-checked",String(active));
    });
}

function saveAppearance(){
    localStorage.setItem(appearanceStorageKey,JSON.stringify(appearance));
    applyAppearance();
}

function applyWindowBehaviour(){
    try{
        const {ipcRenderer}=require("electron");
        ipcRenderer.send("set-window-opacity",appearance.transparency/100);
        ipcRenderer.send("set-always-on-top",appearance.alwaysOnTop);
    }catch(error){
        document.querySelector(".widget").style.opacity=String(appearance.transparency/100);
    }
}

function weatherMood(code){
    if([95,96,99].includes(code)) return "storm";
    if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return "rain";
    if([71,73,75,77,85,86].includes(code)) return "snow";
    if([45,48].includes(code)) return "fog";
    if([1,2,3].includes(code)) return "cloud";
    return "sun";
}

function setWeatherAtmosphere(code){
    const widget=document.querySelector(".widget");
    if(widget) widget.dataset.weather=weatherMood(Number(code));
}

document.querySelectorAll("[data-theme-choice]").forEach(button=>{
    button.addEventListener("click",()=>{
        appearance.theme=button.dataset.themeChoice;
        saveAppearance();
    });
});
document.getElementById("followWeatherTheme").addEventListener("change",event=>{
    appearance.followWeather=event.target.checked;
    saveAppearance();
});
/* Reset defaults is applied only after the custom confirmation. */
function applyConfirmedDefaults(){
    appearance={theme:"mint",followWeather:false,transparency:100,alwaysOnTop:false};
    saveAppearance();
    applyWindowBehaviour();
}
applyAppearance();
applyWindowBehaviour();

const transparencySlider=document.getElementById("widgetTransparency");
const alwaysOnTopToggle=document.getElementById("alwaysOnTopToggle");
const alwaysOnTopModal=document.getElementById("alwaysOnTopModal");
const resetDefaultsModal=document.getElementById("resetDefaultsModal");

transparencySlider.addEventListener("input",()=>{
    appearance.transparency=Number(transparencySlider.value);
    document.getElementById("widgetTransparencyValue").textContent=`${appearance.transparency}%`;
    applyWindowBehaviour();
});
transparencySlider.addEventListener("change",saveAppearance);

function closeAlwaysOnTopModal(){
    alwaysOnTopModal.classList.add("hidden");
    alwaysOnTopToggle.checked=appearance.alwaysOnTop;
}

alwaysOnTopToggle.addEventListener("change",()=>{
    if(alwaysOnTopToggle.checked){
        alwaysOnTopToggle.checked=false;
        alwaysOnTopModal.classList.remove("hidden");
        return;
    }
    appearance.alwaysOnTop=false;
    saveAppearance();
    applyWindowBehaviour();
});
document.getElementById("cancelAlwaysOnTop").addEventListener("click",closeAlwaysOnTopModal);
document.getElementById("confirmAlwaysOnTop").addEventListener("click",()=>{
    appearance.alwaysOnTop=true;
    saveAppearance();
    applyWindowBehaviour();
    closeAlwaysOnTopModal();
});
alwaysOnTopModal.addEventListener("click",event=>{
    if(event.target===alwaysOnTopModal) closeAlwaysOnTopModal();
});

function closeResetDefaultsModal(){
    resetDefaultsModal.classList.add("hidden");
}

document.getElementById("resetDefaults").addEventListener("click",()=>{
    resetDefaultsModal.classList.remove("hidden");
});
document.getElementById("cancelResetDefaults").addEventListener("click",closeResetDefaultsModal);
document.getElementById("confirmResetDefaults").addEventListener("click",()=>{
    resetDefaults();
    applyConfirmedDefaults();
    closeResetDefaultsModal();
});
resetDefaultsModal.addEventListener("click",event=>{
    if(event.target===resetDefaultsModal) closeResetDefaultsModal();
});

document.querySelectorAll('input[type="range"]:not([data-wheel-disabled="true"])').forEach(slider=>{
    slider.addEventListener("wheel",event=>{
        event.preventDefault();
        const minimum=Number(slider.min || 0);
        const maximum=Number(slider.max || 100);
        const step=slider.step && slider.step!=="any" ? Number(slider.step) : 1;
        const direction=event.deltaY < 0 ? 1 : -1;
        const multiplier=event.shiftKey ? 5 : 1;
        const next=Math.min(maximum,Math.max(minimum,Number(slider.value)+direction*step*multiplier));
        if(next===Number(slider.value)) return;
        slider.value=String(next);
        slider.dispatchEvent(new Event("input",{bubbles:true}));
        slider.dispatchEvent(new Event("change",{bubbles:true}));
    },{passive:false});
});

const weatherCodes = {
    0:["☀️","Clear skies"],1:["🌤️","Mostly clear"],2:["⛅","Partly cloudy"],3:["☁️","Cloudy"],
    45:["🌫️","A little foggy"],48:["🌫️","Frosty fog"],51:["🌦️","Light drizzle"],
    53:["🌦️","Drizzle"],55:["🌧️","Heavy drizzle"],61:["🌦️","Light rain"],
    63:["🌧️","Rainy"],65:["🌧️","Heavy rain"],71:["🌨️","Light snow"],
    73:["🌨️","Snowy"],75:["❄️","Heavy snow"],80:["🌦️","Light showers"],
    81:["🌧️","Rain showers"],82:["⛈️","Heavy showers"],95:["⛈️","Thunderstorms"]
};

async function loadWeather(){
    const location=document.getElementById("weatherLocation");
    const temperature=document.getElementById("weatherTemperature");
    const description=document.getElementById("weatherDescription");
    const icon=document.getElementById("weatherIcon");
    location.textContent="Finding your weather…";
    try{
        let latitude;
        let longitude;
        let detectedPlace="";
        try{
            const position=await new Promise((resolve,reject)=>{
                navigator.geolocation.getCurrentPosition(resolve,reject,{
                    timeout:7000,maximumAge:1800000
                });
            });
            latitude=position.coords.latitude;
            longitude=position.coords.longitude;
        }catch(locationError){
            const ipResponse=await fetch("https://ipapi.co/json/");
            if(!ipResponse.ok) throw locationError;
            const ipLocation=await ipResponse.json();
            latitude=ipLocation.latitude;
            longitude=ipLocation.longitude;
            detectedPlace=ipLocation.city || "";
        }
        const response=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`);
        if(!response.ok) throw new Error("Weather unavailable");
        const weather=await response.json();
        const details=weatherCodes[weather.current.weather_code] || ["🌤️","Weather nearby"];
        const timezonePlace=(weather.timezone || "").split("/").pop().replaceAll("_"," ");
        const cached={
            icon:details[0],
            temperature:`${Math.round(weather.current.temperature_2m)}°`,
            description:details[1],
            location:detectedPlace || timezonePlace || "Right where you are",
            code:weather.current.weather_code
        };
        icon.textContent=cached.icon;
        temperature.textContent=cached.temperature;
        description.textContent=cached.description;
        location.textContent=cached.location;
        setWeatherAtmosphere(cached.code);
        localStorage.setItem("cadence-weather-cache",JSON.stringify(cached));
    }catch(error){
        const cached=JSON.parse(localStorage.getItem("cadence-weather-cache") || "null");
        if(cached){
            icon.textContent=cached.icon;
            temperature.textContent=cached.temperature;
            description.textContent=`${cached.description} · saved`;
            location.textContent=cached.location;
            setWeatherAtmosphere(cached.code);
        }else{
            icon.textContent="📍";
            temperature.textContent="--°";
            location.textContent="Location unavailable";
            description.textContent="Allow location, then tap refresh";
        }
    }
}

document.getElementById("refreshWeather").addEventListener("click",loadWeather);
loadWeather();

const songsStorageKey="cadence-custom-music";
const playlistsStorageKey="cadence-music-playlists";
const focusMusicStorageKey="cadence-focus-music";
const temporaryTrackUrls=new Map();
let songs=[];
let playlists=[];
let focusMusic=null;
let playerAudio=null;
let playerQueue=[];
let playerIndex=0;
let playerContext=null;
let isMusicPlaying=false;
let pendingRemoval=null;

function readStoredArray(key){
    try{
        const value=JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    }catch(error){
        return [];
    }
}

songs=readStoredArray(songsStorageKey)
    .filter(song=>song?.id && song?.name && song?.path)
    .map(song=>({id:song.id,name:song.name,path:song.path}));

const validSongIds=new Set(songs.map(song=>song.id));
playlists=readStoredArray(playlistsStorageKey)
    .filter(playlist=>playlist?.id && playlist?.name && Array.isArray(playlist.trackIds))
    .map(playlist=>({
        id:playlist.id,
        name:playlist.name,
        trackIds:playlist.trackIds.filter(id=>validSongIds.has(id))
    }));

try{
    const savedFocus=JSON.parse(localStorage.getItem(focusMusicStorageKey) || "null");
    if(savedFocus?.type==="song" && validSongIds.has(savedFocus.id)) focusMusic=savedFocus;
    if(savedFocus?.type==="playlist" &&
        playlists.some(item=>item.id===savedFocus.id && item.trackIds.length)){
        focusMusic=savedFocus;
    }
}catch(error){
    focusMusic=null;
}

localStorage.removeItem("cadence-sound");

function saveSongs(){
    localStorage.setItem(songsStorageKey,JSON.stringify(
        songs.filter(song=>song.path).map(({id,name,path})=>({id,name,path}))
    ));
}

function savePlaylists(){
    localStorage.setItem(playlistsStorageKey,JSON.stringify(playlists));
}

function saveFocusMusic(){
    if(focusMusic) localStorage.setItem(focusMusicStorageKey,JSON.stringify(focusMusic));
    else localStorage.removeItem(focusMusicStorageKey);
}

function localFileUrl(filePath){
    if(!filePath) return "";
    try{
        return require("url").pathToFileURL(filePath).href;
    }catch(error){
        return "";
    }
}

function sourceForSong(song){
    return song && (temporaryTrackUrls.get(song.id) || localFileUrl(song.path));
}

function importFiles(fileList){
    const imported=[];
    [...fileList].filter(file=>
        file.name.toLowerCase().endsWith(".mp3") || file.type==="audio/mpeg"
    ).forEach(file=>{
        const id=`song-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        let filePath="";
        try{
            filePath=require("electron").webUtils.getPathForFile(file);
        }catch(error){}
        const song={id,name:file.name.replace(/\.[^.]+$/,""),path:filePath};
        if(!filePath) temporaryTrackUrls.set(id,URL.createObjectURL(file));
        songs.push(song);
        imported.push(song);
    });
    saveSongs();
    return imported;
}

function stopMusic(update=true){
    if(playerAudio){
        playerAudio.pause();
        playerAudio.removeAttribute("src");
        playerAudio.load();
        playerAudio=null;
    }
    isMusicPlaying=false;
    if(update) updateMusicUi();
}

function currentSong(){
    return songs.find(song=>song.id===playerQueue[playerIndex]) || null;
}

function playCurrentQueueSong(){
    const song=currentSong();
    const source=sourceForSong(song);
    if(!song || !source){
        stopMusic(false);
        updateMusicUi();
        return;
    }
    stopMusic(false);
    playerAudio=new Audio(source);
    playerAudio.volume=Number(localStorage.getItem("cadence-volume") || 38)/100;
    playerAudio.addEventListener("ended",()=>{
        if(playerQueue.length>1){
            playerIndex=(playerIndex+1)%playerQueue.length;
            playCurrentQueueSong();
        }else{
            isMusicPlaying=false;
            updateMusicUi();
        }
    },{once:true});
    playerAudio.play().then(()=>{
        isMusicPlaying=true;
        updateMusicUi();
    }).catch(()=>{
        isMusicPlaying=false;
        updateMusicUi();
    });
    updateMusicUi();
}

function playSong(songId){
    playerQueue=[songId];
    playerIndex=0;
    playerContext={type:"song",id:songId};
    playCurrentQueueSong();
}

function playPlaylist(playlistId,startIndex=0){
    const playlist=playlists.find(item=>item.id===playlistId);
    const queue=playlist?.trackIds.filter(id=>songs.some(song=>song.id===id)) || [];
    if(!queue.length) return;
    playerQueue=queue;
    playerIndex=Math.min(Math.max(startIndex,0),queue.length-1);
    playerContext={type:"playlist",id:playlistId};
    playCurrentQueueSong();
}

function toggleMainPlayer(){
    if(isMusicPlaying){
        stopMusic();
        return;
    }
    if(playerQueue.length && currentSong()){
        playCurrentQueueSong();
        return;
    }
    if(songs.length) playSong(songs[0].id);
}

function focusQueue(){
    if(focusMusic?.type==="song"){
        return songs.some(song=>song.id===focusMusic.id) ? [focusMusic.id] : [];
    }
    if(focusMusic?.type==="playlist"){
        const playlist=playlists.find(item=>item.id===focusMusic.id);
        return playlist?.trackIds.filter(id=>songs.some(song=>song.id===id)) || [];
    }
    return [];
}

function focusLabel(){
    if(focusMusic?.type==="song"){
        return songs.find(song=>song.id===focusMusic.id)?.name || "";
    }
    if(focusMusic?.type==="playlist"){
        return playlists.find(playlist=>playlist.id===focusMusic.id)?.name || "";
    }
    return "";
}

function setFocusMusic(type,id){
    focusMusic={type,id};
    saveFocusMusic();
    renderSongs();
    renderPlaylists();
    updateMusicUi();
}

function toggleFocusPlayer(){
    const queue=focusQueue();
    if(!queue.length){
        updateMusicUi();
        return;
    }
    const sameContext=playerContext?.type===focusMusic.type && playerContext?.id===focusMusic.id;
    if(sameContext && isMusicPlaying){
        stopMusic();
        return;
    }
    playerQueue=queue;
    playerIndex=sameContext ? Math.min(playerIndex,queue.length-1) : 0;
    playerContext={...focusMusic};
    playCurrentQueueSong();
}

function skipFocus(direction){
    const queue=focusQueue();
    if(!queue.length) return;
    const sameContext=playerContext?.type===focusMusic.type && playerContext?.id===focusMusic.id;
    playerQueue=queue;
    playerIndex=sameContext
        ? (playerIndex+direction+queue.length)%queue.length
        : (direction>0 ? 0 : queue.length-1);
    playerContext={...focusMusic};
    playCurrentQueueSong();
}

function updateMusicUi(){
    const song=currentSong();
    const contextPlaylist=playerContext?.type==="playlist"
        ? playlists.find(item=>item.id===playerContext.id)
        : null;
    document.getElementById("musicNowPlaying").textContent=song?.name || "Nothing selected";
    document.getElementById("musicNowPlayingMood").textContent=contextPlaylist
        ? `From ${contextPlaylist.name}`
        : (song ? "From your Songs" : "Choose something from your library");
    document.getElementById("musicArtwork").textContent=contextPlaylist ? "♬" : "♫";
    document.getElementById("musicPlayToggle").textContent=isMusicPlaying ? "❚❚" : "▶";
    const selectedFocusLabel=focusLabel();
    document.getElementById("focusSoundName").textContent=
        selectedFocusLabel || "Choose focus music in the Music tab";
    const focusIsPlaying=isMusicPlaying && focusMusic &&
        playerContext?.type===focusMusic.type && playerContext?.id===focusMusic.id;
    document.getElementById("focusSoundToggle").textContent=focusIsPlaying ? "❚❚" : "▶";
    document.querySelectorAll(".custom-track").forEach(row=>{
        row.classList.toggle("active",row.dataset.trackId===song?.id);
    });
    document.querySelectorAll(".playlist-card").forEach(card=>{
        card.classList.toggle("active",playerContext?.type==="playlist" && card.dataset.playlistId===playerContext.id);
    });
}

function actionButton(text,className,label,handler){
    const button=document.createElement("button");
    button.type="button";
    button.className=className;
    button.textContent=text;
    button.setAttribute("aria-label",label);
    button.addEventListener("click",handler);
    return button;
}

function renderSongs(){
    const list=document.getElementById("customMusicList");
    list.replaceChildren();
    if(!songs.length){
        const empty=document.createElement("div");
        empty.className="music-empty-state";
        empty.innerHTML="<span>♫</span><strong>No songs yet</strong><small>Add MP3 files to begin your library.</small>";
        list.append(empty);
        renderPlaylistSongChoices();
        return;
    }
    songs.forEach(song=>{
        const row=document.createElement("div");
        row.className="custom-track";
        row.dataset.trackId=song.id;
        const play=actionButton("▶","custom-track-play",`Play ${song.name}`,()=>{
            if(playerContext?.type==="song" && playerContext.id===song.id && isMusicPlaying) stopMusic();
            else playSong(song.id);
        });
        const copy=document.createElement("div");
        const name=document.createElement("strong");
        const detail=document.createElement("small");
        name.textContent=song.name;
        detail.textContent="MP3 · Local file";
        copy.append(name,detail);
        const focus=actionButton(
            focusMusic?.type==="song" && focusMusic.id===song.id ? "Focus ✓" : "Focus",
            "track-focus-button",
            `Use ${song.name} as focus music`,
            ()=>setFocusMusic("song",song.id)
        );
        const remove=actionButton("×","custom-track-remove",`Remove ${song.name}`,()=>askToRemove("song",song.id));
        row.append(play,copy,focus,remove);
        list.append(row);
    });
    renderPlaylistSongChoices();
    updateMusicUi();
}

function renderPlaylistSongChoices(selectedIds=[]){
    const choices=document.getElementById("playlistSongChoices");
    if(!choices) return;
    choices.replaceChildren();
    if(!songs.length){
        const empty=document.createElement("small");
        empty.textContent="No saved songs yet—you can upload MP3 files below.";
        choices.append(empty);
        return;
    }
    songs.forEach(song=>{
        const label=document.createElement("label");
        const checkbox=document.createElement("input");
        const name=document.createElement("span");
        checkbox.type="checkbox";
        checkbox.value=song.id;
        checkbox.checked=selectedIds.includes(song.id);
        name.textContent=song.name;
        label.append(checkbox,name);
        choices.append(label);
    });
}

function renderPlaylists(){
    const list=document.getElementById("playlistList");
    list.replaceChildren();
    if(!playlists.length){
        const empty=document.createElement("div");
        empty.className="music-empty-state";
        empty.innerHTML="<span>♬</span><strong>No playlists yet</strong><small>Create one from saved songs or new MP3 files.</small>";
        list.append(empty);
        return;
    }
    playlists.forEach(playlist=>{
        const card=document.createElement("article");
        card.className="playlist-card";
        card.dataset.playlistId=playlist.id;
        const icon=document.createElement("div");
        icon.className="playlist-card-icon";
        icon.textContent="♬";
        const copy=document.createElement("div");
        const name=document.createElement("strong");
        const detail=document.createElement("small");
        const count=playlist.trackIds.filter(id=>songs.some(song=>song.id===id)).length;
        name.textContent=playlist.name;
        detail.textContent=`${count} ${count===1 ? "song" : "songs"}`;
        copy.append(name,detail);
        const actions=document.createElement("div");
        actions.className="playlist-card-actions";
        const playButton=actionButton("▶","playlist-play",`Play ${playlist.name}`,()=>playPlaylist(playlist.id));
        const focusButton=actionButton(
            focusMusic?.type==="playlist" && focusMusic.id===playlist.id ? "Focus ✓" : "Focus",
            "track-focus-button",
            `Use ${playlist.name} as focus music`,
            ()=>setFocusMusic("playlist",playlist.id)
        );
        playButton.disabled=count===0;
        focusButton.disabled=count===0;
        actions.append(
            playButton,
            focusButton,
            actionButton("Edit","playlist-edit",`Edit ${playlist.name}`,()=>openPlaylistForm(playlist)),
            actionButton("×","custom-track-remove",`Remove ${playlist.name}`,()=>askToRemove("playlist",playlist.id))
        );
        card.append(icon,copy,actions);
        list.append(card);
    });
    updateMusicUi();
}

function showMusicView(view){
    document.querySelectorAll(".music-subtab").forEach(button=>{
        const active=button.dataset.musicView===view;
        button.classList.toggle("active",active);
        button.setAttribute("aria-selected",String(active));
    });
    document.getElementById("songsMusicView").classList.toggle("hidden",view!=="songs");
    document.getElementById("playlistsMusicView").classList.toggle("hidden",view!=="playlists");
}

function openPlaylistForm(playlist=null){
    const form=document.getElementById("playlistForm");
    form.reset();
    document.getElementById("playlistId").value=playlist?.id || "";
    document.getElementById("playlistName").value=playlist?.name || "";
    document.getElementById("playlistFormError").textContent="";
    document.getElementById("playlistUploadSummary").textContent="";
    renderPlaylistSongChoices(playlist?.trackIds || []);
    form.classList.remove("hidden");
    document.getElementById("newPlaylistButton").classList.add("hidden");
    document.getElementById("playlistName").focus();
}

function closePlaylistForm(){
    document.getElementById("playlistForm").classList.add("hidden");
    document.getElementById("newPlaylistButton").classList.remove("hidden");
    document.getElementById("playlistMusicFiles").value="";
    document.getElementById("playlistFormError").textContent="";
}

function closeRemoveMusicModal(){
    document.getElementById("removeMusicModal").classList.add("hidden");
    pendingRemoval=null;
}

function askToRemove(type,id){
    pendingRemoval={type,id};
    const isPlaylist=type==="playlist";
    const item=isPlaylist
        ? playlists.find(playlist=>playlist.id===id)
        : songs.find(song=>song.id===id);
    if(!item) return;
    document.getElementById("removeMusicModalTitle").textContent=
        `Remove “${item.name}”?`;
    document.getElementById("removeMusicModalMessage").textContent=isPlaylist
        ? "The playlist will be removed, but every song in it will stay in Songs."
        : "It will leave Songs and any playlists using it, but the original MP3 file will stay safe.";
    document.getElementById("cancelRemoveMusic").textContent=isPlaylist ? "Keep playlist" : "Keep my song";
    document.getElementById("confirmRemoveMusic").textContent=isPlaylist ? "Remove playlist" : "Remove song";
    document.getElementById("removeMusicModal").classList.remove("hidden");
    document.getElementById("cancelRemoveMusic").focus();
}

function removeSong(songId){
    const song=songs.find(item=>item.id===songId);
    if(!song) return;
    if(playerQueue.includes(songId)) stopMusic(false);
    if(focusMusic?.type==="song" && focusMusic.id===songId) focusMusic=null;
    playlists=playlists.map(playlist=>({
        ...playlist,
        trackIds:playlist.trackIds.filter(id=>id!==songId)
    }));
    if(focusMusic?.type==="playlist"){
        const focusedPlaylist=playlists.find(playlist=>playlist.id===focusMusic.id);
        if(!focusedPlaylist?.trackIds.length) focusMusic=null;
    }
    const temporaryUrl=temporaryTrackUrls.get(songId);
    if(temporaryUrl) URL.revokeObjectURL(temporaryUrl);
    temporaryTrackUrls.delete(songId);
    songs=songs.filter(item=>item.id!==songId);
    playerQueue=playerQueue.filter(id=>id!==songId);
    playerIndex=0;
    saveSongs();
    savePlaylists();
    saveFocusMusic();
    renderAllMusic();
}

function removePlaylist(playlistId){
    const isCurrent=playerContext?.type==="playlist" && playerContext.id===playlistId;
    if(isCurrent) stopMusic(false);
    if(focusMusic?.type==="playlist" && focusMusic.id===playlistId) focusMusic=null;
    playlists=playlists.filter(playlist=>playlist.id!==playlistId);
    if(isCurrent){
        playerQueue=[];
        playerIndex=0;
        playerContext=null;
    }
    savePlaylists();
    saveFocusMusic();
    renderAllMusic();
}

function renderAllMusic(){
    renderSongs();
    renderPlaylists();
    updateMusicUi();
}

document.querySelectorAll(".music-subtab").forEach(button=>{
    button.addEventListener("click",()=>showMusicView(button.dataset.musicView));
});

document.getElementById("musicPlayToggle").addEventListener("click",toggleMainPlayer);
document.getElementById("focusSoundToggle").addEventListener("click",toggleFocusPlayer);
document.getElementById("focusSoundPrevious").addEventListener("click",()=>skipFocus(-1));
document.getElementById("focusSoundNext").addEventListener("click",()=>skipFocus(1));

const musicVolume=document.getElementById("musicVolume");
musicVolume.value=localStorage.getItem("cadence-volume") || "38";
musicVolume.addEventListener("input",()=>{
    localStorage.setItem("cadence-volume",musicVolume.value);
    if(playerAudio) playerAudio.volume=Number(musicVolume.value)/100;
});

document.getElementById("customMusicFiles").addEventListener("change",event=>{
    importFiles(event.target.files);
    renderAllMusic();
    event.target.value="";
});

document.getElementById("newPlaylistButton").addEventListener("click",()=>openPlaylistForm());
document.getElementById("cancelPlaylist").addEventListener("click",closePlaylistForm);
document.getElementById("playlistMusicFiles").addEventListener("change",event=>{
    const count=event.target.files.length;
    document.getElementById("playlistUploadSummary").textContent=count
        ? `${count} new ${count===1 ? "song" : "songs"} ready to add`
        : "";
});

document.getElementById("playlistForm").addEventListener("submit",event=>{
    event.preventDefault();
    const name=document.getElementById("playlistName").value.trim();
    const existingId=document.getElementById("playlistId").value;
    const selectedIds=[...document.querySelectorAll("#playlistSongChoices input:checked")]
        .map(input=>input.value);
    if(!name){
        document.getElementById("playlistFormError").textContent="Give this playlist a name.";
        return;
    }
    const uploadFiles=document.getElementById("playlistMusicFiles").files;
    if(!selectedIds.length && !uploadFiles.length){
        document.getElementById("playlistFormError").textContent="Choose or upload at least one song.";
        return;
    }
    const imported=importFiles(uploadFiles);
    const trackIds=[...new Set([...selectedIds,...imported.map(song=>song.id)])];
    const playlist={
        id:existingId || `playlist-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        trackIds
    };
    playlists=existingId
        ? playlists.map(item=>item.id===existingId ? playlist : item)
        : [...playlists,playlist];
    savePlaylists();
    closePlaylistForm();
    renderAllMusic();
});

document.getElementById("cancelRemoveMusic").addEventListener("click",closeRemoveMusicModal);
document.getElementById("removeMusicModal").addEventListener("click",event=>{
    if(event.target===event.currentTarget) closeRemoveMusicModal();
});
document.getElementById("confirmRemoveMusic").addEventListener("click",()=>{
    const removal=pendingRemoval;
    closeRemoveMusicModal();
    if(removal?.type==="playlist") removePlaylist(removal.id);
    if(removal?.type==="song") removeSong(removal.id);
});
document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && !document.getElementById("removeMusicModal").classList.contains("hidden")){
        closeRemoveMusicModal();
    }
});

showMusicView("songs");
renderAllMusic();

const hardResetModal=document.getElementById("hardResetModal");
const hardResetPhrase=document.getElementById("hardResetPhrase");
const hardResetError=document.getElementById("hardResetError");
const confirmHardReset=document.getElementById("confirmHardReset");

function hardResetPhraseMatches(){
    return hardResetPhrase.value.trim().toLocaleLowerCase()==="hard reset";
}

function closeHardResetModal(){
    hardResetModal.classList.add("hidden");
    hardResetPhrase.value="";
    hardResetError.textContent="";
    confirmHardReset.disabled=true;
}

document.getElementById("openHardReset").addEventListener("click",()=>{
    hardResetModal.classList.remove("hidden");
    hardResetPhrase.value="";
    hardResetError.textContent="";
    confirmHardReset.disabled=true;
    requestAnimationFrame(()=>hardResetPhrase.focus());
});

document.getElementById("cancelHardReset").addEventListener("click",closeHardResetModal);
hardResetPhrase.addEventListener("input",()=>{
    confirmHardReset.disabled=!hardResetPhraseMatches();
    hardResetError.textContent="";
});
hardResetPhrase.addEventListener("keydown",event=>{
    if(event.key==="Enter" && hardResetPhraseMatches()) confirmHardReset.click();
});
hardResetModal.addEventListener("click",event=>{
    if(event.target===hardResetModal) closeHardResetModal();
});

confirmHardReset.addEventListener("click",()=>{
    if(!hardResetPhraseMatches()){
        hardResetError.textContent='Please type "hard reset" to continue.';
        confirmHardReset.disabled=true;
        return;
    }
    if(playerAudio){
        playerAudio.pause();
        playerAudio=null;
    }
    try{
        const {ipcRenderer}=require("electron");
        ipcRenderer.send("hard-reset-cadence");
        ipcRenderer.send("sync-schedule-reminders",[]);
        ipcRenderer.send("sync-timetable-reminders",{
            events:[],hasAlternateWeek:false,anchorMonday:""
        });
    }catch(error){}
    localStorage.clear();
    window.location.reload();
});

document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && !hardResetModal.classList.contains("hidden")){
        closeHardResetModal();
    }
    if(event.key==="Escape" && !alwaysOnTopModal.classList.contains("hidden")){
        closeAlwaysOnTopModal();
    }
    if(event.key==="Escape" && !resetDefaultsModal.classList.contains("hidden")){
        closeResetDefaultsModal();
    }
});
