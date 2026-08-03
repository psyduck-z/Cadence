const {
    app,
    BrowserWindow,
    ipcMain,
    Tray,
    Menu,
    Notification,
    powerMonitor,
    net
} = require("electron");

const fs = require("fs");
const path = require("path");
const {autoUpdater} = require("electron-updater");


let win;
let tray;
let isQuitting=false;
const startHidden=process.argv.includes("--hidden");


const legacyDataFolder=path.join(__dirname,"data");
const dataFolder=path.join(app.getPath("userData"),"data");


const settingsFile =
path.join(dataFolder,"settings.json");

const remindersFile =
path.join(dataFolder,"reminders.json");

let scheduledActivities=[];
let timetableReminderState={
    events:[],
    hasAlternateWeek:false,
    anchorMonday:""
};
let deliveredReminders=new Set();
let reminderTimer=null;
let updateTimer=null;
let updateDownloaded=false;
let lastUpdateCheck=null;
let updateCheckInProgress=false;
let updaterState={status:"idle"};

autoUpdater.autoDownload=false;
autoUpdater.autoInstallOnAppQuit=false;

function sendUpdaterStatus(status,details={}){
    updaterState={...updaterState,status,...details};
    if(!win || win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send("updater-status",{
        ...updaterState,
        version:app.getVersion(),
        checkedAt:lastUpdateCheck
    });
}

async function checkForCadenceUpdate(manual=false){
    if(updateCheckInProgress){
        return;
    }
    if(!app.isPackaged){
        if(manual){
            sendUpdaterStatus("development",{
                message:"Update checks work in the installed version of Cadence."
            });
        }
        return;
    }

    try{
        updateCheckInProgress=true;
        lastUpdateCheck=new Date().toISOString();
        sendUpdaterStatus("checking",{manual});
        await autoUpdater.checkForUpdates();
    }catch(error){
        console.error("Cadence update check failed:",error);
        sendUpdaterStatus("error",{
            message:"Cadence couldn't reach GitHub. Check your connection and try again.",
            errorCode:error?.code || "UPDATE_CHECK_FAILED"
        });
    }finally{
        updateCheckInProgress=false;
    }
}

autoUpdater.on("update-available",info=>{
    sendUpdaterStatus("available",{
        availableVersion:info.version,
        releaseName:info.releaseName || "",
        releaseNotes:info.releaseNotes || ""
    });
});

autoUpdater.on("update-not-available",()=>{
    sendUpdaterStatus("current",{message:"Cadence is up to date."});
});

autoUpdater.on("download-progress",progress=>{
    sendUpdaterStatus("downloading",{percent:Math.round(progress.percent || 0)});
});

autoUpdater.on("update-downloaded",info=>{
    updateDownloaded=true;
    sendUpdaterStatus("downloaded",{
        availableVersion:info.version,
        releaseName:info.releaseName || "",
        releaseNotes:info.releaseNotes || ""
    });
});

autoUpdater.on("error",()=>{
    console.error("Cadence updater reported an error.");
    sendUpdaterStatus("error",{
        message:"The update couldn't be completed. Your current Cadence installation is unchanged."
    });
});


const defaultSettings = {

    focus:25,

    shortBreak:5,

    longBreak:15,

    custom:30,
    customSeconds:0,

    customMode:"preset"

};



function loadSettings(){


    if(!fs.existsSync(dataFolder)){

        fs.mkdirSync(dataFolder,{recursive:true});

    }



    if(!fs.existsSync(settingsFile)){


        fs.writeFileSync(

            settingsFile,

            JSON.stringify(
                defaultSettings,
                null,
                4
            )

        );


        return defaultSettings;

    }



    return JSON.parse(

        fs.readFileSync(settingsFile)

    );

}



function saveSettings(settings){


    fs.writeFileSync(

        settingsFile,

        JSON.stringify(
            settings,
            null,
            4
        )

    );


}

function migrateLegacyData(){
    fs.mkdirSync(dataFolder,{recursive:true});
    ["settings.json","reminders.json"].forEach(fileName=>{
        const oldPath=path.join(legacyDataFolder,fileName);
        const newPath=path.join(dataFolder,fileName);
        if(!fs.existsSync(newPath) && fs.existsSync(oldPath)){
            fs.copyFileSync(oldPath,newPath);
        }
    });
}

function loadReminderState(){

    try{
        if(!fs.existsSync(remindersFile)){
            return;
        }

        const state=JSON.parse(fs.readFileSync(remindersFile,"utf8"));
        scheduledActivities=Array.isArray(state.activities) ? state.activities : [];
        timetableReminderState={
            events:Array.isArray(state.timetable?.events) ? state.timetable.events : [],
            hasAlternateWeek:Boolean(state.timetable?.hasAlternateWeek),
            anchorMonday:state.timetable?.anchorMonday || ""
        };
        deliveredReminders=new Set(
            Array.isArray(state.delivered) ? state.delivered : []
        );
    }
    catch(error){
        scheduledActivities=[];
        timetableReminderState={events:[],hasAlternateWeek:false,anchorMonday:""};
        deliveredReminders=new Set();
    }

}

function saveReminderState(){

    fs.writeFileSync(
        remindersFile,
        JSON.stringify({
            activities:scheduledActivities,
            timetable:timetableReminderState,
            delivered:[...deliveredReminders].slice(-250)
        },null,4)
    );

}

function deliverReminder(reminder){

    const title=reminder.name || "Cadence reminder";
    const content=reminder.notes || "A gentle reminder from Cadence.";

    // Tray balloons work for portable Windows builds without installer/shortcut
    // registration. Other platforms use Electron's native notification API.
    if(process.platform === "win32" && tray){
        tray.displayBalloon({
            title,
            content,
            icon:path.join(__dirname,"assets","cadence.png"),
            noSound:false,
            respectQuietTime:false
        });
        return;
    }

    if(Notification.isSupported()){
        new Notification({
            title,
            body:content,
            icon:path.join(__dirname,"assets","cadence.png")
        }).show();
    }

}

function checkScheduledReminders(){

    const now=new Date();
    const today=
    `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-` +
    String(now.getDate()).padStart(2,"0");
    let changed=false;

    scheduledActivities.forEach(reminder=>{
        if(!reminder.reminder || reminder.completed ||
            !reminder.date || !reminder.time){
            return;
        }

        const key=`${reminder.id}-${reminder.date}-${reminder.time}`;
        const due=new Date(`${reminder.date}T${reminder.time}:00`);

        // Deliver when due, including reminders missed earlier while sleeping.
        if(reminder.date === today && due <= now &&
            !deliveredReminders.has(key)){
            deliveredReminders.add(key);
            changed=true;
            deliverReminder(reminder);
        }
    });

    const currentTime=
    `${String(now.getHours()).padStart(2,"0")}:` +
    String(now.getMinutes()).padStart(2,"0");
    const currentDay=(now.getDay()+6)%7;
    let activeWeek="A";

    if(timetableReminderState.hasAlternateWeek &&
        timetableReminderState.anchorMonday){
        const [year,month,day]=
        timetableReminderState.anchorMonday.split("-").map(Number);
        const anchor=new Date(year,month-1,day);
        const currentMonday=new Date(now);
        currentMonday.setHours(0,0,0,0);
        currentMonday.setDate(currentMonday.getDate()-currentDay);
        const weekOffset=Math.round(
            (currentMonday-anchor)/(7*24*60*60*1000)
        );
        activeWeek=((weekOffset%2)+2)%2 === 0 ? "A" : "B";
    }

    timetableReminderState.events.forEach(reminder=>{
        if(!reminder.reminder || reminder.week !== activeWeek ||
            reminder.day !== currentDay || reminder.start > currentTime){
            return;
        }

        const key=`timetable-${reminder.id}-${today}-${reminder.start}`;
        if(deliveredReminders.has(key)){
            return;
        }

        deliveredReminders.add(key);
        changed=true;
        deliverReminder({
            ...reminder,
            notes:`Starts now · ${reminder.start}–${reminder.end}`
        });
    });

    if(changed){
        saveReminderState();
    }

}



let settings;



let mode="focus";

let secondsRemaining;

let running=false;

let timer=null;



function createWindow(){


    win = new BrowserWindow({

        width:540,

        height:680,

        frame:false,

        transparent:true,

        resizable:false,

        skipTaskbar:true,
        show:!startHidden,

        // Form controls in Schedule and Settings need keyboard focus.
        focusable:true,


        webPreferences:{

            nodeIntegration:true,

            contextIsolation:false,

            backgroundThrottling:false

        }

    });



    win.loadFile("index.html");

    win.on("close",event=>{
        if(!isQuitting){
            event.preventDefault();
            win.hide();
        }
    });

    win.on("show",updateTrayMenu);
    win.on("hide",updateTrayMenu);

}



function sendUpdate(){


    win.webContents.send(

        "timer-update",

        {

            seconds:secondsRemaining,

            mode:mode,

            running:running

        }

    );

}



function setMode(newMode){


    mode=newMode;


    if(newMode==="focus"){

        secondsRemaining=
        settings.focus*60;

    }


    if(newMode==="shortBreak"){

        secondsRemaining=
        settings.shortBreak*60;

    }


    if(newMode==="longBreak"){

        secondsRemaining=
        settings.longBreak*60;

    }


    if(newMode==="custom"){

        secondsRemaining=
        (settings.custom*60) +
        (settings.customSeconds || 0);

    }



    sendUpdate();

}



function startTimer(){


    if(timer)
    return;



    running=true;



    timer=setInterval(()=>{


        secondsRemaining--;


        if(secondsRemaining<=0){

            clearInterval(timer);

            timer=null;

            running=false;

        }



        sendUpdate();



    },1000);



}



function pauseTimer(){


    running=false;


    clearInterval(timer);


    timer=null;


    sendUpdate();


}





ipcMain.on(
"start-timer",
()=>{


    running
    ? pauseTimer()
    : startTimer();


});





ipcMain.on(
"reset-timer",
()=>{


    pauseTimer();


    setMode(mode);


});





ipcMain.on(
"change-mode",
(event,newMode)=>{


    pauseTimer();


    setMode(newMode);


});





ipcMain.on(
"update-settings",
(event,newSettings)=>{


    settings={

        ...settings,

        ...newSettings

    };


    saveSettings(settings);



});






function toggleWindowVisibility(){
    if(!win || win.isDestroyed()){
        createWindow();
        win.once("ready-to-show",()=>{
            win.show();
            win.focus();
        });
        return;
    }
    if(win.isVisible()){
        win.hide();
    }else{
        win.show();
        win.focus();
    }
}

function updateTrayMenu(){
    if(!tray || tray.isDestroyed()) return;
    const isVisible=Boolean(win && !win.isDestroyed() && win.isVisible());
    tray.setContextMenu(
        Menu.buildFromTemplate([
            {
                label:isVisible ? "Hide Cadence" : "Show Cadence",
                click:toggleWindowVisibility
            },
            {type:"separator"},
            {
                label:"Quit",
                click(){
                    isQuitting=true;
                    app.quit();
                }
            }
        ])
    );
}

function createTray(){


    tray=new Tray(

        path.join(
            __dirname,
            "assets",
            "cadence.png"
        )

);

    tray.setToolTip(
        "Cadence"
    );

    tray.on("click",toggleWindowVisibility);
    updateTrayMenu();

}





const hasSingleInstanceLock=app.requestSingleInstanceLock();

if(!hasSingleInstanceLock){
    app.quit();
}else{
app.on("second-instance",()=>{
    if(!win || win.isDestroyed()) return;
    if(win.isMinimized()) win.restore();
    win.show();
    win.focus();
});

app.whenReady().then(()=>{

    app.setAppUserModelId("Cadence");

    migrateLegacyData();
    settings=loadSettings();
    loadReminderState();

    secondsRemaining=
    settings.focus*60;


    createWindow();


    createTray();

    ipcMain.on("sync-schedule-reminders",(event,activities)=>{

        scheduledActivities=Array.isArray(activities) ? activities : [];
        saveReminderState();
        checkScheduledReminders();

    });

    ipcMain.on("sync-timetable-reminders",(event,state)=>{

        timetableReminderState={
            events:Array.isArray(state?.events) ? state.events : [],
            hasAlternateWeek:Boolean(state?.hasAlternateWeek),
            anchorMonday:state?.anchorMonday || ""
        };
        saveReminderState();
        checkScheduledReminders();

    });

    ipcMain.on("hard-reset-cadence",()=>{
        scheduledActivities=[];
        timetableReminderState={events:[],hasAlternateWeek:false,anchorMonday:""};
        deliveredReminders.clear();
        if(win && !win.isDestroyed()){
            win.setOpacity(1);
            win.setAlwaysOnTop(false);
        }
        saveReminderState();
    });

    ipcMain.on("set-window-opacity",(event,value)=>{
        if(!win || win.isDestroyed()) return;
        const opacity=Math.min(1,Math.max(.35,Number(value) || 1));
        win.setOpacity(opacity);
    });

    ipcMain.on("set-always-on-top",(event,enabled)=>{
        if(!win || win.isDestroyed()) return;
        win.setAlwaysOnTop(Boolean(enabled),"floating");
    });

    let rightDragOffset=null;
    ipcMain.on("right-drag-window",(event,payload={})=>{
        if(!win || win.isDestroyed() || event.sender!==win.webContents) return;
        const screenX=Number(payload.screenX);
        const screenY=Number(payload.screenY);
        if(payload.phase==="start" && Number.isFinite(screenX) && Number.isFinite(screenY)){
            const [windowX,windowY]=win.getPosition();
            rightDragOffset={x:screenX-windowX,y:screenY-windowY};
            return;
        }
        if(payload.phase==="move" && rightDragOffset && Number.isFinite(screenX) && Number.isFinite(screenY)){
            win.setPosition(
                Math.round(screenX-rightDragOffset.x),
                Math.round(screenY-rightDragOffset.y),
                false
            );
            return;
        }
        if(payload.phase==="end") rightDragOffset=null;
    });

    const bomObservationProducts=new Set([
        "IDD60920",
        "IDN60920",
        "IDQ60920",
        "IDS60920",
        "IDT60920",
        "IDV60920",
        "IDW60920"
    ]);
    ipcMain.handle("get-bom-observations",async(event,productCode)=>{
        if(event.sender!==win?.webContents || !bomObservationProducts.has(productCode)) return null;
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),8000);
        try{
            const response=await net.fetch(`https://www.bom.gov.au/fwo/${productCode}.xml`,{
                headers:{"User-Agent":`Cadence/${app.getVersion()} weather observations`},
                signal:controller.signal
            });
            if(!response.ok) throw new Error(`BOM observations returned ${response.status}`);
            const xml=await response.text();
            if(xml.length>2_000_000) throw new Error("BOM observation response was unexpectedly large");
            return xml;
        }catch(error){
            console.error("Cadence couldn't load BOM observations:",error?.message || error);
            return null;
        }finally{
            clearTimeout(timeout);
        }
    });

    ipcMain.on("check-for-updates",()=>checkForCadenceUpdate(true));

    ipcMain.on("download-update",async()=>{
        if(!app.isPackaged) return;
        try{
            sendUpdaterStatus("downloading",{percent:0});
            await autoUpdater.downloadUpdate();
        }catch(error){
            sendUpdaterStatus("error",{
                message:"The update couldn't be downloaded. Please try again later."
            });
        }
    });

    ipcMain.on("install-update",()=>{
        if(!updateDownloaded) return;
        isQuitting=true;
        autoUpdater.quitAndInstall(false,true);
    });

    ipcMain.on("get-updater-status",event=>{
        event.sender.send("updater-status",{
            ...updaterState,
            status:updateDownloaded ? "downloaded" : updaterState.status,
            version:app.getVersion(),
            checkedAt:lastUpdateCheck
        });
    });

    const launchSettings={openAtLogin:true,args:["--hidden"]};
    if(process.platform === "win32" && !app.isPackaged){
        launchSettings.path=process.execPath;
        launchSettings.args=[app.getAppPath(),"--hidden"];
    }
    app.setLoginItemSettings(launchSettings);

    powerMonitor.on("resume",checkScheduledReminders);
    powerMonitor.on("unlock-screen",checkScheduledReminders);

    reminderTimer=setInterval(checkScheduledReminders,15000);
    checkScheduledReminders();

    if(app.isPackaged){
        setTimeout(()=>checkForCadenceUpdate(false),12000);
        updateTimer=setInterval(()=>checkForCadenceUpdate(false),10*60*1000);
    }

});
}

app.on("before-quit",()=>{

    isQuitting=true;
    if(reminderTimer){
        clearInterval(reminderTimer);
    }
    if(updateTimer){
        clearInterval(updateTimer);
    }

});
